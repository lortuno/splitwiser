import { FlatList, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { Money } from "../components/Money";
import type { Expense, Trip, TripSummary } from "../dto";
import { formatDate, joinNames, t } from "../i18n";
import { colors, font, space } from "../theme";

export function TripScreen({ trip, expenses, summary }: { trip: Trip; expenses: Expense[]; summary: TripSummary }) {
  return (
    <FlatList
      data={expenses}
      keyExtractor={(expense) => String(expense.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Card style={styles.total}>
          <Text style={styles.totalLabel}>{t("trip.totalSpend")}</Text>
          <Money cents={summary.total_cents} style={styles.totalAmount} />
          <Text style={styles.muted}>
            {formatDate(trip.start_date)} – {formatDate(trip.end_date)} · {t("trip.expenseCount", { count: summary.expense_count })}
          </Text>
        </Card>
      }
      ListEmptyComponent={<Text style={styles.muted}>{t("trip.noExpenses")}</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <ExpenseRow expense={item} />}
    />
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
  total: { marginBottom: space.lg, alignItems: "flex-start" },
  totalLabel: { fontSize: font.body, color: colors.muted },
  totalAmount: { fontSize: font.hero, fontWeight: "700", marginVertical: space.xs },
  separator: { height: space.sm },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md },
  name: { flex: 1, fontSize: font.body, fontWeight: "600", color: colors.text },
  amount: { fontSize: font.body, fontWeight: "700" },
  detail: { fontSize: font.small, color: colors.text, marginTop: space.xs },
  muted: { fontSize: font.small, color: colors.muted, marginTop: space.xs },
});
