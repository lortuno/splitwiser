import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { API_URL, ApiError } from "./api/client";
import { listExpenses } from "./api/expenses";
import { getSummary, getTrip, reopenTrip } from "./api/trips";
import { StateMessage } from "./components/StateMessage";
import { TabBar, type Screen } from "./components/TabBar";
import type { Expense, Trip, TripSummary } from "./dto";
import { t } from "./i18n";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { BalancesScreen } from "./screens/BalancesScreen";
import { MarkPaidScreen } from "./screens/MarkPaidScreen";
import { TripScreen } from "./screens/TripScreen";
import { colors, size, space, typeScale } from "./theme";
import { todayIso } from "./trips/newTripInput";

interface TripData {
  trip: Trip;
  expenses: Expense[];
  summary: TripSummary;
}

type Problem = "unreachable" | "notFound" | "notMember";

/** A screen shown over the tabs: "Edit expense" or the "Mark as paid" confirmation. */
type Overlay = { kind: "edit"; expense: Expense } | { kind: "markPaid" } | null;

/**
 * One trip with its tabs (Trip, Balances, + Add expense). A paid trip has no "+ Add expense" and its rows do not open.
 * tripId null means the link held no valid id.
 * `created` is a trip that was just created: it is shown from the create response, without loading it again.
 */
export function TripView({
  tripId,
  created,
  onBack,
}: {
  tripId: number | null;
  created?: Omit<TripData, "expenses">;
  onBack: () => void;
}) {
  const [data, setData] = useState<TripData | null>(created ? { ...created, expenses: [] } : null);
  const [problem, setProblem] = useState<Problem | null>(tripId === null ? "notFound" : null);
  const [screen, setScreen] = useState<Screen>("trip");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reopenFailed, setReopenFailed] = useState(false);

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
    if (!created) {
      void load();
    }
    // A created trip is complete already; only a different trip id loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // The create and edit responses already carry the new summary: no second request needed.
  const onSaved = (expense: Expense, summary: TripSummary) => {
    setData(
      (current) =>
        current && { ...current, expenses: insertByDate(current.expenses.filter((e) => e.id !== expense.id), expense), summary },
    );
    setOverlay(null);
    setScreen("trip");
  };

  // Leaving the form after a save was refused because the trip was marked as paid meanwhile shows the paid trip.
  const onFormCancel = (tripPaid: boolean) => {
    setOverlay(null);
    setScreen("trip");
    if (tripPaid) {
      void load();
    }
  };

  const showSummary = (summary: TripSummary) => {
    setData((current) => current && { ...current, summary });
    setOverlay(null);
    setScreen("trip");
  };

  // Reopen needs no confirmation. Someone else reopening first (409) just reloads the trip.
  const reopen = async () => {
    if (data === null) {
      return;
    }
    setReopenFailed(false);
    try {
      showSummary((await reopenTrip(data.trip.id)).summary);
    } catch (error) {
      if (error instanceof ApiError && error.code === "already_open") {
        void load();
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setScreen("trip");
        setReopenFailed(true);
      }
    }
  };

  if (data === null) {
    const toMyTrips = { label: t("app.goToMyTrips"), onPress: onBack };
    switch (problem) {
      case "notFound":
        return <StateMessage message={t("app.notFound")} action={toMyTrips} />;
      case "notMember":
        return <StateMessage message={t("app.notMember")} action={toMyTrips} />;
      case "unreachable":
        return <StateMessage message={t("common.loadFailed", { url: API_URL })} action={{ label: t("app.retry"), onPress: load }} />;
      default:
        return <StateMessage message={t("app.loading")} loading />;
    }
  }

  const paid = data.summary.paid !== null;

  if (screen === "add" || overlay?.kind === "edit") {
    const editing = overlay?.kind === "edit" ? overlay.expense : undefined;
    return (
      <AddExpenseScreen
        key={editing?.id ?? "new"}
        tripId={data.trip.id}
        members={data.trip.members ?? []}
        defaultDate={clampToTrip(todayIso(), data.trip)}
        expense={editing}
        onSaved={onSaved}
        onCancel={onFormCancel}
      />
    );
  }

  const confirming = overlay?.kind === "markPaid";

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} accessibilityRole="button" style={styles.headerButton}>
            <Text style={styles.headerButtonLabel}>{t("trip.back")}</Text>
          </Pressable>
          {!confirming && (
            <Pressable
              onPress={paid ? reopen : () => setOverlay({ kind: "markPaid" })}
              accessibilityRole="button"
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonLabel}>{t(paid ? "trip.reopen" : "common.markPaid")}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.tripName} numberOfLines={1}>
          {data.trip.name}
        </Text>
      </View>
      <View style={styles.body}>
        {confirming ? (
          <MarkPaidScreen
            tripId={data.trip.id}
            summary={data.summary}
            onPaid={showSummary}
            onConflict={() => {
              setOverlay(null);
              void load();
            }}
            onCancel={() => setOverlay(null)}
          />
        ) : screen === "trip" ? (
          <TripScreen
            trip={data.trip}
            expenses={data.expenses}
            summary={data.summary}
            notice={reopenFailed && paid ? t("common.loadFailed", { url: API_URL }) : null}
            onShowAllTransfers={() => setScreen("balances")}
            onOpenExpense={(expense) => setOverlay({ kind: "edit", expense })}
          />
        ) : (
          <BalancesScreen summary={data.summary} />
        )}
      </View>
      {!confirming && <TabBar current={screen} canAdd={!paid} onChange={setScreen} />}
    </>
  );
}

/** Today when it falls inside the trip, otherwise the nearest trip day (ISO dates compare as strings). */
function clampToTrip(date: string, trip: Trip): string {
  return date < trip.start_date ? trip.start_date : date > trip.end_date ? trip.end_date : date;
}

/** Newest date first, matching the API's order (date desc, id desc). */
function insertByDate(expenses: Expense[], expense: Expense): Expense[] {
  const index = expenses.findIndex((e) => e.date < expense.date || (e.date === expense.date && e.id < expense.id));
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  headerButton: { minHeight: size.tapMin, justifyContent: "center" },
  headerButtonLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
  tripName: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  body: { flex: 1 },
});
