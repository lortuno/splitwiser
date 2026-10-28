// Words an API error in the current language. The API sends a stable code (and params for the numbers in it); the
// app owns all wording, so one key serves every field with the same error. The API's English message is only the
// last fallback, for a code the app does not know yet.
import type { FieldError, SplitType } from "../dto";
import { formatBasisPoints, formatCents } from "../money/format";
import { t } from "./index";

/** Fields where the person chooses people, so "required" means "choose someone", not "fill in". */
const PERSON_FIELDS = ["paid_by", "split", "recorded_by"];
const EXAMPLE_EMAIL = "ana@example.com";

/**
 * The text for the error on `field` (a FieldErrors key such as "name", "paid_by.12" or "people.3.email").
 * `splitType` words a split value error by the kind of value expected.
 */
export function errorText(error: FieldError | undefined, field: string, splitType?: SplitType): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  const base = field.split(".")[0];
  const params = error.params ?? {};
  switch (error.code) {
    case "required":
      return t(PERSON_FIELDS.includes(base) ? "error.choosePerson" : "error.required");
    case "too_long":
      return t("error.tooLong", { max: params.max });
    case "too_short":
      return t("error.tooShort", { min: params.min });
    case "too_many":
      return t("error.tooMany", { max: params.max });
    case "invalid_date":
      return t("error.invalidDate");
    case "before_start":
      return t("error.beforeStart");
    case "invalid_amount":
      return t("error.invalidAmount");
    case "too_large":
      return t("error.tooLarge");
    case "invalid_email":
      return t("error.invalidEmail", { example: EXAMPLE_EMAIL });
    case "taken":
      return t("error.taken");
    case "too_few":
      return t("error.tooFew");
    case "duplicate":
    case "duplicate_email":
      return t(base === "people" ? "error.alreadyOnTrip" : "error.invalid");
    case "sum_mismatch":
      return params.sum_basis_points !== undefined
        ? t("error.percentMismatch", {
            sum: formatBasisPoints(params.sum_basis_points),
            total: formatBasisPoints(params.total_basis_points ?? 0),
          })
        : t("error.sumMismatch", { sum: formatCents(params.sum_cents ?? 0), amount: formatCents(params.amount_cents ?? 0) });
    case "invalid_value":
      return t(splitType === "percentage" ? "add.invalidPercent" : splitType === "shares" ? "add.invalidShares" : "error.invalidAmount");
    case "invalid_credentials":
      return t("auth.wrongCredentials");
    case "trip_paid":
      return t("add.tripPaid");
    case "not_a_member":
    case "invalid_type":
    case "invalid_category":
    case "invalid_language":
      return t("error.invalid");
    default:
      return error.message;
  }
}
