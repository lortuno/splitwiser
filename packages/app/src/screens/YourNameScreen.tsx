import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { updateMe } from "../api/auth";
import { API_URL, ApiError } from "../api/client";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import type { FieldErrors, User } from "../dto";
import { t } from "../i18n";
import { colors, space, typeScale } from "../theme";
import { authStyles } from "./LoginScreen";

/** Edits the account's display name, the name shown for this account on every trip. */
export function YourNameScreen({
  user,
  onSaved,
  onBack,
}: {
  user: User;
  onSaved: (user: User) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(user.display_name);
  // Field errors come from the API (422); `unreachable` covers everything else.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setUnreachable(false);
    try {
      onSaved(await updateMe(name));
    } catch (e) {
      // A 401 is handled by the app shell (back to Login).
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setUnreachable(Object.keys(fieldErrors).length === 0);
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" style={authStyles.back}>
          <Text style={authStyles.linkLabel}>{t("trip.back")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("yourName.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={authStyles.intro}>{t("yourName.intro")}</Text>
        <TextField
          label={t("yourName.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          onSubmitEditing={submit}
          error={errors.display_name?.message}
        />
      </ScrollView>
      <View style={authStyles.footer}>
        {unreachable && (
          <Card style={[authStyles.errorCard, styles.footerCard]}>
            <Text style={authStyles.errorText} accessibilityRole="alert">
              {t("app.loadFailed", { url: API_URL })}
            </Text>
          </Card>
        )}
        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [authStyles.primary, (pressed || busy) && authStyles.primaryPressed]}
        >
          <Text style={authStyles.primaryLabel}>{busy ? t("yourName.saving") : t("yourName.save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  content: { padding: space.lg },
  footerCard: { marginBottom: space.sm },
});
