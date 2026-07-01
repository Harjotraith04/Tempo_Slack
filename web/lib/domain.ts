/**
 * The single bridge between the web app and the shared Slack-app domain in
 * `../../src`. Every web route/page imports the domain from here, so the
 * cross-boundary import lives in one place (and `externalDir` + the
 * `.js`→`.ts` extensionAlias in next.config only have to work for this file's
 * specifiers).
 */

export { getStore } from "../../src/platform/persistence/index.js";
export { exportUserData, deleteUserData } from "../../src/application/use-cases/user-data.js";
export { applySettings } from "../../src/application/use-cases/settings.js";
export { buildAuthorizeUrl, exchangeCode } from "../../src/platform/slack/oauth/index.js";
export {
  signSession,
  verifySession,
  serializeSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
} from "../../src/shared/session.js";
export type { UserDataExport, UserPrefs } from "../../src/ports/store.js";
