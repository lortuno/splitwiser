import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { updateMe } from "../api/auth";
import { API_URL, ApiError } from "../api/client";
import { switchLanguage } from "../api/language";
import { Card } from "../components/Card";
import { LanguagePicker } from "../components/LanguagePicker";
import { TextField } from "../components/TextField";
import type { FieldErrors, User } from "../dto";
import { getLanguage, t, type Language } from "../i18n";
import { errorText } from "../i18n/errors";
import { useUnsavedInput } from "../navigation/useUnsavedInput";
import { colors, space, typeScale } from "../theme";
import { authStyles } from "./LoginScreen";

/**
 * The account's display name (shown on every trip, saved with "Save") and app language. A language is shown and sent
 * to the account as soon as it is tapped; when that fails it stays and is sent again at the next screen change.
 */
export function SettingsScreen({
  user,
  onSaved,
  onUserChanged,
  onBack,
}: {
  user: User;
  onSaved: (user: User) => void;
  /** The account changed without leaving the screen (a recorded language). */
  onUserChanged: (user: User) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(user.display_name);
  // Field errors come from the API (422); `unreachable` covers everything else.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  useUnsavedInput(user.display_name, name);

  async function chooseLanguage(language: Language) {
    const account = await switchLanguage(language);
    if (account !== null) {
      onUserChanged(account);
    }
  }

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setUnreachable(false);
    try {
      onSaved(await updateMe({ display_name: name }));
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
        <Text style={styles.title}>{t("settings.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={authStyles.intro}>{t("settings.nameIntro")}</Text>
        <TextField
          label={t("common.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          onSubmitEditing={submit}
          error={errorText(errors.display_name, "display_name")}
        />
        <Text style={styles.label}>{t("settings.language")}</Text>
        <LanguagePicker value={getLanguage()} onChange={chooseLanguage} />
      </ScrollView>
      <View style={authStyles.footer}>
        {unreachable && (
          <Card style={[authStyles.errorCard, styles.footerCard]}>
            <Text style={authStyles.errorText} accessibilityRole="alert">
              {t("common.loadFailed", { url: API_URL })}
            </Text>
          </Card>
        )}
        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [authStyles.primary, (pressed || busy) && authStyles.primaryPressed]}
        >
          <Text style={authStyles.primaryLabel}>{busy ? t("common.saving") : t("common.save")}</Text>
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
  // Same as the TextField label above it.
  label: { fontSize: typeScale.caption, fontWeight: "700", color: colors.ink, marginTop: space.lg, marginBottom: space.xs },
  footerCard: { marginBottom: space.sm },
});
