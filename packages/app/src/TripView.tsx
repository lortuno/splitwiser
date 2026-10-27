import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { API_URL, ApiError } from "./api/client";
import { listExpenses } from "./api/expenses";
import { getSummary, getTrip } from "./api/trips";
import { StateMessage } from "./components/StateMessage";
import { TabBar, type Screen } from "./components/TabBar";
import type { Expense, Trip, TripSummary } from "./dto";
import { t } from "./i18n";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { BalancesScreen } from "./screens/BalancesScreen";
import { TripScreen } from "./screens/TripScreen";
import { colors, size, space, typeScale } from "./theme";

interface TripData {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
}

type Problem = "unreachable" | "notFound" | "notMember";

/** One trip with its tabs (Trip, Balances, + Add expense). tripId null means the link held no valid id. */
export function TripView({ tripId, onBack }: { tripId: number | null; onBack: () => void }) {
  const [data, setData] = useState<TripData | null>(null);
  const [problem, setProblem] = useState<Problem | null>(tripId === null ? "notFound" : null);
  const [screen, setScreen] = useState<Screen>("trip");

  const load = useCallback(async () => {
    if (tripId === null) {
      return;
    }
    setProblem(null);
    try {
      const [trip, expenses, summary] = await Promise.all([getTrip(tripId), listExpenses(tripId), getSummary(tripId)]);
      setData({ trip, expenses, summary });
    } catch (error) {
      // A 401 is handled by the app shell, which leaves this view.
      const status = error instanceof ApiError ? error.status : null;
      setProblem(status === 404 ? "notFound" : status === 403 ? "notMember" : "unreachable");
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The create response already carries the new summary: no second request needed.
  const onSaved = (expense: Expense, summary: TripSummary) => {
    setData((current) => current && { ...current, expenses: insertByDate(current.expenses, expense), summary });
    setScreen("trip");
  };

  if (data === null) {
    const toMyTrips = { label: t("app.goToMyTrips"), onPress: onBack };
    switch (problem) {
      case "notFound":
        return <StateMessage message={t("app.notFound")} action={toMyTrips} />;
      case "notMember":
        return <StateMessage message={t("app.notMember")} action={toMyTrips} />;
      case "unreachable":
        return <StateMessage message={t("app.loadFailed", { url: API_URL })} action={{ label: t("app.retry"), onPress: load }} />;
      default:
        return <StateMessage message={t("app.loading")} loading />;
    }
  }

  if (screen === "add") {
    return (
      <AddExpenseScreen
        tripId={data.trip.id}
        members={data.trip.members ?? []}
        defaultDate={clampToTrip(todayIso(), data.trip)}
        onSaved={onSaved}
        onCancel={() => setScreen("trip")}
      />
    );
  }

  return (
    <>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backLabel}>{t("trip.back")}</Text>
        </Pressable>
        <Text style={styles.tripName} numberOfLines={1}>
          {data.trip.name}
        </Text>
      </View>
      <View style={styles.body}>
        {screen === "trip" ? (
          <TripScreen
            trip={data.trip}
            expenses={data.expenses}
            summary={data.summary}
            onShowAllTransfers={() => setScreen("balances")}
          />
        ) : (
          <BalancesScreen summary={data.summary} />
        )}
      </View>
      <TabBar current={screen} onChange={setScreen} />
    </>
  );
}

function todayIso(): string {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
}

/** Today when it falls inside the trip, otherwise the nearest trip day (ISO dates compare as strings). */
function clampToTrip(date: string, trip: Trip): string {
  return date < trip.start_date ? trip.start_date : date > trip.end_date ? trip.end_date : date;
}

/** Newest date first, matching the API's order (date desc, id desc). */
function insertByDate(expenses: Expense[], expense: Expense): Expense[] {
  const index = expenses.findIndex((e) => e.date <= expense.date);
  return index === -1 ? [...expenses, expense] : [...expenses.slice(0, index), expense, ...expenses.slice(index)];
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  back: { minHeight: size.tapMin, justifyContent: "center", alignSelf: "flex-start" },
  backLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
  tripName: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  body: { flex: 1 },
});
