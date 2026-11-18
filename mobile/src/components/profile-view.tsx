import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { radius, useAppStyles, type Palette } from "../theme";
import type { ProviderCredentialStatus, ProviderId } from "../types";
import { Badge, Card, Spinner } from "./ui/card";
import { Button } from "./ui/button";
import { TextField } from "./ui/input";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  openai: "OpenAI",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  openrouter: "OpenRouter",
};

export function ProfileView() {
  const { user } = useAuth();
  const can_manage = Boolean(user?.capabilities.manage_providers);
  const styles = useAppStyles(make_styles);
  const [providers, set_providers] = useState<ProviderCredentialStatus[]>([]);
  const [keys, set_keys] = useState<Partial<Record<ProviderId, string>>>({});
  const [loading, set_loading] = useState(true);
  const [busy, set_busy] = useState<ProviderId | null>(null);
  const [ordering, set_ordering] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
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

  async function save_key(provider: ProviderId) {
    const api_key = keys[provider]?.trim();
    if (!can_manage || !api_key) return;
    set_busy(provider);
    set_error(null);
    try {
      set_providers(await api.saveProviderKey(provider, api_key));
      set_keys((current) => ({ ...current, [provider]: "" }));
      Alert.alert(`${PROVIDER_LABELS[provider]} key saved.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not save this API key.",
      );
    } finally {
      set_busy(null);
    }
  }

  function remove_key(provider: ProviderId) {
    if (!can_manage) return;
    Alert.alert(
      `Remove the saved ${PROVIDER_LABELS[provider]} key?`,
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              set_busy(provider);
              set_error(null);
              try {
                await api.deleteProviderKey(provider);
                set_providers((current) =>
                  current.map((item) =>
                    item.provider === provider
                      ? { ...item, configured: false }
                      : item,
                  ),
                );
              } catch (err) {
                set_error(
                  err instanceof Error
                    ? err.message
                    : "Could not remove this API key.",
                );
              } finally {
                set_busy(null);
              }
            })();
          },
        },
      ],
    );
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
    ) {
      return;
    }
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
    } catch (err) {
      set_providers(previous);
      set_error(
        err instanceof Error ? err.message : "Could not save provider order.",
      );
    } finally {
      set_ordering(false);
    }
  }

  if (loading) {
    return <Spinner label="Loading profile" />;
  }

  return (
    <View style={styles.wrap}>
      {can_manage && (
        <Text style={styles.notice}>
          Keys are encrypted at rest. The API decrypts them to make requests, so
          the hosting operator can access them. A report may be sent to each
          provider attempted in the order below.
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {providers.map((item, index) => (
        <Card key={item.provider} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{PROVIDER_LABELS[item.provider]}</Text>
              <Badge
                label={item.configured ? "Key saved" : "Not configured"}
                tone={item.configured ? "success" : "gray"}
              />
            </View>
            <View style={styles.orderButtons}>
              <Button
                label="↑"
                size="sm"
                variant="secondary"
                disabled={!can_manage || ordering || index === 0}
                onPress={() => void move_provider(item.provider, -1)}
              />
              <Button
                label="↓"
                size="sm"
                variant="secondary"
                disabled={
                  !can_manage || ordering || index === providers.length - 1
                }
                onPress={() => void move_provider(item.provider, 1)}
              />
            </View>
          </View>

          {can_manage && (
            <>
              <TextField
                label="API key"
                value={keys[item.provider] ?? ""}
                onChangeText={(value) =>
                  set_keys((current) => ({
                    ...current,
                    [item.provider]: value,
                  }))
                }
                placeholder={
                  item.configured
                    ? "Replace the saved key"
                    : "Paste the provider API key"
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.actions}>
                <Button
                  label="Save key"
                  size="sm"
                  loading={busy === item.provider}
                  disabled={!(keys[item.provider] ?? "").trim()}
                  onPress={() => void save_key(item.provider)}
                />
                {item.configured && (
                  <Button
                    label="Remove key"
                    size="sm"
                    variant="danger"
                    disabled={busy === item.provider}
                    onPress={() => remove_key(item.provider)}
                  />
                )}
              </View>
            </>
          )}
        </Card>
      ))}
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  wrap: { gap: 12 },
  notice: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.md,
    padding: 10,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  card: { gap: 10 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitleWrap: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  orderButtons: { flexDirection: "row", gap: 4 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
