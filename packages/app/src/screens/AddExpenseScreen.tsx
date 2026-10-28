import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../api/client";
import { createExpense, previewSplit, suggestCategory, updateExpense } from "../api/expenses";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { FieldError } from "../components/FieldError";
import { Money } from "../components/Money";
import type { Category, Expense, FieldErrors, NewExpense, Person, SplitShare, SplitType, TripSummary } from "../dto";
import { CATEGORIES, categoryLabel } from "../expenses/categories";
import { applySuggestion, emptyForm, formFromExpense } from "../expenses/expenseForm";
import { t } from "../i18n";
import { CURRENCY_SYMBOL, formatBasisPoints } from "../money/format";
import { parseEuroToCents, parsePercentToBasisPoints, parseWholeNumber } from "../money/parse";
import { colors, radius, size, space, typeScale } from "../theme";

const SPLIT_TYPES: SplitType[] = ["equal", "exact", "percentage", "shares"];

interface Props {
  tripId: number;
  members: Person[];
  defaultDate: string;
  /** Set to edit this saved expense: the form opens prefilled and saves with PUT. */
  expense?: Expense;
  onSaved: (expense: Expense, summary: TripSummary) => void;
  /** tripPaid: a save was refused because someone marked the trip as paid meanwhile. */
  onCancel: (tripPaid: boolean) => void;
}

