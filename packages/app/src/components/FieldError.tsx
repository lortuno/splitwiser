import { StyleSheet, Text } from "react-native";

import { colors, space, typeScale } from "../theme";

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.owes, fontSize: typeScale.caption, marginTop: space.xs },
});
