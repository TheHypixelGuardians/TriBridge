# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

TriBridge is a Node.js bot that bridges a Discord channel and a Hypixel guild chat. A
`discord.js` client and a `mineflayer` Minecraft bot run in the same process and relay
messages both ways; slash commands let Discord admins run guild management commands
in-game.

- CommonJS (`"type": "commonjs"`) — use `require`/`module.exports`, not ESM.
- No build step, no test suite, no linter. `npm test` is a placeholder that exits 1.
- Node v22+. Dependencies: `discord.js`, `mineflayer`, `prismarine-auth`, `dotenv`.

## Running

```bash
npm install
node src/index.js
```

Requires a `.env` (gitignored) with `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, `LOG_CHANNEL`,
`MINECRAFT_USERNAME`. First run opens a Microsoft device-code auth flow in the console;
tokens are cached in `.minecraft-auth/` (gitignored).

Running the bot connects to live Discord and Hypixel — don't start it to "verify" a change
unless the user asks. There is no offline harness.

## Architecture

`src/index.js` boots the Discord client, populates the shared `bridge` object, wires the
Discord event handler, logs in, then creates the Minecraft bot.

**`src/bridge.js`** is the single shared-state module. Both sides import it to reach each
other: `mcBot`, `discordClient`, `discordChannelId`, `logChannelId`, `mcBotConnected`,
`reconnecting`. There is no DI — new cross-client state belongs here.

**`src/handlers/eventHandler.js`** is used for *both* clients. Given a client and an events
root, each subdirectory name is treated as an event name and every file inside is invoked
in sorted filename order with `(client, ...args)`:

```
src/events/discord/<eventName>/<NNNname>.js     → discordClient.on(eventName, ...)
src/events/minecraft/<eventName>/<name>.js      → mcBot.on(eventName, ...)
```

Numeric prefixes (`001registerCommands.js`, `002autoReconnect.js`) exist only to force
ordering — keep the convention when order matters. Note the first parameter is the client
the event came from, so in `events/minecraft/**` `client` is the *mineflayer bot*, not the
Discord client; reach Discord via `bridge.discordClient`.

**Commands** live in `src/commands/<category>/<name>.js`. The category folder name becomes
a page in `/help`, so adding a folder adds a help category. Each file exports:

```js
module.exports = {
    name: 'invite',
    description: '...',
    options: [...],                 // discord.js ApplicationCommandOption objects
    permissionsRequired: [...],     // optional, PermissionFlagsBits
    botPermissions: [...],          // optional
    deleted: false,                 // optional; true unregisters the command
    callback: async (client, interaction) => { ...
    },
};
```

`001registerCommands.js` diffs local commands against the registered application commands
via `utils/areCommandsDifferent.js` and creates/edits/deletes them globally on startup.
Global command propagation can take up to an hour on Discord's side.

## Conventions

- **Permissions:** two separate systems. `permissionsRequired` is enforced generically by
  `handleCommands.js` (used for real Discord permissions like `Administrator`). Bot-admin
  gating is done *inside* the callback with `isAdmin(interaction.member)` from
  `utils/adminRoles.js`, which reads role IDs from `adminRolesConfig.json` (gitignored,
  created on demand, cached in memory). Follow the existing pattern for the command type
  you're adding.
- **Querying Hypixel:** commands that need a server response (`/invite`, `/kick`, `/send`,
  `/online`) use the same collector idiom — attach a temporary `message` listener, send the
  chat command, resolve on a ~1–1.5s idle timer with a 5s hard timeout, then always remove
  the listener and clear both timers in a `finally`. Reuse this shape rather than inventing
  a new one; forgetting to remove the listener leaks it onto the bot.
- **Minecraft text:** strip formatting with `.replace(/§./g, '')`. Use `jsonMsg.toString()`
  for plain text, `jsonMsg.toMotd()` when the color codes themselves carry meaning (e.g.
  `§a` marks online players in `/online`).
- **Guild-chat parsing** is regex against Hypixel's English chat output and is inherently
  brittle. Keep the documented format comment next to any regex you add or change.
- **Relay loops:** `relayToDiscord.js` drops messages whose author equals
  `bridge.mcBot.username`. Any new Minecraft→Discord relay must do the same.
- **Replies:** `deferReply()` first for anything touching the Minecraft bot, then
  `editReply()`. Guard with `if (!mcBot || !bridge.mcBotConnected)`. User-facing strings use
  ✅ / ⚠️ / ❌ prefixes and `>` blockquotes — match the existing tone.
- **Discord embed limits:** description 4096 chars, message content 2000. Existing code
  truncates explicitly (see `online.js`, `send.js`); do the same for anything relaying
  server output.
- Style: 4-space indent, single quotes, semicolons, JSDoc on non-trivial helper functions.

## Reconnection

`002autoReconnect.js` polls every 10s; if `mcBotConnected` is false and `reconnecting` is
false it calls `createMcBot()`, which tears down the old bot (`removeAllListeners()` +
`quit()`), re-authenticates, and re-registers the Minecraft event handlers. `/login` shares
the same `reconnecting` flag. Anything that recreates the bot must set and clear that flag
in a `finally`, and must not cache `bridge.mcBot` across an await — read it fresh.

## Files to leave alone

`.env`, `.minecraft-auth/`, `adminRolesConfig.json`, `.idea/` — local/secret state. Never
print or commit token or auth-cache contents.

`src/events/minecraft/message/test.js` is a no-op debug scratch file with commented-out
logging; it is intentionally inert.
