import { StyleSheet, Text } from "react-native";

import { colors, font, space } from "../theme";

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
  error: { color: colors.negative, fontSize: font.small, marginTop: space.xs },
});
