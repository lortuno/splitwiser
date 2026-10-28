import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { logIn } from "../api/auth";
import { API_URL, ApiError } from "../api/client";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import type { User } from "../dto";
import { t } from "../i18n";
import { colors, radius, size, space, typeScale } from "../theme";

export function LoginScreen({
  sessionEnded,
  onLoggedIn,
  onSignUp,
}: {
  /** Shows "Your session has ended" after a 401 while logged in. */
  sessionEnded: boolean;
  onLoggedIn: (user: User) => void;
  onSignUp: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await logIn(email, password));
    } catch (e) {
      setError(e instanceof ApiError && e.code === "invalid_credentials" ? t("auth.wrongCredentials") : t("common.loadFailed", { url: API_URL }));
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("auth.appName")}</Text>
        <Text style={styles.intro}>{t("auth.loginIntro")}</Text>
        {sessionEnded && <Text style={styles.info}>{t("auth.sessionEnded")}</Text>}
        <TextField
          label={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          onSubmitEditing={submit}
        />
        <TextField
          label={t("auth.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
        {error !== null && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          </Card>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, (pressed || busy) && styles.primaryPressed]}
        >
          <Text style={styles.primaryLabel}>{busy ? t("auth.loggingIn") : t("auth.logIn")}</Text>
        </Pressable>
        <Pressable onPress={onSignUp} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkLabel}>{t("auth.toSignUp")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Shared by LoginScreen and SignUpScreen: form at the top, primary action at the bottom in thumb reach.
export const authStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg },
  title: { fontSize: typeScale.display, fontWeight: "700", color: colors.ink, marginBottom: space.xs },
  titleSpaced: { marginBottom: space.xl },
  intro: { fontSize: typeScale.body, color: colors.inkMuted, marginBottom: space.xl },
  info: { fontSize: typeScale.caption, color: colors.inkMuted, marginBottom: space.lg },
  errorCard: { backgroundColor: colors.owesSoft, borderColor: colors.owesSoft },
  errorText: { fontSize: typeScale.body, color: colors.owes },
  footer: {
    padding: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  primary: { minHeight: size.tapPrimary, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  primaryPressed: { opacity: 0.7 },
  primaryLabel: { color: colors.onAccent, fontSize: typeScale.body, fontWeight: "700" },
  link: { minHeight: size.tapMin, justifyContent: "center", alignItems: "center" },
  linkLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
  back: { minHeight: size.tapMin, justifyContent: "center", alignSelf: "flex-start" },
});

const styles = authStyles;
