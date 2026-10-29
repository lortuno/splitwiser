import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { signUp } from "../api/auth";
import { ApiError } from "../api/client";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import type { FieldErrors, SignUpResult } from "../dto";
import { getLanguage, t } from "../i18n";
import { errorText, requestErrorText } from "../i18n/errors";
import { authStyles as styles } from "./LoginScreen";

/** Sign-up asks for a code by email; "Check your email" opens with the answer, whatever the email. */
export function SignUpScreen({ onCodeSent, onBack }: { onCodeSent: (result: SignUpResult) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Field errors come from the API (422); `failure` is the card for everything else (limits, mail, unreachable).
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      onCodeSent(await signUp(name, email, password, getLanguage()));
    } catch (e) {
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setFailure(Object.keys(fieldErrors).length === 0 ? requestErrorText(e) : null);
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
          error={errorText(errors.display_name, "display_name")}
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
          error={errorText(errors.email, "email")}
        />
        <TextField
          label={t("auth.newPassword")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={submit}
          error={errorText(errors.password, "password")}
        />
        {failure !== null && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {failure}
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
