# CLAUDE.md

Guidance for Claude Code when working in this repository.

## After every change: keep docs and changelog in sync

Before finishing any task that changes the bot, do all of the following:

1. **Update the changelog** — add an entry for the change under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md),
   in the same commit as the change itself so the changelog never lags behind.
    - Format is SkyHanni-style: `##` release section (`Unreleased` / `Version X.Y.Z`), then a `###` category
      (`New Features` / `Improvements` / `Fixes` / `Technical Details` / `Removed Features`), then a `####`
      feature area (`Bridge`, `Account Linking`, `Management`, `Information`, `Requests`, `Admin Panel`,
      `Documentation`, `Core`, `Misc` — free-form, `Misc` is the catch-all), then `+` bullets, one change per
      bullet, indented `+` sub-bullets for details.
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

3. **Document the feature** — every user-visible feature is described in [docs/FEATURES.md](docs/FEATURES.md),
   which is the canonical description the README and the wiki both point at. A new feature gets its own `##`
   section there (what it does, how it is switched on and configured, any limitation); a change to an existing
   feature updates that feature's section rather than appending a note to the end of it. Write for whoever runs
   or uses the bot — implementation notes belong in the changelog's `### Technical Details` and in
   [wiki/Architecture.md](wiki/Architecture.md).
    - One exception worth keeping: where a rule exists because the obvious alternative was actively harmful (a
      silent drop, a Hypixel mute, a permission escalation), say so. That sentence is what stops the rule being
      "simplified" away later.

4. **Update the wiki** — the GitHub wiki is published from [wiki/](wiki/) in this repository, and it is the
   page somebody finds from a search engine, so it must never lag behind the bot. Publishing is automatic —
   [.github/workflows/wiki.yml](.github/workflows/wiki.yml) syncs the folder to the wiki repository on every
   push to `master` that touches it — so the only job here is keeping `wiki/` correct. Never publish by hand
   and never edit a page through GitHub's wiki editor: the next push overwrites it.
    - The wiki is **split by audience**: *Using the bridge* is for guild members in the Discord server, *Running
      the bot* is for whoever hosts it and holds a bot-admin role. A page belongs to whichever reader can act on
      it. Where a feature has both halves (the global profile change, auditing), the member-facing consequence
      is a paragraph on the member page and the configuration lives on the staff page.
    - A **new feature** gets its own `wiki/<Page-Name>.md`, plus a line in [wiki/_Sidebar.md](wiki/_Sidebar.md)
      under the right section and a row in the feature table of [wiki/Home.md](wiki/Home.md).
    - A **change to an existing feature** updates that feature's page, in the same task as the code.
    - Three pages are **exhaustive lists**, so a missing entry is a visible gap: a new or changed command
      touches [wiki/Commands.md](wiki/Commands.md), a new config file touches
      [wiki/Config-Files.md](wiki/Config-Files.md), and a new permission or intent touches
      [wiki/Permissions.md](wiki/Permissions.md).
    - Page names are titles: renaming a file breaks every link to it. Links between pages are relative and
      extension-less (`[Guild tags](Guild-Tags)`); links into this repository are absolute GitHub URLs. See
      [docs/WIKI.md](docs/WIKI.md) for the conventions and how pages are published.
    - Never put a real token, channel id, role id or account address in a page — the wiki is public.

5. **Check the README** — if the change affects anything [README.md](README.md) mentions (commands,
   installation, `.env` variables, Discord permissions/intents, Node version, dependencies, how the relay
   behaves), update it in the same task. New or changed slash commands get a row in the command table.
   [README.md](README.md) carries only a one-line summary per feature: add a bullet for a new feature, but keep
   the details in [docs/FEATURES.md](docs/FEATURES.md).

6. **Check the docs folder** — if the change affects a workflow documented in [docs/](docs/) (the release
   process in [docs/RELEASING.md](docs/RELEASING.md), the commit convention in
   [docs/COMMIT_STRUCTURE.md](docs/COMMIT_STRUCTURE.md), the wiki conventions in [docs/WIKI.md](docs/WIKI.md)),
   update the affected doc in the same task.

