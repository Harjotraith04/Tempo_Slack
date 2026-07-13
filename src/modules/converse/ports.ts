/** The only outbound contract conversation needs. Dependency rule: this module
 * depends on ports, never on `platform/`. */
export type { LlmPort } from "../../ports/ai.js";