export function AddExpenseScreen({ tripId, members, defaultDate, expense, onSaved, onCancel }: Props) {
  const [initial] = useState(() => (expense ? formFromExpense(expense) : emptyForm(members, defaultDate)));
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState(initial.date);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [payers, setPayers] = useState<number[]>(initial.payers);
  const [payerAmounts, setPayerAmounts] = useState<Record<number, string>>(initial.payerAmounts);
  const [splitType, setSplitType] = useState<SplitType>(initial.splitType);
  const [between, setBetween] = useState<number[]>(initial.between);
  const [splitValues, setSplitValues] = useState<Record<number, string>>(initial.splitValues);
  const [category, setCategory] = useState<Category>(initial.category);
  const [categoryPicked, setCategoryPicked] = useState(initial.categoryPicked);
  // Read by suggestion replies that arrive late: once a chip was tapped they are ignored.
  const categoryPickedRef = useRef(initial.categoryPicked);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState<SplitShare[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [tripPaid, setTripPaid] = useState(false);

  const amountCents = parseEuroToCents(amountText);
  const sortedPayers = members.filter((m) => payers.includes(m.id));
  const sortedBetween = members.filter((m) => between.includes(m.id));

  // With a single payer they paid the whole amount; with several, each enters what they paid.
  const paidBy = sortedPayers.map((m) => ({
    person_id: m.id,
    amount_cents: sortedPayers.length === 1 ? amountCents : parseEuroToCents(payerAmounts[m.id] ?? ""),
  }));
  const splitEntries = sortedBetween.map((m) => ({ person_id: m.id, value: parseSplitValue(splitType, splitValues[m.id] ?? "") }));

  const input: NewExpense = {
    name,
    date,
    amount_cents: amountCents,
    paid_by: paidBy,
    split: { type: splitType, between: splitEntries },
    category,
  };

  // The preview only depends on the amount and the split; the other fields get stand-in values
  // so the API calculates the split even while the rest of the form is unfinished.
  const previewKey = JSON.stringify([amountCents, input.split]);
  const previewInput = useMemo<NewExpense | null>(() => {
    if (amountCents === null || amountCents <= 0 || splitEntries.length === 0) {
      return null;
    }
    return {
      name: "Preview",
      date: defaultDate,
      amount_cents: amountCents,
      paid_by: [{ person_id: members[0].id, amount_cents: amountCents }],
      split: input.split,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  useEffect(() => {
    if (previewInput === null) {
      setPreview(null);
      setPreviewErrors({});
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      previewSplit(tripId, previewInput)
        .then((result) => {
          if (!cancelled) {
            setPreview(result.split_between);
            setPreviewErrors({});
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreview(null);
            setPreviewErrors(error instanceof ApiError ? error.fieldErrors : {});
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tripId, previewInput]);

  // The suggestion follows the name until a category is tapped (never in the edit form, which starts picked).
  // A failed request keeps the current choice without a message.
  useEffect(() => {
    if (categoryPickedRef.current) {
      return;
    }
    if (name.trim() === "") {
      setCategory((current) => applySuggestion(current, false, name, null));
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      suggestCategory(tripId, name)
        .then((result) => {
          if (!cancelled) {
            setCategory((current) => applySuggestion(current, categoryPickedRef.current, name, result.category));
          }
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tripId, name]);

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // Editing a field hides the errors the last save attempt reported for it (and its per-person entries).
  const edited = (...fields: string[]) =>
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== "form" && !fields.some((f) => key === f || key.startsWith(`${f}.`))),
      ),
    );

  const changeName = (text: string) => {
    setName(text);
    edited("name");
  };
  const pickCategory = (code: Category) => {
    categoryPickedRef.current = true;
    setCategoryPicked(true);
    setCategory(code);
    edited("category");
  };
  const changeDate = (text: string) => {
    setDate(text);
    edited("date");
  };
  const changeAmount = (text: string) => {
    setAmountText(text);
    edited("amount_cents", "paid_by", "split");
  };
  const togglePayer = (id: number) => {
    setPayers(toggle(payers, id));
    edited("paid_by");
  };
  const changePayerAmount = (id: number, text: string) => {
    setPayerAmounts({ ...payerAmounts, [id]: text });
    edited("paid_by");
  };
  const toggleBetween = (id: number) => {
    setBetween(toggle(between, id));
    edited("split");
  };
  const chooseSplitType = (type: SplitType) => {
    setSplitType(type);
    edited("split");
  };
  const changeSplitValue = (id: number, text: string) => {
    setSplitValues({ ...splitValues, [id]: text });
    edited("split");
  };

  async function save() {
    setSaving(true);
    try {
      const result = expense ? await updateExpense(tripId, expense.id, input) : await createExpense(tripId, input);
      onSaved(result.expense, result.summary);
    } catch (error) {
      if (error instanceof ApiError && error.code === "trip_paid") {
        setTripPaid(true);
        setErrors({});
      } else {
        setErrors(error instanceof ApiError ? error.fieldErrors : { form: { code: "network", message: String(error) } });
      }
    } finally {
      setSaving(false);
    }
  }

  // Errors from the last save attempt, then live split errors from the preview.
  const errorFor = (key: string) => errors[key]?.message ?? (key.startsWith("split") ? previewErrors[key]?.message : undefined);
  const localAmountError = amountText !== "" && amountCents === null ? t("add.invalidAmount") : undefined;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t(expense ? "edit.title" : "add.title")}</Text>
        <Pressable onPress={() => onCancel(tripPaid)} accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelLabel}>{t("add.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section label={t("add.name")} error={errorFor("name")}>
          <TextInput
            style={[styles.input, errorFor("name") && styles.inputError]}
            value={name}
            onChangeText={changeName}
            placeholder={t("add.namePlaceholder")}
            placeholderTextColor={colors.inkMuted}
            maxLength={120}
          />
        </Section>

        <Section
          label={t("add.category")}
          hint={t(name.trim() === "" && !categoryPicked ? "add.categoryHintEmpty" : "add.categoryHint")}
          error={errorFor("category")}
        >
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.code}
                label={`${c.icon} ${categoryLabel(c.code)}`}
                selected={category === c.code}
                onPress={() => pickCategory(c.code)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Section label={t("add.date")} error={errorFor("date")}>
              <TextInput
                style={[styles.input, errorFor("date") && styles.inputError]}
                value={date}
                onChangeText={changeDate}
                placeholder="2026-06-01"
                placeholderTextColor={colors.inkMuted}
                maxLength={10}
              />
            </Section>
          </View>
          <View style={styles.column}>
            <Section label={t("add.amount", { currency: CURRENCY_SYMBOL })} error={localAmountError ?? errorFor("amount_cents")}>
              <TextInput
                style={[styles.input, (localAmountError || errorFor("amount_cents")) && styles.inputError]}
                value={amountText}
                onChangeText={changeAmount}
                placeholder="0,00"
                placeholderTextColor={colors.inkMuted}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
            </Section>
          </View>
        </View>

        <Section label={t("add.paidBy")} hint={t("add.paidByHint")} error={errorFor("paid_by")}>
          <View style={styles.chips}>
            {members.map((m) => (
              <Chip key={m.id} label={m.name} selected={payers.includes(m.id)} onPress={() => togglePayer(m.id)} />
            ))}
          </View>
          {sortedPayers.length > 1 &&
            sortedPayers.map((m) => (
              <PersonInput
                key={m.id}
                person={m}
                value={payerAmounts[m.id] ?? ""}
                onChange={(text) => changePayerAmount(m.id, text)}
                placeholder="0,00"
                suffix={CURRENCY_SYMBOL}
                error={
                  payerAmounts[m.id] && parseEuroToCents(payerAmounts[m.id]) === null
                    ? t("add.invalidAmount")
                    : errorFor(`paid_by.${m.id}`)
                }
              />
            ))}
        </Section>

        <Section label={t("add.splitBetween")} hint={t("add.splitBetweenHint")}>
          <View style={styles.chips}>
            {members.map((m) => (
              <Chip key={m.id} label={m.name} selected={between.includes(m.id)} onPress={() => toggleBetween(m.id)} />
            ))}
          </View>
        </Section>

        <Section label={t("add.splitType")} error={errorFor("split")}>
          <View style={styles.segments} accessibilityRole="radiogroup">
            {SPLIT_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => chooseSplitType(type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: splitType === type }}
                aria-checked={splitType === type}
                style={[styles.segment, splitType === type && styles.segmentActive]}
              >
                <Text style={[styles.segmentLabel, splitType === type && styles.segmentLabelActive]}>{t(`split.${type}`)}</Text>
              </Pressable>
            ))}
          </View>
          {splitType !== "equal" &&
            sortedBetween.map((m) => (
              <PersonInput
                key={m.id}
                person={m}
                value={splitValues[m.id] ?? ""}
                onChange={(text) => changeSplitValue(m.id, text)}
                placeholder={splitType === "shares" ? "1" : "0,00"}
                suffix={splitType === "exact" ? CURRENCY_SYMBOL : splitType === "percentage" ? "%" : "×"}
                numeric={splitType === "shares"}
                error={splitValueError(splitType, splitValues[m.id] ?? "") ?? errorFor(`split.${m.id}`)}
              />
            ))}
        </Section>

        <Card style={styles.preview}>
          <Text style={styles.label}>{t("add.preview")}</Text>
          {preview === null ? (
            <Text style={styles.hint}>{t("add.previewEmpty")}</Text>
          ) : (
            preview.map((share) => (
              <View key={share.person_id} style={styles.previewRow}>
                <Text style={styles.previewName}>
                  {share.name}
                  {splitType === "percentage" && share.split_value !== null ? ` · ${formatBasisPoints(share.split_value)}` : ""}
                  {splitType === "shares" && share.split_value !== null ? ` · ${share.split_value}×` : ""}
                </Text>
                <Money cents={share.share_cents} style={styles.previewAmount} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        {tripPaid && (
          <View style={styles.tripPaid}>
            <Text style={styles.tripPaidLabel}>{t("add.tripPaid")}</Text>
          </View>
        )}
        {Object.keys(errors).length > 0 && <Text style={styles.footerError}>{errors.form?.message ?? t("add.fixErrors")}</Text>}
        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, (pressed || saving) && styles.savePressed]}
        >
          <Text style={styles.saveLabel}>{t(saving ? "add.saving" : expense ? "edit.save" : "add.save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function parseSplitValue(type: SplitType, text: string): number | null {
  switch (type) {
    case "equal":
      return null;
    case "exact":
      return parseEuroToCents(text);
    case "percentage":
      return parsePercentToBasisPoints(text);
    case "shares":
      return parseWholeNumber(text);
  }
}

function splitValueError(type: SplitType, text: string): string | undefined {
  if (type === "equal" || text === "" || parseSplitValue(type, text) !== null) {
    return undefined;
  }
  return t(type === "exact" ? "add.invalidAmount" : type === "percentage" ? "add.invalidPercent" : "add.invalidShares");
}

function Section({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
      <FieldError message={error} />
    </View>
  );
}

function PersonInput(props: {
  person: Person;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  suffix: string;
  numeric?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.personInput}>
      <View style={styles.personRow}>
        <Text style={styles.personName}>{props.person.name}</Text>
        <TextInput
          style={[styles.input, styles.personField, props.error && styles.inputError]}
          value={props.value}
          onChangeText={props.onChange}
          placeholder={props.placeholder}
          placeholderTextColor={colors.inkMuted}
          keyboardType={props.numeric ? "number-pad" : "decimal-pad"}
          inputMode={props.numeric ? "numeric" : "decimal"}
          accessibilityLabel={props.person.name}
        />
        <Text style={styles.suffix}>{props.suffix}</Text>
      </View>
      <FieldError message={props.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { fontSize: typeScale.title, fontWeight: "700", color: colors.ink },
  cancel: { minHeight: size.tapMin, justifyContent: "center", paddingHorizontal: space.sm },
  cancelLabel: { fontSize: typeScale.body, color: colors.accent, fontWeight: "600" },
  content: { padding: space.lg, paddingBottom: space.xl },
  section: { marginBottom: space.lg },
  label: { fontSize: typeScale.body, fontWeight: "700", color: colors.ink, marginBottom: space.sm },
  hint: { fontSize: typeScale.caption, color: colors.inkMuted, marginTop: -space.xs, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: {
    minHeight: size.tapMin,
    borderWidth: size.border,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    fontSize: typeScale.body,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.owes, backgroundColor: colors.owesSoft },
  twoColumns: { flexDirection: "row", gap: space.md },
  column: { flex: 1 },
  segments: { flexDirection: "row", borderRadius: radius.sm, borderWidth: size.border, borderColor: colors.line, overflow: "hidden" },
  segment: { flex: 1, minHeight: size.tapMin, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  segmentActive: { backgroundColor: colors.accent },
  segmentLabel: { fontSize: typeScale.caption, color: colors.ink },
  segmentLabelActive: { color: colors.onAccent, fontWeight: "700" },
  personInput: { marginTop: space.sm },
  personRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  personName: { flex: 1, fontSize: typeScale.body, color: colors.ink },
  personField: { width: size.fieldWidth, textAlign: "right" },
  suffix: { width: size.suffixWidth, fontSize: typeScale.body, color: colors.inkMuted },
  preview: { marginBottom: space.md },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.xs },
  previewName: { fontSize: typeScale.body, color: colors.ink },
  previewAmount: { fontSize: typeScale.body, fontWeight: "600" },
  footer: {
    padding: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerError: { color: colors.owes, fontSize: typeScale.caption, marginBottom: space.xs },
  tripPaid: { backgroundColor: colors.owesSoft, borderRadius: radius.sm, padding: space.md, marginBottom: space.sm },
  tripPaidLabel: { color: colors.owes, fontSize: typeScale.body },
  save: { minHeight: size.tapPrimary, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  savePressed: { opacity: 0.7 },
  saveLabel: { color: colors.onAccent, fontSize: typeScale.body, fontWeight: "700" },
});
