import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Platform, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";

import { getMe, logOut } from "./api/auth";
import { API_URL, ApiError, setUnauthenticatedHandler } from "./api/client";
import { applyAccountLanguage, dropPendingLanguage, savePendingLanguage, switchLanguage } from "./api/language";
import { getToken } from "./api/session";
import { AppBar } from "./components/AppBar";
import { DiscardDialog, type LeaveAction } from "./components/DiscardDialog";
import { StateMessage } from "./components/StateMessage";
import type { CreatedTrip, User } from "./dto";
import { getLanguage, setLanguage, subscribeLanguage, t, type Language } from "./i18n";
import { parseTripParam, type TripParam } from "./navigation/tripParam";
import { hasUnsavedInput, setUnsavedInput } from "./navigation/unsavedInput";
import { LoginScreen } from "./screens/LoginScreen";
import { MyTripsScreen } from "./screens/MyTripsScreen";
import { NewTripScreen } from "./screens/NewTripScreen";
import { SignUpScreen } from "./screens/SignUpScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TripView } from "./TripView";
import { colors, size } from "./theme";

type Route =
  | { kind: "starting" }
  | { kind: "unreachable" }
  | { kind: "login"; sessionEnded: boolean }
  | { kind: "signup" }
  | { kind: "trips" }
  | { kind: "newTrip" }
  | { kind: "settings" }
  | { kind: "trip"; tripId: number | null; created?: CreatedTrip };

// Only the web has a URL; iOS and Android always start on "My trips".
const IS_WEB = Platform.OS === "web";

function tripParam(): TripParam {
  return IS_WEB ? parseTripParam(window.location.search) : { kind: "default" };
}

/** Keeps `?trip={id}` in the address bar in step with the open trip (web only). */
function showTripInUrl(tripId: number | null) {
  if (IS_WEB) {
    window.history.replaceState(null, "", tripId === null ? window.location.pathname : `${window.location.pathname}?trip=${tripId}`);
  }
}

/** Where a `?trip=` link leads once someone is logged in. */
function routeFor(param: TripParam): Route {
  return param.kind === "default" ? { kind: "trips" } : { kind: "trip", tripId: param.kind === "id" ? param.id : null };
}

// Without a safe-area library, leave room for the iOS status bar / notch and the Android status bar.
const TOP_INSET = Platform.select({
  ios: size.statusBarInsetIos,
  android: StatusBar.currentHeight ?? size.statusBarInsetAndroid,
  default: 0,
});

