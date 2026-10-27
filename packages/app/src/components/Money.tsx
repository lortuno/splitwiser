import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { formatCents, formatCentsCompact, formatSignedCents } from "../money/format";
import { colors } from "../theme";

/** Displays cents from the API; signed=true adds +/- and colours the amount, compact=true shows millions in short form (see formatCentsCompact). */
export function Money({
  cents,
  signed = false,
  compact = false,
  style,
}: {
  cents: number;
  signed?: boolean;
  compact?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const tone = !signed || cents === 0 ? null : cents > 0 ? styles.positive : styles.negative;
  const text = signed ? formatSignedCents(cents) : compact ? formatCentsCompact(cents) : formatCents(cents);
  return <Text style={[styles.money, tone, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  money: { fontVariant: ["tabular-nums"], color: colors.ink },
  positive: { color: colors.owed },
  negative: { color: colors.owes },
});
