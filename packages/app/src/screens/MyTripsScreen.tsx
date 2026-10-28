import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { API_URL } from "../api/client";
import { listTrips } from "../api/trips";
import { Card } from "../components/Card";
import { Money } from "../components/Money";
import { StateMessage } from "../components/StateMessage";
import type { Trip, User } from "../dto";
import { formatDate, t } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";
import { authStyles } from "./LoginScreen";

export function MyTripsScreen({
  user,
  onOpenTrip,
  onNewTrip,
  onYourName,
  onLogOut,
}: {
  user: User;
  onOpenTrip: (tripId: number) => void;
  onNewTrip: () => void;
  onYourName: () => void;
  onLogOut: () => void;
}) {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setTrips(await listTrips());
    } catch {
      // A 401 is handled by the app shell (back to Login); anything else is shown here.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {t("trips.title")}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onYourName} accessibilityRole="button" style={styles.headerButton}>
            <Text style={styles.headerButtonLabel}>{t("trips.yourName")}</Text>
          </Pressable>
          <Pressable onPress={onLogOut} accessibilityRole="button" style={styles.headerButton}>
            <Text style={styles.headerButtonLabel}>{t("trips.logOut")}</Text>
          </Pressable>
        </View>
      </View>
      {trips === null ? (
        failed ? (
          <StateMessage message={t("app.loadFailed", { url: API_URL })} action={{ label: t("app.retry"), onPress: load }} />
        ) : (
          <StateMessage message={t("app.loading")} loading />
        )
      ) : (
        <FlatList
          data={trips}
          style={styles.list}
          keyExtractor={(trip) => String(trip.id)}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<Text style={styles.loggedInAs}>{t("trips.loggedInAs", { name: user.display_name })}</Text>}
          ListEmptyComponent={
            <Card>
              <Text style={styles.empty}>{t("trips.empty")}</Text>
            </Card>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <TripCard trip={item} onPress={() => onOpenTrip(item.id)} />}
        />
      )}
      {trips !== null && (
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

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <Text style={styles.name} numberOfLines={2}>
        {trip.name}
      </Text>
      <Text style={styles.dates}>
        {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
      </Text>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t("trips.total")}</Text>
        <Money cents={trip.total_cents} style={styles.total} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { flexShrink: 1, fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerButton: { minHeight: size.tapMin, justifyContent: "center", paddingHorizontal: space.sm },
  headerButtonLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
  list: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xl },
  loggedInAs: { fontSize: typeScale.caption, color: colors.inkMuted, marginBottom: space.md },
  empty: { fontSize: typeScale.body, color: colors.ink },
  separator: { height: space.sm },
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
  name: { fontSize: typeScale.body, fontWeight: "700", color: colors.ink },
  dates: { fontSize: typeScale.caption, color: colors.inkMuted },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  totalLabel: { fontSize: typeScale.body, color: colors.inkMuted },
  total: { flexShrink: 0, fontSize: typeScale.body, fontWeight: "700" },
});
