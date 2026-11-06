import { useEffect, useState } from "react";
import { FiArrowDown, FiArrowUp, FiTrash2 } from "react-icons/fi";
import {
  api,
  type ProviderCredentialStatus,
  type ProviderId,
} from "../api-client";
import { Badge, Spinner } from "./ui/badge";
import { use_auth } from "../auth-context";
import { Button } from "./ui/button";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  openai: "OpenAI",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  openrouter: "OpenRouter",
};

export function ProfileView({ on_back }: { on_back: () => void }) {
  const { user } = use_auth();
  const can_manage = Boolean(user?.capabilities.manage_providers);
  const [providers, set_providers] = useState<ProviderCredentialStatus[]>([]);
  const [api_keys, set_api_keys] = useState<
    Partial<Record<ProviderId, string>>
  >({});
  const [loading, set_loading] = useState(true);
  const [busy_provider, set_busy_provider] = useState<ProviderId | null>(null);
  const [ordering, set_ordering] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [notice, set_notice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .provider_credentials()
      .then((statuses) => {
        if (active) set_providers(statuses);
      })
      .catch((err: unknown) => {
        if (active) {
          set_error(
            err instanceof Error
              ? err.message
              : "Could not load profile settings.",
          );
        }
      })
      .finally(() => {
        if (active) set_loading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save_key(provider: ProviderId) {
    if (!can_manage) return;
    const api_key = api_keys[provider]?.trim();
    if (!api_key) return;
    set_busy_provider(provider);
    set_error(null);
    set_notice(null);
    try {
      set_providers(await api.save_provider_key(provider, api_key));
      set_api_keys((current) => ({ ...current, [provider]: "" }));
      set_notice(`${PROVIDER_LABELS[provider]} key saved.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not save this API key.",
      );
    } finally {
      set_busy_provider(null);
    }
  }

  async function remove_key(provider: ProviderId) {
    if (!can_manage) return;
    if (!window.confirm(`Remove the saved ${PROVIDER_LABELS[provider]} key?`))
      return;
    set_busy_provider(provider);
    set_error(null);
    set_notice(null);
    try {
      await api.delete_provider_key(provider);
      set_providers((current) =>
        current.map((item) =>
          item.provider === provider ? { ...item, configured: false } : item,
        ),
      );
      set_notice(`${PROVIDER_LABELS[provider]} key removed.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not remove this API key.",
      );
    } finally {
      set_busy_provider(null);
    }
  }

  async function move_provider(provider: ProviderId, direction: -1 | 1) {
    if (!can_manage) return;
    const current_index = providers.findIndex(
      (item) => item.provider === provider,
    );
    const target_index = current_index + direction;
    if (
      current_index < 0 ||
      target_index < 0 ||
      target_index >= providers.length
    )
      return;

    const previous = providers;
    const reordered = [...providers];
    [reordered[current_index], reordered[target_index]] = [
      reordered[target_index],
      reordered[current_index],
    ];
    set_providers(reordered.map((item, order) => ({ ...item, order })));
    set_ordering(true);
    set_error(null);
    set_notice(null);
    try {
      set_providers(
        await api.update_provider_order(reordered.map((item) => item.provider)),
      );
      set_notice("Provider order saved.");
    } catch (err) {
      set_providers(previous);
      set_error(
        err instanceof Error ? err.message : "Could not save provider order.",
      );
    } finally {
      set_ordering(false);
    }
  }

  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to dashboard"
          title="Back to dashboard"
          onClick={on_back}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06l-3.22 3.22h10.69A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            LLM provider credentials
          </p>
        </div>
      </div>

      {can_manage && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Keys are encrypted at rest. The API decrypts them to make requests, so
          the hosting operator can access them. A report may be sent to each
          provider attempted in the order below.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <ol className="divide-y divide-gray-200 rounded-xl bg-white px-4 shadow-untitled ring-1 ring-gray-900/5 dark:divide-gray-800 dark:bg-gray-900 dark:shadow-none dark:ring-white/10 sm:px-6">
          {providers.map((item, index) => {
            const label = PROVIDER_LABELS[item.provider];
            const busy = busy_provider === item.provider;
            return (
              <li key={item.provider} className="py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {index + 1}
                  </span>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {label}
                  </h2>
                  <Badge tone={item.configured ? "success" : "gray"}>
                    {item.configured ? "Configured" : "Not configured"}
                  </Badge>
                  {can_manage && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${label} earlier`}
                        title="Move earlier"
                        disabled={ordering || index === 0}
                        onClick={() => void move_provider(item.provider, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        <FiArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${label} later`}
                        title="Move later"
                        disabled={ordering || index === providers.length - 1}
                        onClick={() => void move_provider(item.provider, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        <FiArrowDown aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {can_manage && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">{label} API key</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={api_keys[item.provider] ?? ""}
                        onChange={(event) =>
                          set_api_keys((current) => ({
                            ...current,
                            [item.provider]: event.target.value,
                          }))
                        }
                        placeholder={
                          item.configured
                            ? "Enter a new key to replace"
                            : "Paste API key"
                        }
                        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-600 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-700 dark:placeholder:text-gray-500"
                      />
                    </label>
                    <Button
                      size="sm"
                      loading={busy}
                      disabled={!api_keys[item.provider]?.trim() || ordering}
                      onClick={() => void save_key(item.provider)}
                    >
                      Save key
                    </Button>
                    {item.configured && (
                      <button
                        type="button"
                        aria-label={`Remove ${label} key`}
                        title="Remove saved key"
                        disabled={busy || ordering}
                        onClick={() => void remove_key(item.provider)}
                        className="flex h-9 w-9 items-center justify-center self-end rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 sm:self-auto"
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
