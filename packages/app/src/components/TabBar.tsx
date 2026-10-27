import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { colors, font, radius, space, touchTarget } from "../theme";

export type Screen = "trip" | "balances" | "add";

export function TabBar({ current, onChange }: { current: Screen; onChange: (screen: Screen) => void }) {
  const tab = (screen: Screen, label: string) => (
    <Pressable
      key={screen}
      onPress={() => onChange(screen)}
      accessibilityRole="tab"
      accessibilityState={{ selected: current === screen }}
      style={[styles.tab, current === screen && styles.activeTab]}
    >
      <Text style={[styles.tabLabel, current === screen && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tab("trip", t("tabs.expenses"))}
      {tab("balances", t("tabs.balances"))}
      <Pressable onPress={() => onChange("add")} accessibilityRole="button" style={styles.add}>
        <Text style={styles.addLabel}>{t("tabs.add")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  activeTab: { backgroundColor: colors.primarySoft },
  tabLabel: { fontSize: font.body, color: colors.muted },
  activeLabel: { color: colors.primary, fontWeight: "700" },
  add: {
    flex: 1.4,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  addLabel: { fontSize: font.body, color: colors.primaryText, fontWeight: "700" },
});
