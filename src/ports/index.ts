/**
 * Ports — the interfaces the domain and application layers depend on. Adapters
 * in `platform/*` implement them. This barrel is the one place modules import
 * their outbound contracts from, so no module ever reaches into `platform/`.
 */
export * from "./rts.js";
export * from "./slack.js";
export * from "./mcp.js";
export * from "./ai.js";
