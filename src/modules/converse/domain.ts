/**
 * Conversation — the fallback that makes Tempo an agent instead of a menu.
 *
 * Before this existed, `routeIntent()` matched seven regexes and dropped
 * everything else onto a static help card. So "hi", "who are you?", "thanks",
 * and — worst of all — "I'm completely overwhelmed" all returned a feature list.
 * For a product about cognitive load and burnout, answering distress with a menu
 * is the single most off-brand thing it could do.
 *
 * This module handles everything else the user might say, in Tempo's voice, and
 * routes back into the product when there's something it can actually do.
 */

import { z } from "zod";

export const ChatSchema = z.object({
  /** The reply, in Tempo's voice. Plain language, short sentences. */
  reply: z.string(),
  /**
   * True when the user is expressing real strain (overwhelm, burnout, anxiety,
   * "I can't keep up"). Drives a gentler card and a concrete offer of help.
   * NOT a clinical signal — it only changes tone and which buttons are shown.
   */
  supportive: z.boolean(),
  /** An action Tempo can genuinely take right now, if one fits. */
  suggest: z.enum(["triage", "commitments", "focus", "catchup", "decode", "none"]),
});

export type ChatReply = z.infer<typeof ChatSchema>;

/**
 * The guardrails are load-bearing, not decoration.
 *
 * Tempo talks to people who are stressed, neurodivergent, or burning out. An LLM
 * that free-associates about mental health at them — diagnosing, prescribing,
 * telling them how they feel — does real harm and would sink the very claim the
 * product is built on. So the prompt is explicit about what it must not do, and
 * points the model at what Tempo can actually offer: less noise, protected time,
 * an externalised memory. Empathy backed by an action beats empathy alone.
 *
 * (Unambiguous crisis language never reaches this prompt at all — `safety.ts`
 * intercepts it first and returns fixed, human-written words.)
 */
export const system = (name: string) =>
  `You are Tempo, an executive-function co-pilot living inside Slack. You are talking to ${name}.

WHO YOU ARE
You are assistive technology for attention and memory. You help people who are neurodivergent, working in a second language, returning from leave, or simply drowning in unreads. You are calm, warm, and concrete. You are not chirpy and you never perform enthusiasm.

WHAT YOU CAN ACTUALLY DO (offer these, don't just talk):
- triage: read everything since they were last active and surface only what truly needs them
- commitments: track what they promised and what they're owed, and draft the nudge
- decode: explain what a message really means — tone, subtext, real urgency
- focus: protect a block of deep work — real Do-Not-Disturb + status
- catchup: a calm brief on what they missed

HOW YOU WRITE
Plain language. Short sentences. One idea per line. No jargon, no corporate filler, minimal emoji. Two or three sentences is usually right — you are reducing load, not adding to it.

IF THEY ARE STRUGGLING (overwhelmed, burnt out, anxious, "I can't keep up")
Set supportive: true. Then:
- Acknowledge it briefly and plainly. Do not gush.
- NEVER diagnose. NEVER give medical, clinical, or therapeutic advice. NEVER claim to be a therapist or counsellor.
- NEVER tell them how they feel, that they're "just stressed", that it will be fine, or that they should calm down.
- Do not interrogate them. You are not equipped to handle the answers.
- Offer ONE concrete thing you can do right now to make the day smaller — protect a focus block, cut the firehose down to the few things that matter, take the remembering off their plate. That is real help, not a platitude.

SUGGEST
Set "suggest" to the one capability that genuinely fits what they said, or "none" if nothing does. Never invent a capability you don't have; if they ask for something outside the list, say so plainly and tell them what you can do instead.`;

/**
 * Deterministic mock — the zero-credential path and the test oracle.
 * Mirrors the live behaviour closely enough that `npm run demo` tells the truth.
 */
export function mockChat(input: string): ChatReply {
  const t = input.toLowerCase().trim();

  // Suffixes matter: a bare `\boverwhelm\b` misses "overwhelmed", which is the
  // way literally everyone writes it. (Same trap as `self-harm` vs
  // `self-harming` in safety.ts — word boundaries are a liability with English
  // inflection, and both times the test caught it.)
  const strained =
    /\b(overwhelm\w*|burn(t|ed)?[\s-]?out|drown\w*|can'?t keep up|too much|exhaust\w*|anxious|anxiety|stress\w*|crush\w*|falling behind|failing|swamped|underwater)\b/.test(
      t,
    );
  if (strained) {
    return {
      reply:
        "That sounds genuinely heavy, and I'm not going to pretend a Slack app fixes it.\n\n" +
        "What I *can* do is make today smaller. Let me cut everything since you were last active down to the two or three things that actually need you — the rest can wait, and I'll remember it so you don't have to.\n\n" +
        "Or if you'd rather just have quiet: say *block 2 hours* and I'll turn on Do-Not-Disturb and hold the line.",
      supportive: true,
      suggest: "triage",
    };
  }

  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t)) {
    return {
      reply:
        "Hey. I'm Tempo — I keep track of your Slack so you don't have to hold it all in your head.\n\n" +
        "Want me to look at what needs you today?",
      supportive: false,
      suggest: "triage",
    };
  }

  if (/\b(who are you|what are you|about you)\b/.test(t)) {
    return {
      reply:
        "I'm Tempo, an executive-function co-pilot for Slack.\n\n" +
        "I triage the firehose down to what actually needs you, remember the promises you made and are owed, explain what messages really mean, and protect your focus. I read live and store nothing.",
      supportive: false,
      suggest: "triage",
    };
  }

  if (/\b(store|storing|privacy|data|keep|remember about me)\b/.test(t)) {
    return {
      reply:
        "I never store what I read. I search Slack live with your own token, use it to answer, and discard it.\n\n" +
        "What I do keep: your settings, the commitments you asked me to track, and counts. You can see all of it, export it, or delete it from the privacy dashboard.",
      supportive: false,
      suggest: "none",
    };
  }

  if (/\b(thanks|thank you|cheers|ta)\b/.test(t)) {
    return { reply: "Any time. I'm here when you need me.", supportive: false, suggest: "none" };
  }

  return {
    reply:
      "I'm not sure I can help with that one directly — I'm an executive-function co-pilot, so I stick to your Slack: triage, commitments, tone, focus, and catching you up.\n\n" +
      "Want me to check what needs you today?",
    supportive: false,
    suggest: "triage",
  };
}
