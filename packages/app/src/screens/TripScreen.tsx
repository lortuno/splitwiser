import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { Money } from "../components/Money";
import type { Expense, Trip, TripSummary } from "../dto";
import { formatDate, joinNames, t, tCount } from "../i18n";
import { colors, size, space, typeScale } from "../theme";

/** The hero shows this many transfers; "Show all" leads to the Balances tab for the rest. */
const VISIBLE_TRANSFERS = 3;

export function TripScreen({
  trip,
  expenses,
  summary,
  onShowAllTransfers,
}: {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
  onShowAllTransfers: () => void;
}) {
  return (
    <FlatList
      data={expenses}
      keyExtractor={(expense) => String(expense.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Card style={styles.total}>
            <Text style={styles.totalLabel}>{t("trip.totalSpend")}</Text>
            <Money cents={summary.total_cents} compact style={styles.totalAmount} />
            <Text style={styles.muted}>
              {formatDate(trip.start_date)} – {formatDate(trip.end_date)} · {tCount("trip.expenseCount", summary.expense_count)}
            </Text>
            <Text style={styles.muted}>{tCount("trip.peopleCount", trip.members?.length ?? 0)}</Text>
          </Card>
          {summary.expense_count > 0 && <Transfers summary={summary} onShowAll={onShowAllTransfers} />}
          <Text style={styles.heading}>{t("trip.expenses")}</Text>
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={styles.state}>{t("trip.noExpenses")}</Text>
        </Card>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <ExpenseRow expense={item} />}
    />
  );
}

function Transfers({ summary, onShowAll }: { summary: TripSummary; onShowAll: () => void }) {
  const { transfers } = summary;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{t("balances.transfers")}</Text>
      {transfers.length === 0 ? (
        <Card>
          <Text style={styles.state}>{t("balances.settled")}</Text>
        </Card>
      ) : (
        transfers.slice(0, VISIBLE_TRANSFERS).map((transfer) => (
          <Card key={`${transfer.from.id}-${transfer.to.id}`}>
            <View style={styles.transferRow}>
              <Text style={styles.transfer}>{t("balances.pays", { from: transfer.from.name, to: transfer.to.name })}</Text>
              <Money cents={transfer.amount_cents} style={styles.amount} />
            </View>
          </Card>
        ))
      )}
      {transfers.length > VISIBLE_TRANSFERS && (
        <Pressable onPress={onShowAll} accessibilityRole="button" style={styles.showAll}>
          <Text style={styles.showAllLabel}>{t("trip.showAll", { count: transfers.length })}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const split =
    expense.split_between.length === 1
      ? t("expense.splitPersonal", { name: expense.split_between[0].name })
      : t("expense.splitBetween", { count: expense.split_between.length });

  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={2}>
          {expense.name}
        </Text>
        <Money cents={expense.amount_cents} style={styles.amount} />
      </View>
      <Text style={styles.detail}>
        {formatDate(expense.date)} · {t("expense.paidBy", { names: joinNames(expense.paid_by.map((p) => p.name)) })}
      </Text>
      <Text style={styles.muted}>
        {t("expense.recordedBy", { name: expense.recorded_by.name })} · {split}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xl },
  total: { marginBottom: space.xl, padding: space.xl, alignItems: "flex-start" },
  totalLabel: { fontSize: typeScale.body, color: colors.inkMuted },
  totalAmount: { fontSize: typeScale.hero, fontWeight: "700", marginVertical: space.xs },
  section: { marginBottom: space.xl, gap: space.sm },
  heading: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink, marginBottom: space.md },
  sectionHeading: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink, marginBottom: space.xs },
  state: { fontSize: typeScale.body, color: colors.ink },
  transferRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  transfer: { flex: 1, fontSize: typeScale.body, color: colors.ink },
  showAll: { minHeight: size.tapMin, justifyContent: "center", alignSelf: "flex-start" },
  showAllLabel: { fontSize: typeScale.body, fontWeight: "700", color: colors.accent },
  separator: { height: space.sm },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md },
  name: { flex: 1, fontSize: typeScale.body, fontWeight: "600", color: colors.ink },
  amount: { flexShrink: 0, fontSize: typeScale.body, fontWeight: "700" },
  detail: { fontSize: typeScale.caption, color: colors.ink, marginTop: space.xs },
  muted: { fontSize: typeScale.caption, color: colors.inkMuted, marginTop: space.xs },
});
