import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { LANGUAGES, t, type Language } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";

/**
 * The app language as a dropdown: a button with the current language ("English ▾") opens a menu of the three
 * languages, each named in its own language. Picking one, tapping outside or Escape closes the menu.
 */
export function LanguagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
}) {
  const button = useRef<ComponentRef<typeof Pressable>>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const current = LANGUAGES.find((language) => language.code === value)!;

  function open() {
    button.current?.measureInWindow((x, y, _width, height) => setAnchor({ x, y: y + height + space.xs }));
  }

  function choose(language: Language) {
    setAnchor(null);
    onChange(language);
  }

  return (
    <>
      <Pressable
        ref={button}
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t("settings.languageCurrent", { language: current.name })}
        accessibilityState={{ expanded: anchor !== null, disabled }}
        style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonPressed]}
      >
        <Text style={styles.label}>{current.name}</Text>
        <Text style={styles.label}>▾</Text>
      </Pressable>
      <Modal visible={anchor !== null} transparent animationType="none" onRequestClose={() => setAnchor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAnchor(null)} accessibilityRole="none" importantForAccessibility="no" />
        {anchor !== null && (
          <View style={[styles.menu, { left: anchor.x, top: anchor.y }]} accessibilityRole="radiogroup" accessibilityLabel={t("settings.language")}>
            {LANGUAGES.map((language) => (
              <Pressable
                key={language.code}
                onPress={() => choose(language.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: value === language.code }}
                aria-checked={value === language.code}
                style={[styles.option, value === language.code && styles.optionActive]}
              >
                <Text style={[styles.label, value === language.code && styles.labelActive]}>{language.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    minHeight: size.tapMin,
    width: size.menuWidth,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: size.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  buttonPressed: { opacity: 0.7 },
  backdrop: StyleSheet.absoluteFill,
  menu: {
    position: "absolute",
    width: size.menuWidth,
    borderRadius: radius.sm,
    borderWidth: size.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  option: { minHeight: size.tapMin, justifyContent: "center", paddingHorizontal: space.md },
  optionActive: { backgroundColor: colors.accent },
  label: { fontSize: typeScale.body, color: colors.ink },
  labelActive: { color: colors.onAccent, fontWeight: "700" },
});
