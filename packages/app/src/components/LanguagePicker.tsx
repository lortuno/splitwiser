import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { LANGUAGES, t, type Language } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";
import { useAfterClose } from "./afterClose";

export type MenuAction = { label: string; onPress: () => void };

/**
 * The app language as a dropdown: a button with the current language ("English ▾") opens a menu of the three
 * languages, each named in its own language. Picking one, tapping outside or Escape closes the menu. The app menu
 * (`AppBar`) is the same dropdown with `actions` ("Settings", "Log out") below the languages.
 */
export function LanguagePicker({
  value,
  onChange,
  disabled = false,
  label,
  actions = [],
}: {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
  /** The button's accessible name; the language control's own name by default. */
  label?: string;
  actions?: MenuAction[];
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

  // "Settings" and "Log out" open another screen: only once the menu has closed.
  const afterClose = useAfterClose();
  function run(action: MenuAction) {
    afterClose.later(action.onPress);
    setAnchor(null);
  }

  return (
    <>
      <Pressable
        ref={button}
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? t("settings.languageCurrent", { language: current.name })}
        accessibilityState={{ expanded: anchor !== null, disabled }}
        style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonPressed]}
      >
        <Text style={styles.label}>{current.name}</Text>
        <Text style={styles.label}>▾</Text>
      </Pressable>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="none"
        onRequestClose={() => setAnchor(null)}
        onDismiss={afterClose.onDismiss}
      >
        <Pressable style={styles.backdrop} onPress={() => setAnchor(null)} accessibilityRole="none" importantForAccessibility="no" />
        {anchor !== null && (
          <View style={[styles.menu, { left: anchor.x, top: anchor.y }]}>
            <View accessibilityRole="radiogroup" accessibilityLabel={t("settings.language")}>
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
            {actions.length > 0 && <View style={styles.separator} />}
            {actions.map((action) => (
              <Pressable key={action.label} onPress={() => run(action)} accessibilityRole="menuitem" style={styles.option}>
                <Text style={styles.label}>{action.label}</Text>
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
  separator: { height: size.border, backgroundColor: colors.line },
  optionActive: { backgroundColor: colors.accent },
  label: { fontSize: typeScale.body, color: colors.ink },
  labelActive: { color: colors.onAccent, fontWeight: "700" },
});
