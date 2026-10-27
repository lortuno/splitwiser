import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { formatCents, formatSignedCents } from "../money/format";
import { colors } from "../theme";

/** Displays cents from the API; signed=true adds +/- and colours the amount. */
export function Money({ cents, signed = false, style }: { cents: number; signed?: boolean; style?: StyleProp<TextStyle> }) {
  const tone = !signed || cents === 0 ? null : cents > 0 ? styles.positive : styles.negative;
  return <Text style={[styles.money, tone, style]}>{signed ? formatSignedCents(cents) : formatCents(cents)}</Text>;
}

const styles = StyleSheet.create({
  money: { fontVariant: ["tabular-nums"], color: colors.ink },
  positive: { color: colors.owed },
  negative: { color: colors.owes },
});
