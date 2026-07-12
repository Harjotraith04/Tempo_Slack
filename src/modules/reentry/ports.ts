/** The outbound contracts the Re-entry service depends on (see src/ports). */
export type { RtsClient, RtsMessage } from "../../ports/rts.js";
export type { LlmPort } from "../../ports/ai.js";
export { CORPUS_QUERY } from "../../ports/rts.js";
