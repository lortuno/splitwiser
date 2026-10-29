import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { Money } from "../components/Money";
import type { Expense, Trip, TripSummary } from "../dto";
import { categoryIcon, categoryLabel } from "../expenses/categories";
import { formatDate, formatLocalDate, joinNames, t, tCount } from "../i18n";
import { formatCents } from "../money/format";
import { colors, radius, size, space, typeScale } from "../theme";
import { dateRange } from "../trips/dates";

/** The hero shows this many transfers; "Show all" leads to the Balances tab for the rest. */
const VISIBLE_TRANSFERS = 3;

export function TripScreen({
  trip,
  expenses,
  summary,
  notice,
  onShowAllTransfers,
  onOpenExpense,
}: {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
  /** An error from the last header action (Reopen), shown at the top. */
  notice?: string | null;
  onShowAllTransfers: () => void;
  onOpenExpense: (expense: Expense) => void;
}) {
  const { paid } = summary;
  return (
    <FlatList
      data={expenses}
      keyExtractor={(expense) => String(expense.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          {notice && (
            <View style={styles.notice}>
              <Text style={styles.noticeLabel}>{notice}</Text>
            </View>
          )}
          {paid && (
            <Card style={styles.paid}>
              <Text style={styles.paidTitle}>{t("common.paid")}</Text>
              <Text style={styles.state}>{t("trip.paidBy", { name: paid.by.name, date: formatLocalDate(paid.at) })}</Text>
            </Card>
          )}
          <Card style={styles.total}>
            <Text style={styles.totalLabel}>{t("trip.totalSpend")}</Text>
            <Money cents={summary.total_cents} compact style={styles.totalAmount} />
            <Text style={styles.muted}>
              {[dateRange(trip), tCount("trip.expenseCount", summary.expense_count)].filter((part) => part !== null).join(" · ")}
            </Text>
            <Text style={styles.muted}>{tCount("trip.peopleCount", trip.members?.length ?? 0)}</Text>
          </Card>
          {summary.expense_count > 0 && !paid && <Transfers summary={summary} onShowAll={onShowAllTransfers} />}
          <Text style={styles.heading}>{t("trip.expenses")}</Text>
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={styles.state}>{t("trip.noExpenses")}</Text>
        </Card>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <ExpenseRow expense={item} onPress={paid ? undefined : () => onOpenExpense(item)} />}
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

/** With onPress (an open trip) the whole card is a button that opens "Edit expense"; a paid trip's rows are not. */
function ExpenseRow({ expense, onPress }: { expense: Expense; onPress?: () => void }) {
  const split =
    expense.split_between.length === 1
      ? t("expense.splitPersonal", { name: expense.split_between[0].name })
      : t("expense.splitBetween", { count: expense.split_between.length });

  // Screen readers get the category as a word instead of the emoji.
  const label = `${categoryLabel(expense.category)}, ${expense.name}, ${formatCents(expense.amount_cents)}`;

  const card = (pressed: boolean) => (
    <Card style={[styles.rowCard, pressed && styles.rowPressed]}>
      <View style={styles.iconBox} importantForAccessibility="no-hide-descendants" aria-hidden>
        <Text style={styles.icon}>{categoryIcon(expense.category)}</Text>
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={2}>
            {expense.name}
          </Text>
          <Money cents={expense.amount_cents} style={styles.amount} />
          {onPress && <Text style={styles.chevron}>›</Text>}
        </View>
        <Text style={styles.detail}>
          {formatDate(expense.date)} · {t("expense.paidBy", { names: joinNames(expense.paid_by.map((p) => p.name)) })}
        </Text>
        <Text style={styles.muted}>
          {t("expense.recordedBy", { name: expense.recorded_by.name })} · {split}
        </Text>
        {expense.edited && <Text style={styles.muted}>{t("expense.edited")}</Text>}
      </View>
    </Card>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      {({ pressed }) => card(pressed)}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label}>
      {card(false)}
    </View>
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
  row: { minHeight: size.tapMin },
  rowCard: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  rowText: { flex: 1 },
  iconBox: {
    width: size.iconBox,
    height: size.iconBox,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: typeScale.title },
  rowPressed: { backgroundColor: colors.accentSoft },
  chevron: { fontSize: typeScale.body, fontWeight: "700", color: colors.inkMuted },
  paid: { marginBottom: space.md, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, gap: space.xs },
  paidTitle: { fontSize: typeScale.body, fontWeight: "700", color: colors.ink },
  notice: { backgroundColor: colors.owesSoft, borderRadius: radius.sm, padding: space.md, marginBottom: space.md },
  noticeLabel: { fontSize: typeScale.body, color: colors.owes },
});
