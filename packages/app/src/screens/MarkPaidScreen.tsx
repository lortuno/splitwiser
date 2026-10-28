import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { API_URL, ApiError } from "../api/client";
import { markPaid } from "../api/trips";
import { Card } from "../components/Card";
import { Money } from "../components/Money";
import type { TripSummary } from "../dto";
import { t } from "../i18n";
import { colors, size, space, typeScale } from "../theme";
import { authStyles } from "./LoginScreen";

/**
 * Asks before marking the trip as paid, listing every open transfer as the payments that will count as done.
 * onConflict: someone else marked it meanwhile (409 already_paid), so the trip view reloads.
 */
export function MarkPaidScreen({
  tripId,
  summary,
  onPaid,
  onConflict,
  onCancel,
}: {
  tripId: number;
  summary: TripSummary;
  onPaid: (summary: TripSummary) => void;
  onConflict: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      onPaid((await markPaid(tripId)).summary);
    } catch (error) {
      if (error instanceof ApiError && error.code === "already_paid") {
        onConflict();
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setFailed(true);
      }
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("markPaid.title")}</Text>
        {summary.transfers.length === 0 ? (
          <Text style={styles.body}>{t("balances.settled")}</Text>
        ) : (
          <>
            <Text style={styles.body}>{t("markPaid.intro")}</Text>
            <Card style={styles.transfers}>
              {summary.transfers.map((transfer) => (
                <View key={`${transfer.from.id}-${transfer.to.id}`} style={styles.transferRow}>
                  <Text style={styles.transfer}>{t("balances.pays", { from: transfer.from.name, to: transfer.to.name })}</Text>
                  <Money cents={transfer.amount_cents} style={styles.amount} />
                </View>
              ))}
            </Card>
          </>
        )}
        <Text style={styles.caption}>{t("markPaid.locked")}</Text>
      </ScrollView>
      <View style={authStyles.footer}>
        {failed && (
          <Card style={[authStyles.errorCard, styles.error]}>
            <Text style={authStyles.errorText}>{t("app.loadFailed", { url: API_URL })}</Text>
          </Card>
        )}
        <Pressable
          onPress={confirm}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [authStyles.primary, (pressed || busy) && authStyles.primaryPressed]}
        >
          <Text style={authStyles.primaryLabel}>{t(busy ? "markPaid.confirming" : "markPaid.confirm")}</Text>
        </Pressable>
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelLabel}>{t("markPaid.cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
  title: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  body: { fontSize: typeScale.body, color: colors.ink },
  transfers: { gap: space.sm },
  transferRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  transfer: { flex: 1, fontSize: typeScale.body, color: colors.ink },
  amount: { flexShrink: 0, fontSize: typeScale.body, fontWeight: "700" },
  caption: { fontSize: typeScale.caption, color: colors.inkMuted },
  error: { marginBottom: space.sm },
  cancel: { minHeight: size.tapMin, alignItems: "center", justifyContent: "center" },
  cancelLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
});
