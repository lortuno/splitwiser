import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, size, space, typeScale } from "../theme";

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.tapMin,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: size.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  label: { fontSize: typeScale.body, color: colors.ink },
  selectedLabel: { color: colors.onAccent, fontWeight: "600" },
});