export default function App() {
  // Every text switches at once: the whole tree re-renders when the language changes.
  useSyncExternalStore(subscribeLanguage, getLanguage);
  const [route, setRoute] = useState<Route>({ kind: "starting" });
  const [user, setUser] = useState<User | null>(null);
  // "Settings" or "Log out" tapped in the menu while a form had unsaved input: waits for "Discard your changes?".
  const [leaving, setLeaving] = useState<LeaveAction | null>(null);
  // A `?trip=` link opened while logged out: it opens right after login.
  const pendingTrip = useRef<TripParam>(tripParam());
  // On screens wider than the app column, edge lines frame it as a panel on the paper.
  const framed = useWindowDimensions().width > size.pageMaxWidth;

  const loggedIn = async (who: User) => {
    setUser(await applyAccountLanguage(who));
    setRoute(routeFor(pendingTrip.current));
    pendingTrip.current = { kind: "default" };
  };

  const start = useCallback(async () => {
    setRoute({ kind: "starting" });
    if (getToken() === null) {
      setRoute({ kind: "login", sessionEnded: false });
      return;
    }
    try {
      await loggedIn(await getMe());
    } catch (error) {
      // A 401 already switched to Login through the unauthenticated handler.
      if (!(error instanceof ApiError && error.status === 401)) {
        setRoute({ kind: "unreachable" });
      }
    }
  }, []);

  useEffect(() => {
    // Any request that carried a token and got 401: the session is over, whatever was on screen.
    setUnauthenticatedHandler(() => {
      setUser(null);
      pendingTrip.current = { kind: "default" };
      showTripInUrl(null);
      setRoute({ kind: "login", sessionEnded: true });
    });
    void start();
  }, [start]);

  const openTrip = (tripId: number) => {
    showTripInUrl(tripId);
    setRoute({ kind: "trip", tripId });
  };

  const openCreatedTrip = (created: CreatedTrip) => {
    showTripInUrl(created.trip.id);
    setRoute({ kind: "trip", tripId: created.trip.id, created });
  };

  const renamed = (who: User) => {
    setUser(who);
    setRoute({ kind: "trips" });
  };

  const changedAccount = (who: User) => setUser(who);

  const backToMyTrips = () => {
    showTripInUrl(null);
    setRoute({ kind: "trips" });
  };

  const doLogOut = async () => {
    dropPendingLanguage();
    await logOut().catch(() => undefined);
    setUser(null);
    setRoute({ kind: "login", sessionEnded: false });
  };

  const openSettings = () => {
    showTripInUrl(null);
    setRoute({ kind: "settings" });
  };

  // A language that could not be saved is sent again at every screen change.
  useEffect(() => {
    if (user !== null) {
      void savePendingLanguage().then((who) => who && setUser(who));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Logged in, a switch is saved on the account; before login it is kept on the device and recorded at login.
  const chooseLanguage = (language: Language) => {
    if (user === null) {
      setLanguage(language, { picked: true });
    } else {
      void switchLanguage(language).then((who) => who && setUser(who));
    }
  };

  const leave = (action: LeaveAction) => {
    if (hasUnsavedInput()) {
      setLeaving(action);
    } else {
      void (action === "settings" ? openSettings() : doLogOut());
    }
  };

  const discardAndLeave = (action: LeaveAction) => {
    setUnsavedInput(false);
    void (action === "settings" ? openSettings() : doLogOut());
  };

  const menuActions =
    user === null || route.kind === "login" || route.kind === "signup"
      ? []
      : [
          ...(route.kind === "settings" ? [] : [{ label: t("settings.title"), onPress: () => leave("settings") }]),
          { label: t("menu.logOut"), onPress: () => leave("logOut") },
        ];

  return (
    <View style={styles.page}>
      <View style={[styles.app, framed && styles.framed]}>
        {route.kind !== "starting" && <AppBar language={getLanguage()} onLanguage={chooseLanguage} actions={menuActions} />}
        {route.kind === "starting" ? (
          <StateMessage message={t("app.loading")} loading />
        ) : route.kind === "unreachable" ? (
          <StateMessage message={t("common.loadFailed", { url: API_URL })} action={{ label: t("app.retry"), onPress: start }} />
        ) : route.kind === "login" ? (
          <LoginScreen sessionEnded={route.sessionEnded} onLoggedIn={loggedIn} onSignUp={() => setRoute({ kind: "signup" })} />
        ) : route.kind === "signup" ? (
          <SignUpScreen onSignedUp={loggedIn} onBack={() => setRoute({ kind: "login", sessionEnded: false })} />
        ) : route.kind === "trips" && user !== null ? (
          <MyTripsScreen
            user={user}
            onOpenTrip={openTrip}
            onNewTrip={() => setRoute({ kind: "newTrip" })}
          />
        ) : route.kind === "newTrip" && user !== null ? (
          <NewTripScreen user={user} onCreated={openCreatedTrip} onBack={backToMyTrips} />
        ) : route.kind === "settings" && user !== null ? (
          <SettingsScreen user={user} onSaved={renamed} onUserChanged={changedAccount} onBack={backToMyTrips} />
        ) : route.kind === "trip" ? (
          <TripView key={route.tripId ?? "invalid"} tripId={route.tripId} created={route.created} onBack={backToMyTrips} />
        ) : null}
        <DiscardDialog action={leaving} onClose={() => setLeaving(null)} onDiscard={discardAndLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, alignItems: "center" },
  app: { flex: 1, width: "100%", maxWidth: size.pageMaxWidth, paddingTop: TOP_INSET, backgroundColor: colors.paper },
  framed: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
