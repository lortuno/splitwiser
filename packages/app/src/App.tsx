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
import { colors, radius, size, space, typeScale } from "./theme";

interface TripData {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
}

// Without a safe-area library, leave room for the iOS status bar / notch and the Android status bar.
const TOP_INSET = Platform.select({
  ios: size.statusBarInsetIos,
  android: StatusBar.currentHeight ?? size.statusBarInsetAndroid,
  default: 0,
});

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
                <ActivityIndicator color={colors.accent} />
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
  page: { flex: 1, backgroundColor: colors.paper, alignItems: "center" },
  app: { flex: 1, width: "100%", maxWidth: size.pageMaxWidth, paddingTop: TOP_INSET, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tripName: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  message: { fontSize: typeScale.body, color: colors.inkMuted, textAlign: "center" },
  retry: {
    minHeight: size.tapMin,
    paddingHorizontal: space.xl,
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  retryLabel: { color: colors.onAccent, fontSize: typeScale.body, fontWeight: "700" },
});
