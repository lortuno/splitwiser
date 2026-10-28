import { StyleSheet, View } from "react-native";

import { LANGUAGES, t, type Language } from "../i18n";
import { colors, size, space } from "../theme";
import { LanguagePicker, type MenuAction } from "./LanguagePicker";

/**
 * The bar on top of every screen but the first "Loading…": one menu with the current language ("English ▾"). It lists
 * the three languages and, once logged in, `actions` ("Settings", "Log out").
 */
export function AppBar({ language, onLanguage, actions }: { language: Language; onLanguage: (language: Language) => void; actions: MenuAction[] }) {
  const name = LANGUAGES.find((l) => l.code === language)!.name;
  return (
    <View style={styles.bar}>
      <LanguagePicker value={language} onChange={onLanguage} label={t("menu.button", { language: name })} actions={actions} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: size.tapMin,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    backgroundColor: colors.paper,
    borderBottomWidth: size.border,
    borderBottomColor: colors.line,
  },
});
