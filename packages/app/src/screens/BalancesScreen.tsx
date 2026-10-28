import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { Money } from "../components/Money";
import type { TripSummary } from "../dto";
import { t } from "../i18n";
import { colors, space, typeScale } from "../theme";

/** On a paid trip every net amount reads "Settled" and no transfers are shown (the API still sends them). */
export function BalancesScreen({ summary }: { summary: TripSummary }) {
  const paid = summary.paid !== null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t("common.balances")}</Text>
      {summary.balances.map((balance) => (
        <Card key={balance.person_id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{balance.name}</Text>
            {paid ? (
              <Text style={styles.settled}>{t("balances.settledNet")}</Text>
            ) : (
              <Money cents={balance.net_cents} signed style={styles.net} />
            )}
          </View>
          <View style={styles.row}>
            <Text style={styles.muted}>
              {t("balances.paid")} <Money cents={balance.paid_cents} style={styles.muted} />
            </Text>
            <Text style={styles.muted}>
              {t("balances.share")} <Money cents={balance.share_cents} style={styles.muted} />
            </Text>
          </View>
        </Card>
      ))}

      <Text style={styles.heading}>{t("balances.transfers")}</Text>
      {paid || summary.transfers.length === 0 ? (
        <Text style={styles.muted}>{t("balances.settled")}</Text>
      ) : (
        summary.transfers.map((transfer) => (
          <Card key={`${transfer.from.id}-${transfer.to.id}`} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.transfer}>{t("balances.pays", { from: transfer.from.name, to: transfer.to.name })}</Text>
              <Money cents={transfer.amount_cents} style={styles.net} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xl },
  heading: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink, marginBottom: space.md, marginTop: space.sm },
  card: { marginBottom: space.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  name: { fontSize: typeScale.body, fontWeight: "600", color: colors.ink },
  net: { fontSize: typeScale.body, fontWeight: "700" },
  settled: { fontSize: typeScale.body, color: colors.inkMuted },
  muted: { fontSize: typeScale.caption, color: colors.inkMuted, marginTop: space.xs },
  transfer: { flex: 1, fontSize: typeScale.body, color: colors.ink },
});
