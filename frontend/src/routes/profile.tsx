import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { useDashboardState } from "../components/dashboard/provider";
import { PROVIDER_LABELS } from "../components/profile/providers";
import { ProviderRow } from "../components/profile/provider-row";
import { Spinner } from "../components/ui/badge";
import { notify } from "../components/ui/toast";
import type { ProviderCredentialStatus, ProviderId } from "../types";

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const can_manage = Boolean(user?.capabilities.manage_providers);
  const [providers, set_providers] = useState<ProviderCredentialStatus[]>([]);
  const [api_keys, set_api_keys] = useState<
    Partial<Record<ProviderId, string>>
  >({});
  const [loading, set_loading] = useState(true);
  const [busy_provider, set_busy_provider] = useState<ProviderId | null>(null);
  const [ordering, set_ordering] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .providerCredentials()
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

  async function saveKey(provider: ProviderId) {
    if (!can_manage) return;
    const api_key = api_keys[provider]?.trim();
    if (!api_key) return;
    set_busy_provider(provider);
    set_error(null);
    try {
      set_providers(await api.saveProviderKey(provider, api_key));
      set_api_keys((current) => ({ ...current, [provider]: "" }));
      notify.success(`${PROVIDER_LABELS[provider]} key saved.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not save this API key.",
      );
    } finally {
      set_busy_provider(null);
    }
  }

  async function removeKey(provider: ProviderId) {
    if (!can_manage) return;
    if (!window.confirm(`Remove the saved ${PROVIDER_LABELS[provider]} key?`))
      return;
    set_busy_provider(provider);
    set_error(null);
    try {
      await api.deleteProviderKey(provider);
      set_providers((current) =>
        current.map((item) =>
          item.provider === provider ? { ...item, configured: false } : item,
        ),
      );
      notify.success(`${PROVIDER_LABELS[provider]} key removed.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not remove this API key.",
      );
    } finally {
      set_busy_provider(null);
    }
  }

  async function moveProvider(provider: ProviderId, direction: -1 | 1) {
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
    try {
      set_providers(
        await api.updateProviderOrder(reordered.map((item) => item.provider)),
      );
      notify.success("Provider order saved.");
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {dash.loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <section>
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to dashboard"
              title="Back to dashboard"
              onClick={() => void navigate({ to: "/" })}
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

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <ol className="divide-y divide-gray-200 rounded-xl bg-white px-4 shadow-untitled ring-1 ring-gray-900/5 dark:divide-gray-800 dark:bg-gray-900 dark:shadow-none dark:ring-white/10 sm:px-6">
              {providers.map((item, index) => (
                <ProviderRow
                  key={item.provider}
                  item={item}
                  index={index}
                  total={providers.length}
                  label={PROVIDER_LABELS[item.provider]}
                  can_manage={can_manage}
                  busy={busy_provider === item.provider}
                  ordering={ordering}
                  api_key={api_keys[item.provider] ?? ""}
                  on_key_change={(value) =>
                    set_api_keys((current) => ({
                      ...current,
                      [item.provider]: value,
                    }))
                  }
                  on_save={() => void saveKey(item.provider)}
                  on_remove={() => void removeKey(item.provider)}
                  on_move={(direction) =>
                    void moveProvider(item.provider, direction)
                  }
                />
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});
