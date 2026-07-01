/**
 * Back-compat shim — configuration now lives in `src/config/`. This keeps the
 * ~15 existing `../config.js` import sites working unchanged. See config/index.ts.
 */

export * from "./config/index.js";
