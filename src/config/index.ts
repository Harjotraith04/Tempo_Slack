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
