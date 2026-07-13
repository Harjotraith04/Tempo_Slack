/**
 * Centralised, validated configuration for Tempo.
 *
 * Split (v2.0) into env (readers + the `config` object), modes (posture
 * predicates + startup assertions), and feature-flags. This barrel re-exports
 * everything so `import { config, isLiveRts } from "../config.js"` keeps working
 * unchanged across the codebase.
 */

export * from "./env.js";
export * from "./modes.js";
export * from "./feature-flags.js";

/** The app version, reported by the MCP server's serverInfo (what a judge's MCP
 * client displays). Kept here so it can't drift from package.json unnoticed —
 * it was hardcoded to "4.1.0" while the package said 4.2.0. */
export const VERSION = "4.2.0";