Releases: bump `version` in `package.json`, then in **both** [CHANGELOG.md](CHANGELOG.md) and
[DISCORD_CHANGELOG.md](DISCORD_CHANGELOG.md) rename `## Unreleased` to `## Version X.Y.Z` and add a fresh
empty `## Unreleased` above it. The bot is on a pre-release beta line — versions are `0.1.0-beta.N`, lowercase
and no leading `v`, bumping the trailing number; ordinary semver (patch for fixes, minor for features, major
for a config format existing `*Config.json` files can't be read as) resumes at `1.0.0`. Bumping `package.json`
is the step that gets forgotten — it sat at `1.0.0` through three releases. Never tag or push tags unless
asked.

## Project

TriBridge is a Node.js bot that bridges a Discord channel and a Hypixel guild chat. A
`discord.js` client and a `mineflayer` Minecraft bot run in the same process and relay
messages both ways; slash commands let Discord admins run guild management commands
in-game.

- CommonJS (`"type": "commonjs"`) — use `require`/`module.exports`, not ESM.
- No build step, no test suite, no linter — there is no `test` script, so `npm test` reports a missing one.
- Node v22+. Dependencies: `discord.js`, `mineflayer`, `prismarine-auth`, `dotenv`. `nodemon` is the only
  dev dependency, used by `npm run dev` and needed by nothing that runs the bot.
- Documentation lives in two places: [docs/](docs/) holds the canonical reference
  ([FEATURES.md](docs/FEATURES.md)) and the workflow docs, and [wiki/](wiki/) is the source of the GitHub
  wiki, which restates the same material split by audience. [wiki/Architecture.md](wiki/Architecture.md) is
  the long-form version of the Architecture section below — when one changes, check the other.
- Commit messages follow the `<tag>: <message>` convention (`Feature:`, `Improvement:`, `Fix:`, `Internal:`,
  `Backend:`, `Update:`) with one granular commit per logical change — see
  [docs/COMMIT_STRUCTURE.md](docs/COMMIT_STRUCTURE.md).

## Running

```bash
npm install
npm start                 # or: node src/index.js
npm run dev               # nodemon, restarts on any source or .env change
```

Requires a `.env` (gitignored) with `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, `LOG_CHANNEL`,
`MINECRAFT_USERNAME`. `MINECRAFT_USERNAME` only seeds the first Hypixel guild on a fresh
install; once `guildsConfig.json` exists the registry is authoritative and the env var is
ignored. A first sign-in for an account opens a Microsoft device-code flow — surfaced in
Discord by `/guilds add|auth`, and always echoed to the console; tokens are cached per
account in `.minecraft-auth/` (gitignored).

Running the bot connects to live Discord and Hypixel — don't start it to "verify" a change
unless the user asks. There is no test suite, but a good deal *is* testable offline against
fakes: `utils/chatRouting.js`, `utils/guilds.js`, `utils/queryGuild.js` (drive it with a bare
`EventEmitter` whose `chat()` emits stub messages), `retireBot`, `utils/chatQueue.js` and
`utils/areCommandsDifferent.js` are all pure or injectable. Prefer that over a live run.

## Architecture

`src/index.js` seeds the guild registry, boots the Discord client, populates the shared
`bridge` object, wires the Discord event handler and logs in. It deliberately does **not**
create any Minecraft bot: `002autoReconnect.js` owns every connect, so there is one code
path for it, and Discord comes up even when no guild can connect (`/guilds` is the only way
to repair a broken registry).

**`src/bridge.js`** is the single shared-state module. Both sides import it to reach each
other: `discordClient`, `discordChannelId`, `logChannelId`, `discordServerId`, and `mcBots`
— a `Map` of `guildKey → BotRecord`, one per Hypixel guild. There is no DI, and deliberately
no "current bot" scalar; new cross-client state belongs here.

**`src/utils/guilds.js`** is the Hypixel guild registry over `guildsConfig.json`, and
**`src/utils/mcBots.js`** holds the accessors for `bridge.mcBots`. Between them they answer
every "which guild?" question. Resolve a user-supplied guild with `guilds.resolveKey()` —
autocomplete values are attacker-controlled, so never index `bridge.mcBots` with a raw
option value.

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
Discord client; reach Discord via `bridge.discordClient`, and the emitting bot's Hypixel
guild via `mcBots.guildForBot(client)` (backed by `bot.tribridgeGuildKey`, set before the
bot can emit anything). Handlers must also bail on `client.tribridgeRetired`.

`eventHandler` returns a disposer that removes everything it registered. The Discord call
site ignores it; `createMcBot` stores it on the record so one bot can be torn down without
disturbing the others.

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
    autocomplete: async (client, interaction) => { ...
    },                              // optional; dispatched by handleAutocomplete.js
};
```

`001registerCommands.js` diffs local commands against the registered application commands
via `utils/areCommandsDifferent.js` and creates/edits/deletes them globally on startup.
Global command propagation can take up to an hour on Discord's side. The diff compares
`autocomplete` and recurses into subcommand options, so nested changes do propagate — but
`choices` and `autocomplete` are mutually exclusive in the Discord API; never set both.

## Conventions

- **"Guild" means two things — keep them apart.** A *Hypixel guild* is one of the (plural)
  Minecraft guilds the bot bridges; it is identified by a `guildKey` and lives in
  `guildsConfig.json`. A *Discord server* is the single Discord community the bot serves; its id
  is `bridge.discordServerId`. discord.js confusingly calls a server a "guild", so
  `interaction.guildId` is a Discord server id — that is the library's word, not ours. Never
  introduce a bare `guildId` in new code.
- **Single-server invariant:** commands are registered *globally*, but the bot serves one Discord
  server — one bridge channel, one flat admin role list. `handleCommands.js` refuses any
  interaction whose `guildId` is not `bridge.discordServerId` (resolved at startup by
  `000resolveServer.js` from the bridge channel, or `DISCORD_GUILD_ID`). Without that check an
  administrator of *any* other server the bot is in can `/adminrole add` a role they control and
  inherit bot-admin, since `isAdmin` only matches role IDs and has no server dimension. It fails
  closed: an unresolved `bridge.discordServerId` refuses everything. Don't add a command dispatch
  path that skips this guard.
- **Permissions:** two separate systems. `permissionsRequired` is enforced generically by
  `handleCommands.js` (used for real Discord permissions like `Administrator`). Bot-admin
  gating is done *inside* the callback with `isAdmin(interaction.member)` from
  `utils/adminRoles.js`, which reads role IDs from `adminRolesConfig.json` (gitignored,
  created on demand, cached in memory). Follow the existing pattern for the command type
  you're adding.
- **Querying Hypixel:** use `queryGuild(record, chatCommand, opts)` from `utils/queryGuild.js`.
  Never hand-roll a `message` listener again — Hypixel gives no request/response correlation,
  so `queryGuild` serialises every query per bot and holds a settle window afterwards, which is
  the only thing stopping two concurrent commands from eating each other's output. It also owns
  listener and timer cleanup. `format: 'motd'` when the colour codes matter.
- **Sending to guild chat:** use `sendChat(record, text)` from `utils/chatQueue.js`, which
  spaces packets per account. Calling `bot.chat` directly for relayed traffic will get accounts
  muted by Hypixel's spam filter, and a broadcast multiplies the rate by the guild count.
- **Picking a guild in a command:** `resolveTarget(interaction)` from `utils/commandGuild.js`,
  with `GUILD_OPTION` in `options` and `guildOptionAutocomplete()` as the `autocomplete` export.
  It handles every "no guild / unknown guild / disabled / offline" case in one place with the
  right tone. Use `guildPhrase(guild)` / `inGuild(guild)` in reply text so a single-guild
  install keeps its original wording.
- **Minecraft text:** strip formatting with `.replace(/§./g, '')`. Use `jsonMsg.toString()`
  for plain text, `jsonMsg.toMotd()` when the color codes themselves carry meaning (e.g.
  `§a` marks online players in `/online`).
- **Guild-chat parsing** is regex against Hypixel's English chat output and is inherently
  brittle. It lives in `utils/guildChat.js` — `parseGuildChat()`, `parseGuildPresence()` and
  `parseOfficerChat()` — because several relays read the same lines; don't re-inline the pattern
  in a handler. Keep the documented format comment next to any regex you add or change, and keep
  the officer pattern separate from `CHAT_PATTERN`.
- **Relay loops:** `relayToDiscord.js` drops messages whose author matches *any* registered
  bot account, via `mcBots.isOwnAccountName()` — not just the emitting bot's own name, because
  two accounts that ended up in the same Hypixel guild would otherwise relay each other
  forever. Any new Minecraft→Discord relay must do the same. On the Discord side, webhook
  reposts are authored by a bot, so `relayToMinecraft.js`'s existing `message.author.bot` guard
  is what stops the repost loop — don't weaken it. The same `isOwnAccountName()` check is what
  makes guild→guild bridging terminate at all: the forwarded copy is spoken in the target guild
  by *that guild's own bot*, so without it two guilds would echo one line at each other until
  Hypixel muted both accounts. It is the single most load-bearing line in
  `events/minecraft/message/relayToGuilds.js`.
- **Guild→guild bridging:** `utils/crossBridge.js` decides the targets (`crossBridgeTargets()`,
  registry-driven and testable offline) and does the fan-out. Opt-in per guild via the
  `crossBridge` flag in `guildsConfig.json`, set with `/guilds edit`. The flag is deliberately
  symmetric — a guild that doesn't send doesn't receive — and the source must have it on too,
  otherwise switching it off wouldn't stop that guild's chat being pushed everywhere. The
  `[TAG]` goes in the *name* position (`/gc [SB] Notch: hi`), unlike the Discord relay where
  the tag is a Discord-side label that never enters the `/gc` copy. Forwarded chat passes
  `maxAgeMs` to `sendChat`, so a spam burst in one guild is dropped rather than delivered
  minutes late into another; don't remove that without another backpressure story. Presence
  lines are not forwarded, and the global profile disguise deliberately does not apply — its
  two switches govern the two Discord legs only.
- **Officer chat has its own rails at every layer** and shares no code path with ordinary guild
  chat: `OFFICER_PATTERN`/`parseOfficerChat()`, `buildOfficerChatCommand()`,
  `officerCrossBridgeTargets()`/`relayOfficerAcrossGuilds()`, the `crossBridgeOfficer` flag, and
  its own dedupe instances. The duplication is the point — widening `CHAT_PATTERN` to
  `(?:Guild|Officer) > ` would push privileged chat into the bridge channel, the guild→guild
  relay *and* the chat-command dispatcher in one edit. The single exception is `routeMessage()`,
  and only because it takes its candidate guilds as an argument. Three handlers,
  `relayOfficerToDiscord.js`, `relayOfficerToGuilds.js` and `relayOfficerToMinecraft.js`; the two
  Discord-facing ones are inert until a guild has an `officerChannelId`, while the guild→guild leg
  needs only `crossBridgeOfficer`. Four things must hold:
    - **`isOwnAccountName()` terminates both inbound paths**, as it does for `relayToGuilds.js`
      — now also covering the copy this guild's own bot just spoke for the Discord channel.
    - **The Discord leg routes with `!tag` over the channel's own guilds.** Guilds may share one
      officer channel, so `guilds.getAllByOfficerChannel()` is plural and its result is the
      `candidates` passed to `routeMessage()`. That scoping is the load-bearing part: routing
      against the whole registry would make any officer channel a way to speak into a guild it was
      never wired to. There is still no fan-out past the routed targets — the copy the bot speaks
      is dropped by `isOwnAccountName()` before the cross-bridge can see it.
    - **`crossBridgeOfficer` stands alone.** `getOfficerCrossBridged()` filters the registry on
      that flag and `enabled`, deliberately *not* on `crossBridge`: sharing officer chat and
      sharing ordinary chat are separate decisions. Keep it symmetric, so a guild with the flag
      off neither sends nor receives.
    - **Never `resolveIdentity()` there** — it applies the global profile change. The officer leg
      reads the account link directly, and `000disguiseMessages.js` skips officer channels
      outright: a disguise repost is authored by a webhook, and the leg's `message.author.bot`
      guard would then drop it, losing the officer's line with no error anywhere.
  Access is the channel's Discord permissions and nothing else — deliberately no `isAdmin()`
  check, since a second gate on an already-restricted channel mostly produces silent drops.
  Document the rank requirement wherever this is described: the account needs to be able to read
  *and* send officer chat, and Hypixel reports neither failure.
- **Routing Discord→Minecraft:** `routeMessage()` from `utils/chatRouting.js` decides which
  guilds a bridge message reaches (`!tag` for one, otherwise all). It is pure — test it there
  rather than through the handler. Pass `{ candidates }` when the channel serves only some guilds,
  as the officer leg does; the tag lookup and the fallback both narrow to that set. Build the `/gc` command **once** and reuse it for every
  target: identical name plus identical body means identical truncation, so the 100-character
  budget stays deterministic. Hypixel's duplicate-message filter is per account, so identical
  text from several accounts is fine — don't "fix" it by varying the text per guild. `body` is
  also what the **repost** must show: `repostAs(message, identity, {content: body})`, because
  the repost is the only surviving copy and a raw `message.content` would leave `!sb` visible
  in Discord while guild chat got the stripped text. Anything that reacts to a bridge message
  must react to `result.message` when a repost happened — the original is deleted, so a marker
  on it is either a race or a decoration on a tombstone. The guild
  tag is a Discord-side label and never goes into the `/gc` copy. The disguise repost happens
  once, outside the fan-out, because there is only ever one Discord message.
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
- **Replies:** `deferReply()` first for anything touching a Minecraft bot, then `editReply()`.
  Guard with `resolveTarget(interaction)`. User-facing strings use ✅ / ⚠️ / ❌ prefixes and
  `>` blockquotes — match the existing tone.
- **Discord embed limits:** description 4096 chars, message content 2000. Existing code
  truncates explicitly (see `online.js`, `send.js`); do the same for anything relaying
  server output.
- Style: Prettier's default style — 2-space indent, double quotes, semicolons, trailing commas, 80
  columns. `.prettierrc` records the settings; reformat with
  `npx prettier --write "src/**/*.js"`. JSDoc on non-trivial helper functions.

## Account linking

`/link <username>` binds a Discord user to a Minecraft account. `utils/linkedAccounts.js`
stores the bindings in `linkedAccountsConfig.json` (gitignored, created on demand, cached in
memory — same shape as `adminRoles.js`), keyed by Discord user ID and holding both the
canonical name and the UUID. The UUID is what avatar URLs use, so links survive Minecraft
name changes. One Minecraft account maps to at most one Discord user; `setLink` enforces it.

Links are deliberately **not** scoped to a Hypixel guild — one link per Discord user, whatever
guild they are in.

`/link` verifies the name exists via `utils/mojang.js`, then checks the live `/guild list`
roster of *every connected guild* via `queryGuild`, and accepts membership of any one of them.
It **fails open only when the result is inconclusive** (no bot connected, timeout, output that
never looked like a roster) — never when a roster parsed cleanly and the name was absent.
Across guilds that means: `found` if any roster has them, `absent` only if every roster parsed
cleanly and none did, `inconclusive` otherwise. Keep that distinction if you touch it;
collapsing the two turns the membership check into decoration. Note it necessarily weakens as
guilds are added, since one flaky roster now makes the whole check inconclusive.

`relayToMinecraft.js` branches on the link. Unlinked users relay as before. Linked users get
their message reposted through the `TriBridge Relay` webhook (`utils/relayWebhook.js`) with
their Minecraft head and name, the original deleted, and the guild-chat copy attributed to
the Minecraft name. Two things there are load-bearing:

- **Repost before deleting.** If the webhook send throws, the user's original message
  survives instead of vanishing.
- **`allowedMentions: { parse: ['users'] }`.** A webhook post is not subject to the author's
  own permissions, so an unrestricted repost would let any linked user ping `@everyone`.

`utils/linkRole.js` holds the optional role given to linked users (`linkRoleConfig.json`,
same shape as the other config modules; `/linkrole` configures it). `/link` adds it, `/unlink`
removes it, and `003syncLinkRoles.js` backfills it from the stored links at every startup —
the links are the source of truth, the roles are derived. Two constraints there:

- **The role never gates the link.** `applyLinkRole` returns a result instead of throwing;
  every caller carries on and reports the failure. A missing role or a lost **Manage Roles**
  is a config problem, not a reason to refuse someone's `/link`.
- **Members are fetched one id at a time.** `guild.members.fetch()` with no argument goes over
  the gateway and needs the privileged `GuildMembers` intent, which `index.js` does not
  request. Don't switch the sync to a bulk fetch without adding that intent.

The sync only ever *adds* — the role may be handed out for unrelated reasons, so it is never
stripped from someone merely because they have no link. Changing or clearing the configured
role likewise leaves the old one in place.

The repost path needs **Manage Webhooks** and **Manage Messages**. Neither is enforceable via
`botPermissions` (that is only checked by `handleCommands.js`, which never sees a
`messageCreate`), so failure is handled at runtime: fall back to the old relay behaviour and
report once to the log channel, latched so it doesn't spam.

## Hypixel guilds and reconnection

`guildsConfig.json` holds the registered guilds; `utils/guilds.js` reads and writes it with
the same lazy-cache-and-`writeFileSync` shape as the other config modules, and `/guilds`
is the only supported way to change it. `key` and `account` are immutable — `account` is the
key prismarine-auth hashes for its token cache, so normalising or editing it later silently
starts a fresh device-code flow against a different cache file.

`002autoReconnect.js` polls every 10s and starts **at most one** connect per tick, iterating
`guilds.getEnabled()`. That stagger is deliberate: a Hypixel restart would otherwise bring
every account back at once and get them all throttled. `createMcBot(guildKey)` retires the old
bot, re-authenticates and re-registers the Minecraft handlers. Four things must hold:

- **`connecting` is cleared by the `spawn`/`end`/`error`/watchdog handlers, never in a
  `finally` after `createMcBot()` returns.** The bot is still mid-handshake at that point, and
  clearing it early lets the next tick tear down a bot that was about to connect.
- **`awaitingDeviceCode` suppresses the poller.** Without it a guild needing a Microsoft
  sign-in starts a second flow ten seconds later, then a third.
- **Never `removeAllListeners()` with no argument.** It strips mineflayer's own internal
  listeners *and* the `error` listener, and an EventEmitter with no `error` listener turns a
  late socket error on a dead bot into an uncaught exception that kills the process. Use
  `retireBot()`, which removes named events and re-attaches an error sink.
- **Never cache a bot across an await** — read `record.bot` fresh and re-check
  `record.connected` and `bot.tribridgeRetired`.

Device codes go to the requesting admin's ephemeral reply, else a DM to `addedBy`, else the
console (`utils/deviceCode.js`). They must never reach the log channel or any shared channel:
whoever holds the code can complete the sign-in with *their own* Microsoft account.

## Files to leave alone

`.env`, `.minecraft-auth/`, `adminRolesConfig.json`, `linkedAccountsConfig.json`,
`linkRoleConfig.json`, `globalProfileConfig.json`, `auditChannelConfig.json`,
`featureRequestsConfig.json`, `guildsConfig.json`, `.idea/` — local/secret state. Never print
or commit token, auth-cache or account-address contents.

`src/events/minecraft/message/test.js` is a no-op debug scratch file with commented-out
logging; it is intentionally inert.
