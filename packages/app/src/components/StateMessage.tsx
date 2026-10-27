import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, size, space, typeScale } from "../theme";

/** Full-screen loading or error state: a centred spinner or message, with an optional button below it. */
export function StateMessage({
  message,
  loading = false,
  action,
}: {
  message: string;
  loading?: boolean;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      {loading && <ActivityIndicator color={colors.accent} />}
      <Text style={styles.message}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  message: { fontSize: typeScale.body, color: colors.ink, textAlign: "center" },
  button: {
    minHeight: size.tapMin,
    paddingHorizontal: space.xl,
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  buttonLabel: { color: colors.onAccent, fontSize: typeScale.body, fontWeight: "700" },
});
