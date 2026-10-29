import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { resendCode, verifyCode } from "../api/auth";
import { ApiError } from "../api/client";
import { formatCountdown } from "../auth/countdown";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import type { CodeTimes, FieldErrors, User } from "../dto";
import { getLanguage, t, tCount } from "../i18n";
import { errorText, requestErrorText } from "../i18n/errors";
import { authStyles as styles } from "./LoginScreen";

/**
 * "Check your email": after a sign-up or a login to an unverified account, the code from the email confirms the
 * account and starts the session. The app never fills in or sends the code on its own.
 */
export function VerifyEmailScreen({
  email,
  times,
  onVerified,
  onBack,
}: {
  email: string;
  /** From the response that opened the screen: the code's validity and the wait before a new one. */
  times: CodeTimes;
  onVerified: (user: User) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [codeMinutes, setCodeMinutes] = useState(times.code_minutes);
  // When "Send a new code" is enabled again (ms since epoch), and the seconds left, ticking once a second.
  const [resendAt, setResendAt] = useState(() => Date.now() + times.resend_in_seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const waitSeconds = Math.max(0, (resendAt - now) / 1000);

  useEffect(() => {
    if (resendAt <= now) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [resendAt, now]);

  async function confirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      onVerified(await verifyCode(email, code));
    } catch (e) {
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setFailure(Object.keys(fieldErrors).length === 0 ? requestErrorText(e) : null);
      setBusy(false);
    }
  }

  async function sendNewCode() {
    if (waitSeconds > 0) {
      return;
    }
    setFailure(null);
    setResent(false);
    try {
      const next = await resendCode(email, getLanguage());
      setCodeMinutes(next.code_minutes);
      setResendAt(Date.now() + next.resend_in_seconds * 1000);
      setNow(Date.now());
      setCode("");
      setErrors({});
      setResent(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "too_soon") {
        setResendAt(Date.now() + (e.params.seconds ?? 0) * 1000);
        setNow(Date.now());
      } else {
        setFailure(requestErrorText(e));
      }
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.linkLabel}>{t("auth.backToLogin")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("verify.title")}</Text>
        <Text style={styles.intro}>{tCount("verify.intro", codeMinutes, { email })}</Text>
        {resent && <Text style={styles.info}>{t("verify.resent")}</Text>}
        <TextField
          label={t("verify.code")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          onSubmitEditing={confirm}
          error={errorText(errors.code, "code")}
        />
        <Pressable
          onPress={sendNewCode}
          disabled={waitSeconds > 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: waitSeconds > 0 }}
          style={[styles.back, waitSeconds > 0 && styles.primaryPressed]}
        >
          <Text style={styles.linkLabel}>
            {waitSeconds > 0 ? t("verify.resendIn", { time: formatCountdown(waitSeconds) }) : t("verify.resend")}
          </Text>
        </Pressable>
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
          onPress={confirm}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, (pressed || busy) && styles.primaryPressed]}
        >
          <Text style={styles.primaryLabel}>{busy ? t("verify.confirming") : t("verify.confirm")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
