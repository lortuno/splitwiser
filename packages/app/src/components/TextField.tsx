import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radius, size, space, typeScale } from "../theme";
import { FieldError } from "./FieldError";

/** A labelled text input with its error below, for the login and sign-up forms. */
export function TextField({ label, error, ...input }: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error !== undefined && styles.inputError]}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={label}
        {...input}
      />
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.lg },
  label: { fontSize: typeScale.caption, color: colors.ink, fontWeight: "700", marginBottom: space.xs },
  input: {
    minHeight: size.tapMin,
    borderWidth: size.border,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    fontSize: typeScale.body,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.owes, backgroundColor: colors.owesSoft },
});
