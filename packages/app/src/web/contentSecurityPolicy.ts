/**
 * The web app's Content-Security-Policy (feature 8, security): scripts only from the app itself, so an injected inline
 * script cannot read the token in localStorage. react-native-web writes its styles inline, hence 'unsafe-inline' for
 * styles only. Requests may go to the app and the API. `frame-ancestors` needs a server header and is left to
 * deployment.
 */
export function contentSecurityPolicy(apiUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "object-src 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/**
 * Adds the policy as the first element of <head>, before the app renders. A meta policy is enforced from the moment it
 * is in the page; the API address comes from EXPO_PUBLIC_API_URL, which a static HTML template cannot read.
 */
export function applyContentSecurityPolicy(apiUrl: string): void {
  if (typeof document === "undefined" || document.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null) {
    return;
  }
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = contentSecurityPolicy(apiUrl);
  document.head.prepend(meta);
}
