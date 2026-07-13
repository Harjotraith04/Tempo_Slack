# Commands — copy-paste, in order

## Terminal

Once per terminal session (token is in your Vercel env; deliberately not committed):

    export TEMPO_MCP_SERVER_TOKEN=<paste-your-token>

The whole product, end to end, with zero credentials:

    npm run demo

Typecheck + tests + build + demo + manifest drift check:

    npm run preflight

Tempo is an MCP server — judges can run this exact command:

    curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
      -H "Authorization: Bearer $TEMPO_MCP_SERVER_TOKEN" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

## Slack — type these in the Tempo DM, in this order

    hi

    I'm completely overwhelmed this week

    what needs me today?

    decode: "No rush 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it."

    draft: "No."

    block 2 hours

## Files to open on screen

    src/modules/converse/safety.ts
    src/modules/converse/converse.test.ts
    docs/architecture.png

## Browser tabs

    https://github.com/Harjotraith04/Tempo_Slack
    https://tempo-slack.vercel.app/privacy

## Between every take

Clears DND + status so the moon icon appears fresh next time:

    npm run reset:demo
