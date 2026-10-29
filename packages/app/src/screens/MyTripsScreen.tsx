import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { API_URL } from "../api/client";
import { getDebts } from "../api/auth";
import { listTrips } from "../api/trips";
import { Card } from "../components/Card";
import { Money } from "../components/Money";
import { StateMessage } from "../components/StateMessage";
import type { Debts, Trip, User } from "../dto";
import { t } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";
import { dateRange } from "../trips/dates";
import { filteredGroups, positionOf, splitByPaid, type DebtFilter, type Position } from "../trips/myGroups";
import { authStyles } from "./LoginScreen";

export function MyTripsScreen({
  user,
  onOpenTrip,
  onNewTrip,
}: {
  user: User;
  onOpenTrip: (tripId: number) => void;
  onNewTrip: () => void;
}) {
  const [data, setData] = useState<{ trips: Trip[]; debts: Debts } | null>(null);
  const [failed, setFailed] = useState(false);
  // Both start off whenever the screen opens (it is mounted again after a group or another screen).
  const [filter, setFilter] = useState<DebtFilter | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setData(null);
    try {
      const [trips, debts] = await Promise.all([listTrips(), getDebts()]);
      setData({ trips, debts });
    } catch {
      // A 401 is handled by the app shell (back to Login); anything else is shown here.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFilter = (pressed: DebtFilter) => setFilter((current) => (current === pressed ? null : pressed));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {t("trips.title")}
        </Text>
      </View>
      {data === null ? (
        failed ? (
          <StateMessage message={t("common.loadFailed", { url: API_URL })} action={{ label: t("app.retry"), onPress: load }} />
        ) : (
          <StateMessage message={t("app.loading")} loading />
        )
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          <Text style={styles.loggedInAs}>{t("trips.loggedInAs", { name: user.display_name })}</Text>
          {data.trips.length === 0 ? (
            <Card>
              <Text style={styles.empty}>{t("trips.empty")}</Text>
            </Card>
          ) : (
            <>
              <Summary debts={data.debts} filter={filter} onToggle={toggleFilter} />
              {filter === null ? (
                <AllGroups
                  trips={data.trips}
                  debts={data.debts}
                  paidOpen={paidOpen}
                  onTogglePaid={() => setPaidOpen((open) => !open)}
                  onOpenTrip={onOpenTrip}
                />
              ) : (
                <FilteredGroups trips={data.trips} debts={data.debts} filter={filter} onOpenTrip={onOpenTrip} />
              )}
            </>
          )}
        </ScrollView>
      )}
      {data !== null && (
        <View style={authStyles.footer}>
          <Pressable
            onPress={onNewTrip}
            accessibilityRole="button"
            style={({ pressed }) => [authStyles.primary, pressed && authStyles.primaryPressed]}
          >
            <Text style={authStyles.primaryLabel}>{t("trips.newTrip")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** "I owe" and "I'm owed" over the open groups; each half switches its filter on and off. */
function Summary({ debts, filter, onToggle }: { debts: Debts; filter: DebtFilter | null; onToggle: (filter: DebtFilter) => void }) {
  const halves = [
    { key: "owe" as const, label: t("debts.owe"), cents: debts.owe_cents, tone: styles.owes },
    { key: "owed" as const, label: t("debts.owed"), cents: debts.owed_cents, tone: styles.owed },
  ];
  return (
    <View style={styles.summary}>
      {halves.map((half) => {
        const selected = filter === half.key;
        return (
          <Pressable
            key={half.key}
            onPress={() => onToggle(half.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.half, selected && styles.halfSelected, pressed && styles.cardPressed]}
          >
            <Text style={styles.halfLabel} numberOfLines={1}>
              {half.label}
              {selected ? " ✓" : ""}
            </Text>
            <Money cents={half.cents} style={[styles.halfAmount, half.tone]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function AllGroups({
  trips,
  debts,
  paidOpen,
  onTogglePaid,
  onOpenTrip,
}: {
  trips: Trip[];
  debts: Debts;
  paidOpen: boolean;
  onTogglePaid: () => void;
  onOpenTrip: (tripId: number) => void;
}) {
  const { open, paid } = splitByPaid(trips);
  return (
    <View style={styles.cards}>
      {open.map((trip) => (
        <TripCard key={trip.id} trip={trip} position={positionOf(trip, debts)} onPress={() => onOpenTrip(trip.id)} />
      ))}
      {paid.length > 0 && (
        <Pressable
          onPress={onTogglePaid}
          accessibilityRole="button"
          accessibilityState={{ expanded: paidOpen }}
          style={({ pressed }) => [styles.paidRow, pressed && styles.cardPressed]}
        >
          <Text style={styles.paidRowLabel}>{t("trips.paidGroups", { count: paid.length })}</Text>
          <Text style={styles.paidRowLabel}>{paidOpen ? "▾" : "▸"}</Text>
        </Pressable>
      )}
      {paidOpen && paid.map((trip) => <TripCard key={trip.id} trip={trip} position={null} onPress={() => onOpenTrip(trip.id)} />)}
    </View>
  );
}

function FilteredGroups({
  trips,
  debts,
  filter,
  onOpenTrip,
}: {
  trips: Trip[];
  debts: Debts;
  filter: DebtFilter;
  onOpenTrip: (tripId: number) => void;
}) {
  const groups = filteredGroups(trips, debts, filter);
  return (
    <View style={styles.cards}>
      <Text style={styles.filterHeading}>{t(filter === "owe" ? "debts.oweHeading" : "debts.owedHeading")}</Text>
      {groups.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{t(filter === "owe" ? "debts.oweEmpty" : "debts.owedEmpty")}</Text>
        </Card>
      ) : (
        groups.map(({ trip, transfers }) => (
          <Pressable
            key={trip.id}
            onPress={() => onOpenTrip(trip.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.name} numberOfLines={2}>
              {trip.name}
            </Text>
            {transfers.map((transfer) => (
              <View key={transfer.person.id} style={styles.totalRow}>
                <Text style={styles.transferLabel} numberOfLines={2}>
                  {t(transfer.direction === "pay" ? "debts.youPay" : "debts.paysYou", { name: transfer.person.name })}
                </Text>
                <Money cents={transfer.amount_cents} style={[styles.total, filter === "owe" ? styles.owes : styles.owed]} />
              </View>
            ))}
          </Pressable>
        ))
      )}
    </View>
  );
}

function TripCard({ trip, position, onPress }: { trip: Trip; position: Position | null; onPress: () => void }) {
  const dates = dateRange(trip);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={2}>
          {trip.name}
        </Text>
        {trip.paid && <Text style={styles.paid}>{t("common.paid")}</Text>}
      </View>
      {dates !== null && <Text style={styles.dates}>{dates}</Text>}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t("trips.total")}</Text>
        <Money cents={trip.total_cents} style={styles.total} />
      </View>
      {position !== null &&
        (position.kind === "settled" ? (
          <Text style={styles.totalLabel}>{t("balances.settledNet")}</Text>
        ) : (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t(position.kind === "owe" ? "debts.youOwe" : "debts.youreOwed")}</Text>
            <Money cents={position.cents} style={[styles.total, position.kind === "owe" ? styles.owes : styles.owed]} />
          </View>
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: size.tapMin,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { flexShrink: 1, fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  list: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xl },
  loggedInAs: { fontSize: typeScale.caption, color: colors.inkMuted, marginBottom: space.md },
  empty: { fontSize: typeScale.body, color: colors.ink },
  cards: { gap: space.sm },
  summary: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  half: {
    flex: 1,
    minHeight: size.tapMin,
    padding: space.md,
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  halfSelected: { borderWidth: 2, borderColor: colors.accent },
  halfLabel: { fontSize: typeScale.caption, fontWeight: "700", color: colors.ink },
  halfAmount: { alignSelf: "flex-end", fontSize: typeScale.body, fontWeight: "700" },
  owes: { color: colors.owes },
  owed: { color: colors.owed },
  filterHeading: { fontSize: typeScale.caption, color: colors.inkMuted },
  transferLabel: { flex: 1, fontSize: typeScale.body, color: colors.ink },
  paidRow: {
    minHeight: size.tapMin,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.sm,
  },
  paidRowLabel: { fontSize: typeScale.body, fontWeight: "700", color: colors.inkMuted },
  card: {
    minHeight: size.tapMin,
    padding: space.lg,
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardPressed: { backgroundColor: colors.accentSoft },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  name: { flex: 1, fontSize: typeScale.body, fontWeight: "700", color: colors.ink },
  paid: {
    flexShrink: 0,
    fontSize: typeScale.caption,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    overflow: "hidden",
  },
  dates: { fontSize: typeScale.caption, color: colors.inkMuted },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  totalLabel: { fontSize: typeScale.body, color: colors.inkMuted },
  total: { flexShrink: 0, fontSize: typeScale.body, fontWeight: "700" },
});
