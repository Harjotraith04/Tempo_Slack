/**
 * The ONE source of truth for Tempo's OAuth scopes — least-privilege, audited.
 *
 * Every scope is declared here with the token it belongs to, a plain-language
 * justification, and the exact Web API method or event that needs it. The OAuth
 * authorize URL (`buildAuthorizeUrl`) and `manifest.json` both derive from this,
 * and `scopes.test.ts` asserts the manifest matches — so the three can never
 * drift, and Marketplace's "request only what you use" rule is enforced by CI.
 *
 * Token split (verified against the code): RTS + the user's own write-actions
 * (dnd / status / canvas / list / reminder) run on the USER token; the bot's
 * assistant/message/file/bookmark surfaces run on the BOT token.
 */

export interface ScopeSpec {
  scope: string;
  token: "user" | "bot";
  /** Why Tempo needs it (shown in the Marketplace scope justification). */
  why: string;
  /** The Web API method or event subscription that requires it. */
  usedBy: string;
}

export const SCOPES: ScopeSpec[] = [
  // ── RTS grounding (user token) ─────────────────────────────────────────────
  { scope: "search:read.public", token: "user", why: "Ground triage/ledger/re-entry in the user's own public-channel history — live, never stored.", usedBy: "assistant.search.context" },
  { scope: "search:read.private", token: "user", why: "Same grounding across the private channels the user is in.", usedBy: "assistant.search.context" },
  { scope: "search:read.im", token: "user", why: "Include the user's DMs when finding what needs them.", usedBy: "assistant.search.context" },
  { scope: "search:read.mpim", token: "user", why: "Include group DMs in grounding.", usedBy: "assistant.search.context" },
  { scope: "search:read.files", token: "user", why: "Surface file-share context relevant to commitments.", usedBy: "assistant.search.context" },
  { scope: "search:read.users", token: "user", why: "Resolve sender identity/title for tone + urgency grounding.", usedBy: "assistant.search.context" },
  // ── The user's own write-actions (user token) ──────────────────────────────
  { scope: "dnd:write", token: "user", why: "Protect a focus block by snoozing the user's own notifications.", usedBy: "dnd.setSnooze" },
  { scope: "users.profile:write", token: "user", why: "Set the user's focus status (\"🎯 Focusing — back at 3:30\").", usedBy: "users.profile.set" },
  { scope: "canvases:write", token: "user", why: "Create/refresh the user's personal Tempo Canvas command center.", usedBy: "canvases.create / canvases.edit" },
  { scope: "lists:write", token: "user", why: "Mirror the Commitment Ledger to a native Slack List.", usedBy: "slackLists.create / slackLists.items.create" },
  { scope: "reminders:write", token: "user", why: "Set a native reminder so a commitment doesn't slip.", usedBy: "reminders.add" },
  // ── Bot surfaces (bot token) ───────────────────────────────────────────────
  { scope: "assistant:write", token: "bot", why: "Drive the Assistant pane — status, suggested prompts, threaded replies.", usedBy: "assistant.threads.setStatus / setSuggestedPrompts" },
  { scope: "chat:write", token: "bot", why: "Post drafts, ephemeral confirmations, and the morning digest.", usedBy: "chat.postMessage / postEphemeral / scheduleMessage" },
  { scope: "im:write", token: "bot", why: "Open a DM to deliver the digest and read-aloud audio.", usedBy: "conversations.open" },
  { scope: "im:history", token: "bot", why: "Receive the user's messages to the Assistant pane.", usedBy: "event: message.im" },
  { scope: "commands", token: "bot", why: "Handle the /tempo slash command.", usedBy: "command: /tempo" },
  { scope: "app_mentions:read", token: "bot", why: "Respond when @-mentioned.", usedBy: "event: app_mention" },
  { scope: "files:write", token: "bot", why: "DM the read-aloud audio file to users who enable it.", usedBy: "files.uploadV2" },
  { scope: "bookmarks:write", token: "bot", why: "Pin a channel bookmark to the user's Tempo Canvas.", usedBy: "bookmarks.add" },
];

export const USER_SCOPES: string[] = SCOPES.filter((s) => s.token === "user").map((s) => s.scope);
export const BOT_SCOPES: string[] = SCOPES.filter((s) => s.token === "bot").map((s) => s.scope);
