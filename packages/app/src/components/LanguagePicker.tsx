import { Pressable, StyleSheet, Text, View } from "react-native";

import { LANGUAGES, type Language } from "../i18n";
import { colors, radius, size, typeScale } from "../theme";

/** The three app languages as one segmented control, each named in its own language. */
export function LanguagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup">
      {LANGUAGES.map((language) => (
        <Pressable
          key={language.code}
          onPress={() => onChange(language.code)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === language.code, disabled }}
          aria-checked={value === language.code}
          style={[styles.segment, value === language.code && styles.segmentActive]}
        >
          <Text style={[styles.label, value === language.code && styles.labelActive]}>{language.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: "row", borderRadius: radius.sm, borderWidth: size.border, borderColor: colors.line, overflow: "hidden" },
  segment: { flex: 1, minHeight: size.tapMin, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  segmentActive: { backgroundColor: colors.accent },
  label: { fontSize: typeScale.body, color: colors.ink },
  labelActive: { color: colors.onAccent, fontWeight: "700" },
});
