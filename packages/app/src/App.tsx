import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import { API_URL } from "./api/client";
import { listExpenses } from "./api/expenses";
import { getSummary, getTrip, listTrips } from "./api/trips";
import { TabBar, type Screen } from "./components/TabBar";
import type { Expense, Trip, TripSummary } from "./dto";
import { t } from "./i18n";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { BalancesScreen } from "./screens/BalancesScreen";
import { TripScreen } from "./screens/TripScreen";
import { colors, font, radius, space, touchTarget } from "./theme";

interface TripData {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
}

// Without a safe-area library, leave room for the iOS status bar / notch and the Android status bar.
const TOP_INSET = Platform.select({ ios: 50, android: StatusBar.currentHeight ?? 24, default: 0 });

export default function App() {
  const [data, setData] = useState<TripData | null>(null);
  const [failed, setFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>("trip");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [first] = await listTrips();
      const [trip, expenses, summary] = await Promise.all([getTrip(first.id), listExpenses(first.id), getSummary(first.id)]);
      setData({ trip, expenses, summary });
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The create response already carries the new summary: no second request needed.
  const onSaved = (expense: Expense, summary: TripSummary) => {
    setData((current) => current && { ...current, expenses: insertByDate(current.expenses, expense), summary });
    setScreen("trip");
  };

  return (
    <View style={styles.page}>
      <View style={styles.app}>
        {data === null ? (
          <View style={styles.center}>
            {failed ? (
              <>
                <Text style={styles.message}>{t("app.loadFailed", { url: API_URL })}</Text>
                <Pressable onPress={load} accessibilityRole="button" style={styles.retry}>
                  <Text style={styles.retryLabel}>{t("app.retry")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.message}>{t("app.loading")}</Text>
              </>
            )}
          </View>
        ) : screen === "add" ? (
          <AddExpenseScreen
            tripId={data.trip.id}
            members={data.trip.members ?? []}
            defaultDate={clampToTrip(todayIso(), data.trip)}
            onSaved={onSaved}
            onCancel={() => setScreen("trip")}
          />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.tripName} numberOfLines={1}>
                {data.trip.name}
              </Text>
            </View>
            <View style={styles.body}>
              {screen === "trip" ? (
                <TripScreen trip={data.trip} expenses={data.expenses} summary={data.summary} />
              ) : (
                <BalancesScreen summary={data.summary} />
              )}
            </View>
            <TabBar current={screen} onChange={setScreen} />
          </>
        )}
      </View>
    </View>
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
  page: { flex: 1, backgroundColor: colors.background, alignItems: "center" },
  app: { flex: 1, width: "100%", maxWidth: 520, paddingTop: TOP_INSET, backgroundColor: colors.background },
  header: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tripName: { fontSize: font.title, fontWeight: "700", color: colors.text },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  message: { fontSize: font.body, color: colors.muted, textAlign: "center" },
  retry: {
    minHeight: touchTarget,
    paddingHorizontal: space.xl,
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  retryLabel: { color: colors.primaryText, fontSize: font.body, fontWeight: "700" },
});
