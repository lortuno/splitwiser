import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { signUp } from "../api/auth";
import { API_URL, ApiError } from "../api/client";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import type { FieldErrors, User } from "../dto";
import { t } from "../i18n";
import { authStyles as styles } from "./LoginScreen";

export function SignUpScreen({ onSignedUp, onBack }: { onSignedUp: (user: User) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      onSignedUp(await signUp(name, email, password));
    } catch (e) {
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setUnreachable(Object.keys(fieldErrors).length === 0);
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.linkLabel}>{t("auth.backToLogin")}</Text>
        </Pressable>
        <Text style={[styles.title, styles.titleSpaced]}>{t("auth.signUpTitle")}</Text>
        <TextField
          label={t("auth.name")}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          error={errors.name?.message}
        />
        <TextField
          label={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          error={errors.email?.message}
        />
        <TextField
          label={t("auth.newPassword")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={submit}
          error={errors.password?.message}
        />
        {unreachable && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {t("app.loadFailed", { url: API_URL })}
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
          <Text style={styles.primaryLabel}>{busy ? t("auth.creatingAccount") : t("auth.createAccount")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
