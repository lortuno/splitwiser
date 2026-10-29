import { registerRootComponent } from "expo";

import { API_URL } from "./src/api/client";
import App from "./src/App";
import { applyContentSecurityPolicy } from "./src/web/contentSecurityPolicy";

// Web only (no document on iOS and Android): the Content-Security-Policy goes in before the app renders.
applyContentSecurityPolicy(API_URL);
registerRootComponent(App);
