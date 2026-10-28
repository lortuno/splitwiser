import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { API_URL, ApiError } from "../api/client";
import { createTrip } from "../api/trips";
import { Card } from "../components/Card";
import { FieldError } from "../components/FieldError";
import { TextField } from "../components/TextField";
import type { CreatedTrip, FieldErrors, User } from "../dto";
import { t } from "../i18n";
import { errorText } from "../i18n/errors";
import { newTripBody, todayIso } from "../trips/newTripInput";
import { colors, radius, size, space, typeScale } from "../theme";
import { authStyles } from "./LoginScreen";

// 20 people per trip including the creator (the API checks the same limit).
const MAX_OTHERS = 19;

interface PersonCard {
  key: number;
  name: string;
  email: string;
}

export function NewTripScreen({
  user,
  onCreated,
  onBack,
}: {
  user: User;
  onCreated: (created: CreatedTrip) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [people, setPeople] = useState<PersonCard[]>([{ key: 0, name: "", email: "" }]);
  // Field errors come from the API (422); `unreachable` covers everything else.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextKey = useRef(1);
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const updatePerson = (key: number, change: Partial<PersonCard>) =>
    setPeople((current) => current.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const addPerson = () => {
    const key = nextKey.current++;
    setPeople((current) => [...current, { key, name: "", email: "" }]);
    setFocusKey(key);
  };

  // Person errors are keyed by position, so they no longer fit once a card is gone.
  const removePerson = (key: number) => {
    setPeople((current) => current.filter((p) => p.key !== key));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith("people."))));
  };

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setUnreachable(false);
    try {
      onCreated(await createTrip(newTripBody({ name, startDate, endDate, people })));
    } catch (e) {
      // A 401 is handled by the app shell (back to Login).
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setUnreachable(Object.keys(fieldErrors).length === 0);
      setBusy(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" style={authStyles.back}>
          <Text style={authStyles.linkLabel}>{t("trip.back")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("newTrip.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          label={t("newTrip.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={errorText(errors.name, "name")}
        />
        <View style={styles.dates}>
          <View style={styles.date}>
            <TextField
              label={t("newTrip.startDate")}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-06-01"
              maxLength={10}
              autoCorrect={false}
              error={errorText(errors.start_date, "start_date")}
            />
          </View>
          <View style={styles.date}>
            <TextField
              label={t("newTrip.endDate")}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-06-01"
              maxLength={10}
              autoCorrect={false}
              error={errorText(errors.end_date, "end_date")}
            />
          </View>
        </View>

        <Text style={styles.label}>{t("newTrip.people")}</Text>
        <FieldError message={errorText(errors.people, "people")} />
        <Card style={styles.person}>
          <Text style={styles.you}>{t("newTrip.you", { name: user.display_name })}</Text>
        </Card>
        {people.map((person, index) => (
          <Card key={person.key} style={styles.person}>
            <TextField
              label={t("common.name")}
              value={person.name}
              onChangeText={(value) => updatePerson(person.key, { name: value })}
              autoCapitalize="words"
              autoFocus={person.key === focusKey}
              error={errorText(errors[`people.${index}.name`], `people.${index}.name`)}
            />
            <TextField
              label={t("newTrip.personEmail")}
              value={person.email}
              onChangeText={(value) => updatePerson(person.key, { email: value })}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              error={errorText(errors[`people.${index}.email`], `people.${index}.email`)}
            />
            <Pressable onPress={() => removePerson(person.key)} accessibilityRole="button" style={styles.remove}>
              <Text style={authStyles.linkLabel}>{t("newTrip.remove")}</Text>
            </Pressable>
          </Card>
        ))}
        {people.length < MAX_OTHERS && (
          <Pressable
            onPress={addPerson}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addPerson, pressed && authStyles.primaryPressed]}
          >
            <Text style={authStyles.linkLabel}>{t("newTrip.addPerson")}</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={authStyles.footer}>
        {(unreachable || hasErrors) && (
          <Card style={[authStyles.errorCard, styles.footerCard]}>
            <Text style={authStyles.errorText} accessibilityRole="alert">
              {unreachable ? t("common.loadFailed", { url: API_URL }) : t("add.fixErrors")}
            </Text>
          </Card>
        )}
        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [authStyles.primary, (pressed || busy) && authStyles.primaryPressed]}
        >
          <Text style={authStyles.primaryLabel}>{busy ? t("newTrip.creating") : t("newTrip.create")}</Text>
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
  content: { padding: space.lg, paddingBottom: space.xl },
  dates: { flexDirection: "row", gap: space.md },
  date: { flex: 1 },
  label: { fontSize: typeScale.caption, color: colors.ink, fontWeight: "700", marginBottom: space.xs },
  person: { marginTop: space.sm },
  you: { fontSize: typeScale.body, color: colors.ink, fontWeight: "600" },
  remove: { minHeight: size.tapMin, justifyContent: "center", alignSelf: "flex-end", paddingHorizontal: space.sm },
  addPerson: {
    minHeight: size.tapMin,
    marginTop: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  footerCard: { marginBottom: space.sm },
});
