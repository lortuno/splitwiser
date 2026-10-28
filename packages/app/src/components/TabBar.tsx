import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";

export type Screen = "trip" | "balances" | "add";

/** canAdd=false (a paid trip) leaves out "+ Add expense". */
export function TabBar({ current, canAdd = true, onChange }: { current: Screen; canAdd?: boolean; onChange: (screen: Screen) => void }) {
  const tab = (screen: Screen, label: string) => (
    <Pressable
      key={screen}
      onPress={() => onChange(screen)}
      accessibilityRole="tab"
      aria-selected={current === screen}
      style={[styles.tab, current === screen && styles.activeTab]}
    >
      <Text style={[styles.tabLabel, current === screen && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tab("trip", t("tabs.trip"))}
      {tab("balances", t("tabs.balances"))}
      {canAdd && (
        <Pressable onPress={() => onChange("add")} accessibilityRole="button" style={styles.add}>
          <Text style={styles.addLabel}>{t("tabs.add")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: size.tapMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  activeTab: { backgroundColor: colors.accentSoft },
  tabLabel: { fontSize: typeScale.body, color: colors.inkMuted },
  activeLabel: { color: colors.accent, fontWeight: "700" },
  add: {
    flex: 1.4,
    minHeight: size.tapPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  addLabel: { fontSize: typeScale.body, color: colors.onAccent, fontWeight: "700" },
});
