/**
 * Onboarding — first-run detection + the welcome copy for a brand-new Tempo
 * user. Pure logic, no Slack types and no outbound ports: app.ts renders
 * `welcomeMessage()` into the Assistant pane's greeting and blockkit's
 * `onboardingBlocks()` into the App Home banner.
 */

import type { UserPrefs } from "../../ports/store.js";

/** True until the user has tapped through (or otherwise completed) onboarding. */
export function isFirstRun(prefs: UserPrefs | undefined): boolean {
  return prefs?.onboardedAt === undefined;
}

export interface AssistantPrompt {
  title: string;
  message: string;
}

export interface WelcomeMessage {
  text: string;
  prompts: AssistantPrompt[];
}

const PROMPTS: AssistantPrompt[] = [
  { title: "What needs me today?", message: "What needs me today?" },
  { title: "What did I promise?", message: "Show my open commitments." },
  { title: "Catch me up", message: "Catch me up on what I missed while I was away." },
];

const RETURNING_GREETING =
  "Hi — I'm Tempo, your working memory for Slack. I'll only ever surface what actually needs you, and I never act without your tap. What would help right now?";

const FIRST_RUN_GREETING =
  "Welcome to Tempo 👋 — your working memory for Slack. I do five things, always with your tap before I act:\n" +
  "• *Triage* the firehose down to what actually needs you\n" +
  "• Track the *commitments* you made and are owed\n" +
  "• *Decode* tone on confusing messages\n" +
  "• *Protect your focus* with real Do-Not-Disturb + calendar time\n" +
  "• *Catch you up*, calmly, after time away\n\n" +
  "Nothing I read from Slack is ever stored. Open the *Home* tab any time for your full dashboard — or try a prompt below to get started.";

/** Returning users get today's short greeting; a brand-new user gets the
 * fuller five-module explainer + privacy promise. */
export function welcomeMessage(firstRun: boolean): WelcomeMessage {
  return { text: firstRun ? FIRST_RUN_GREETING : RETURNING_GREETING, prompts: PROMPTS };
}
