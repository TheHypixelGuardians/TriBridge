# CLAUDE.md

Guidance for Claude Code when working in this repository.

## After every change: keep docs and changelog in sync

Before finishing any task that changes the bot, do both of the following:

1. **Update the changelog** — add an entry for the change under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md),
   in the same commit as the change itself so the changelog never lags behind.
   - Format is SkyHanni-style: `##` release section (`Unreleased` / `Version X.Y.Z`), then a `###` category
     (`New Features` / `Improvements` / `Fixes` / `Technical Details` / `Removed Features`), then a `####`
     feature area (`Bridge`, `Account Linking`, `Management`, `Information`, `Core`, `Misc` — free-form,
     `Misc` is the catch-all), then `+` bullets, one change per bullet, indented `+` sub-bullets for details.
   - Only include categories and feature areas that actually have entries — omit empty ones.
   - Write entries for the people running and using the bot, not for developers: "Added `/whois` to look up a
     link", not "Refactored linkedAccounts". Refactors, dependency bumps and tooling go under
     `### Technical Details`.
   - Skip the changelog only for changes with no effect on the running bot or its workflow (e.g. a doc typo).

2. **Check the Discord changelog** — [DISCORD_CHANGELOG.md](DISCORD_CHANGELOG.md) is the short,
   copy-pasteable version posted in the announcement channel. It gets a line only for changes guild members
   would actually notice — new commands, changed behaviour, user-visible fixes. Internal work, refactors and
   anything under `### Technical Details` never appears there.
   - Written in second person, for guild members rather than server staff, and much shorter than the main
     entry: one line per change, no sub-bullets.
   - Only markdown Discord renders — `#`/`##`/`###`, `**bold**`, `` `code` ``, `-` bullets, `> ` quotes. No
     tables, no `+` bullets, no titled links. Each `##` section must stay under 2000 characters so it pastes
     as a single message.
   - During development add entries under the same `## Unreleased` heading as the main changelog; rename it at
     release time in both files together.

3. **Check the README** — if the change affects anything [README.md](README.md) mentions (commands,
   installation, `.env` variables, Discord permissions/intents, Node version, dependencies, how the relay
   behaves), update it in the same task. New or changed slash commands get a row in the command table.

Releases: bump `version` in `package.json`, then in **both** [CHANGELOG.md](CHANGELOG.md) and
[DISCORD_CHANGELOG.md](DISCORD_CHANGELOG.md) rename `## Unreleased` to `## Version X.Y.Z` and add a fresh
empty `## Unreleased` above it. Semver — patch for fixes, minor for features, major for breaking changes (e.g. a
config format that existing `*Config.json` files can't be read as). Never tag or push tags unless asked.

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

- **Single-guild invariant:** commands are registered *globally*, but the bot serves one guild —
  one bridge channel, one Minecraft account, one flat admin role list. `handleCommands.js`
  refuses any interaction whose `guildId` is not `bridge.guildId` (resolved at startup by
  `000resolveGuild.js` from the bridge channel, or `DISCORD_GUILD_ID`). Without that check an
  administrator of *any* other server the bot is in can `/adminrole add` a role they control and
  inherit bot-admin, since `isAdmin` only matches role IDs and has no guild dimension. It fails
  closed: an unresolved `bridge.guildId` refuses everything. Don't add a command dispatch path
  that skips this guard.
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
  `bridge.mcBot.username`. Any new Minecraft→Discord relay must do the same. On the Discord
  side, webhook reposts are authored by a bot, so `relayToMinecraft.js`'s existing
  `message.author.bot` guard is what stops the repost loop — don't weaken it.
- **Relaying to guild chat:** always build the command with `buildGuildChatCommand()` from
  `utils/sanitizeForChat.js` rather than interpolating a string. Minecraft 1.8 caps chat at
  100 characters, and mineflayer's `bot.chat` splits on newlines — so an un-flattened
  multi-line Discord message would send its second line at *command* position, letting anyone
  in the bridge channel run commands as the bot.
- **Interpolating into `bot.chat`:** commands that build a chat command by hand (`/invite`,
  `/kick`, `/promote`, `/demote`) bypass `buildGuildChatCommand`, so they must validate the
  username with `isValidMinecraftName()` from `utils/minecraftName.js` and run any free-text
  argument through `sanitizeForChat()` first — same newline-injection hazard as above. `/send`
  is the deliberate exception: sending an arbitrary command is the whole point of it, which is
  why it is admin-gated.
- **Replies:** `deferReply()` first for anything touching the Minecraft bot, then
  `editReply()`. Guard with `if (!mcBot || !bridge.mcBotConnected)`. User-facing strings use
  ✅ / ⚠️ / ❌ prefixes and `>` blockquotes — match the existing tone.
- **Discord embed limits:** description 4096 chars, message content 2000. Existing code
  truncates explicitly (see `online.js`, `send.js`); do the same for anything relaying
  server output.
- Style: 4-space indent, single quotes, semicolons, JSDoc on non-trivial helper functions.

## Account linking

`/link <username>` binds a Discord user to a Minecraft account. `utils/linkedAccounts.js`
stores the bindings in `linkedAccountsConfig.json` (gitignored, created on demand, cached in
memory — same shape as `adminRoles.js`), keyed by Discord user ID and holding both the
canonical name and the UUID. The UUID is what avatar URLs use, so links survive Minecraft
name changes. One Minecraft account maps to at most one Discord user; `setLink` enforces it.

`/link` verifies the name exists via `utils/mojang.js`, then checks the live `/guild list`
roster using the standard collector idiom. It **fails open only when the result is
inconclusive** (bot offline, timeout, output that never looked like a roster) — never when
the roster parsed cleanly and the name was absent. Keep that distinction if you touch it;
collapsing the two turns the membership check into decoration.

`relayToMinecraft.js` branches on the link. Unlinked users relay as before. Linked users get
their message reposted through the `TriBridge Relay` webhook (`utils/relayWebhook.js`) with
their Minecraft head and name, the original deleted, and the guild-chat copy attributed to
the Minecraft name. Two things there are load-bearing:

- **Repost before deleting.** If the webhook send throws, the user's original message
  survives instead of vanishing.
- **`allowedMentions: { parse: ['users'] }`.** A webhook post is not subject to the author's
  own permissions, so an unrestricted repost would let any linked user ping `@everyone`.

The repost path needs **Manage Webhooks** and **Manage Messages**. Neither is enforceable via
`botPermissions` (that is only checked by `handleCommands.js`, which never sees a
`messageCreate`), so failure is handled at runtime: fall back to the old relay behaviour and
report once to the log channel, latched so it doesn't spam.

## Reconnection

`002autoReconnect.js` polls every 10s; if `mcBotConnected` is false and `reconnecting` is
false it calls `createMcBot()`, which tears down the old bot (`removeAllListeners()` +
`quit()`), re-authenticates, and re-registers the Minecraft event handlers. `/login` shares
the same `reconnecting` flag. Anything that recreates the bot must set and clear that flag
in a `finally`, and must not cache `bridge.mcBot` across an await — read it fresh.

## Files to leave alone

`.env`, `.minecraft-auth/`, `adminRolesConfig.json`, `linkedAccountsConfig.json`, `.idea/` —
local/secret state. Never print or commit token or auth-cache contents.

`src/events/minecraft/message/test.js` is a no-op debug scratch file with commented-out
logging; it is intentionally inert.
