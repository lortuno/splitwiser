import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";
import { useAfterClose } from "./afterClose";
import { Card } from "./Card";

export type LeaveAction = "settings" | "logOut";

/**
 * "Discard your changes?" before the app menu leaves a form with unsaved input. The primary button names what was
 * tapped and runs it once the dialog has closed; "Keep editing", tapping outside or Escape (Android: back) closes the
 * dialog and keeps the input.
 */
export function DiscardDialog({
  action,
  onClose,
  onDiscard,
}: {
  action: LeaveAction | null;
  onClose: () => void;
  onDiscard: (action: LeaveAction) => void;
}) {
  const afterClose = useAfterClose();
  const discard = () => {
    if (action !== null) {
      afterClose.later(() => onDiscard(action));
    }
    onClose();
  };
  return (
    <Modal visible={action !== null} transparent animationType="none" onRequestClose={onClose} onDismiss={afterClose.onDismiss}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="none" importantForAccessibility="no" />
      <View style={styles.center} pointerEvents="box-none">
        <Card style={styles.card}>
          <View accessibilityRole="alert" accessibilityLabel={t("discard.title")}>
            <Text style={styles.title}>{t("discard.title")}</Text>
            <Text style={styles.body}>{t("discard.body")}</Text>
          </View>
          <Pressable
            onPress={discard}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{t(action === "settings" ? "discard.openSettings" : "discard.logOut")}</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryLabel}>{t("discard.keep")}</Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop },
  center: { flex: 1, justifyContent: "center", padding: space.lg },
  card: { gap: space.sm },
  title: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink, marginBottom: space.xs },
  body: { fontSize: typeScale.body, color: colors.inkMuted, marginBottom: space.sm },
  primary: { minHeight: size.tapPrimary, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: colors.onAccent, fontSize: typeScale.body, fontWeight: "700" },
  secondary: {
    minHeight: size.tapMin,
    borderRadius: radius.sm,
    borderWidth: size.border,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { color: colors.accent, fontSize: typeScale.body, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});
