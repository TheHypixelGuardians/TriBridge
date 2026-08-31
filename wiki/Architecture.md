# Architecture

How TriBridge is put together, for anyone reading or extending the code.

Two rules shape everything below:

1. **One process, two clients.** A `discord.js` client and one `mineflayer` bot per Hypixel guild run in the
   same Node process and reach each other through a single shared-state module.
2. **There is no "current bot".** Every Hypixel guild is addressed by key. A scalar "the bot" would silently
   act on the wrong guild the moment a call site forgot to say which one it meant.

CommonJS throughout (`require`/`module.exports`). No build step, no test suite, no linter. Node v22+.

## Startup

`src/index.js` seeds the guild registry, builds the Discord client, populates the shared `bridge` object,
wires the Discord event handler and logs in.

It deliberately does **not** create any Minecraft bot. `events/discord/clientReady/002autoReconnect.js` owns
every connect, so there is exactly one code path for it — and Discord comes up even when no guild can connect,
because `/guilds` is the only way to repair a broken registry.

## Shared state

`src/bridge.js` is the single shared-state module. Both sides import it to reach each other:

| Field              | Is                                                     |
|--------------------|--------------------------------------------------------|
| `discordClient`    | The discord.js client                                  |
| `discordChannelId` | The bridge channel                                     |
| `logChannelId`     | The global fallback log channel                        |
| `discordServerId`  | The one **Discord server** this instance serves        |
| `mcBots`           | `Map` of `guildKey → BotRecord`, one per Hypixel guild |

There is no dependency injection. New cross-client state belongs here.

A `BotRecord` carries the mineflayer bot, its connection flags, backoff state, the per-bot query queue, the
outbound chat queue, and a disposer that removes the handlers bound to that bot. Three of its flags are
subtle:

- **`connecting`** is cleared by the `spawn`/`end`/`error`/watchdog handlers, never in a `finally` after
  `createMcBot()` returns. The bot is still mid-handshake at that point, and clearing it early lets the next
  poller tick tear down a bot that was about to connect.
- **`awaitingDeviceCode`** suppresses the poller for that guild. Without it, a guild needing a Microsoft
  sign-in starts a second flow ten seconds later, then a third.
- **`tribridgeRetired`** is set on a bot being torn down. Every Minecraft handler bails on it, and nothing
  caches a bot across an `await` — read `record.bot` fresh and re-check.

## The guild registry

`src/utils/guilds.js` is the registry over `guildsConfig.json`; `src/utils/mcBots.js` holds the accessors for
`bridge.mcBots`. Between them they answer every "which guild?" question.

**Resolve a user-supplied guild with `guilds.resolveKey()`.** Autocomplete values are attacker-controlled;
never index `bridge.mcBots` with a raw option value.

Config modules — `guilds`, `adminRoles`, `linkedAccounts`, `linkRole`, `auditChannel`, `globalProfile`,
`featureRequests` — all share one shape: lazy read, in-memory cache, `writeFileSync` on change, and a
`defaults()` that a malformed file degrades to rather than throwing.

## The event handler

`src/handlers/eventHandler.js` is used for **both** clients. Given a client and an events root, each
subdirectory name is treated as an event name and every file inside is invoked in sorted filename order with
`(client, ...args)`:

```
src/events/discord/<eventName>/<NNNname>.js     → discordClient.on(eventName, ...)
src/events/minecraft/<eventName>/<name>.js      → mcBot.on(eventName, ...)
```

Numeric prefixes (`000resolveServer.js`, `001registerCommands.js`, `002autoReconnect.js`) exist only to force
ordering — keep the convention where order matters.

**The first parameter is the client the event came from.** In `events/minecraft/**`, `client` is the
*mineflayer bot*, not the Discord client: reach Discord via `bridge.discordClient`, and the emitting bot's
Hypixel guild via `mcBots.guildForBot(client)`, backed by `bot.tribridgeGuildKey` which is set before the bot
can emit anything.

`eventHandler` returns a disposer that removes everything it registered. The Discord call site ignores it;
`createMcBot` stores it on the record, so one bot can be torn down without disturbing the others.

## Commands

`src/commands/<category>/<name>.js`. The category folder name becomes a page in `/help`, so adding a folder
adds a help category.

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
    },   // optional
};
```

`001registerCommands.js` diffs local commands against the registered application commands via
`utils/areCommandsDifferent.js` and creates, edits or deletes them **globally** on startup. Global propagation
can take up to an hour on Discord's side.

The diff compares `autocomplete` and recurses into subcommand options, so nested changes do propagate — but
`choices` and `autocomplete` are mutually exclusive in the Discord API. Never set both.

## Two permission systems

- **`permissionsRequired`** is enforced generically by `handleCommands.js` — real Discord permissions like
  `Administrator`.
- **Bot-admin** is checked *inside* the callback with `isAdmin(interaction.member)` from
  `utils/adminRoles.js`, which reads role ids from `adminRolesConfig.json`.

And the guard that is neither: `handleCommands.js` refuses any interaction whose `guildId` is not
`bridge.discordServerId`. Commands are registered globally but the bot serves one Discord server, and without
that check an administrator of any *other* server the bot is in could `/adminrole add` a role they control and
inherit bot-admin — `isAdmin` matches role ids and has no server dimension. It fails closed. **Do not add a
command dispatch path that skips it.**

## Talking to Hypixel

Three helpers, each solving a problem you will otherwise rediscover:

| Helper                              | Why it exists                                                                                            |
|-------------------------------------|----------------------------------------------------------------------------------------------------------|
| `queryGuild(record, cmd, opts)`     | Hypixel gives no request/response correlation. Serialises every query per bot with a settle window after |
| `sendChat(record, text, opts)`      | Spaces packets per account. `bot.chat` directly gets accounts muted; a broadcast multiplies the rate     |
| `buildGuildChatCommand(name, body)` | Flattens and truncates. `bot.chat` splits on newlines, so an unflattened message can inject a *command*  |

`queryGuild` owns its listener and timer cleanup — never hand-roll a `message` listener. Pass `format: 'motd'`
when the colour codes carry meaning (`§a` marks online players in `/g online`).

Commands that build a chat command by hand — `/invite`, `/kick`, `/promote`, `/demote` — bypass
`buildGuildChatCommand`, so they must validate the username with `isValidMinecraftName()` and run free text
through `sanitizeForChat()` first. `/send` is the deliberate exception: sending an arbitrary command is the
whole point of it, which is why it is admin-gated.

## Parsing guild chat

`utils/guildChat.js` holds `parseGuildChat()`, `parseGuildPresence()` and `parseOfficerChat()` — regex against
Hypixel's **English** chat output, and inherently brittle. It lives in one place because several relays read
the same lines. Keep the documented format comment next to any regex you add or change, and keep the officer
pattern separate — see [Officer chat](#officer-chat) for why.

## Relay loops

This is the part to understand before touching a relay.

- **`relayToDiscord.js` drops messages authored by *any* registered bot account** via
  `mcBots.isOwnAccountName()` — not just the emitting bot's own name, because two accounts in the same Hypixel
  guild would otherwise relay each other forever.
- **`relayToGuilds.js` depends on the same check to terminate at all.** A forwarded copy is spoken in the
  target guild by *that guild's* own bot, so without it two guilds echo one line at each other until Hypixel
  mutes both accounts. It is the single most load-bearing line in that file.
- **On the Discord side, `relayToMinecraft.js`'s `message.author.bot` guard** is what stops the webhook repost
  looping. Don't weaken it.
- **`utils/relayDedupe.js`** catches the same player saying the same thing in two guilds within two seconds.
  Each caller gets its own instance, so one relay consuming a line never hides it from another.

## Routing Discord → Minecraft

`routeMessage()` from `utils/chatRouting.js` decides which guilds a bridge message reaches: `!tag` for one,
otherwise all. It is **pure** — test it there rather than through the handler.

Four things the handler must get right:

- **Build the `/gc` command once** and reuse it for every target. Identical name plus identical body means
  identical truncation, so the 100-character budget stays deterministic. Hypixel's duplicate-message filter is
  per account, so identical text from several accounts is fine — don't "fix" it by varying the text.
- **`body` is what the repost must show.** `repostAs(message, identity, {content: body})` — the repost is the
  only surviving copy, and raw `message.content` would leave `!sb` visible in Discord while guild chat got the
  stripped text.
- **React to `result.message` when a repost happened.** The original is deleted, so a marker on it is either a
  race or a decoration on a tombstone.
- **The guild tag never enters the `/gc` copy.** It is a Discord-side label.

The disguise repost happens once, outside the fan-out, because there is only ever one Discord message.

## Guild → guild

`utils/crossBridge.js` decides the targets (`crossBridgeTargets()`, registry-driven and testable offline) and
does the fan-out. Opt-in per guild via the `crossBridge` flag, set with `/guilds edit`.

The flag is **symmetric** — a guild that doesn't send doesn't receive, and the source must have it on too,
otherwise switching it off wouldn't stop that guild's chat being pushed everywhere. The `[TAG]` goes in the
*name* position (`/gc [SB] Notch: hi`), unlike the Discord relay where the tag is a Discord-side label.
Forwarded chat passes `maxAgeMs` to `sendChat`, so a spam burst in one guild is dropped rather than delivered
minutes late into another — don't remove that without another backpressure story. Presence lines are not
forwarded, and the global profile disguise deliberately does not apply.

## Officer chat

Officer chat has **its own rails at every layer** — `OFFICER_PATTERN` and `parseOfficerChat()`,
`buildOfficerChatCommand()`, `officerCrossBridgeTargets()` and `relayOfficerAcrossGuilds()`, its own
`crossBridgeOfficer` flag, and its own dedupe instances. Nowhere does it share a code path with ordinary
guild chat.

That duplication is the point, not an oversight. Each shared layer would be a place where one edit silently
moves privileged chat: widening `CHAT_PATTERN` to `(?:Guild|Officer) > ` would immediately push officer chat
into the bridge channel, the guild-to-guild relay *and* the chat-command dispatcher, and reusing
`crossBridge` would mean switching ordinary sharing on also started broadcasting officer chat. The one thing
it does share is `routeMessage()` from `utils/chatRouting.js`, and only because that function takes the
candidate guilds as an argument — the officer leg passes the guilds on its channel, never the registry.

Three handlers:

| Handler in `src/events/`                           | Does                                        |
|----------------------------------------------------|---------------------------------------------|
| `minecraft/message/relayOfficerToDiscord.js`       | Officer chat → that guild's officer channel |
| `minecraft/message/relayOfficerToGuilds.js`        | Officer chat → other guilds' officer chat   |
| `discord/messageCreate/relayOfficerToMinecraft.js` | Officer channel → `/oc` in its guilds       |

The two Discord-facing legs are inert until a guild has an `officerChannelId`; the guild-to-guild leg needs
only `crossBridgeOfficer`.

- **`isOwnAccountName()` terminates both inbound paths.** Same reasoning as `relayToGuilds.js`, now covering
  the copy this guild's own bot just spoke on behalf of the Discord officer channel.
- **The Discord leg routes with `!tag`, scoped to the channel.** Guilds may share one officer channel, so
  `guilds.getAllByOfficerChannel()` is plural and its result is the `candidates` set handed to
  `routeMessage()`. Scoping it is load-bearing: an unscoped tag lookup would turn any officer channel into a
  way to speak into a guild it was never wired to. There is still no fan-out past the routed targets.
- **It must not use `resolveIdentity()`.** That applies the global profile change; the officer leg reads the
  account link directly. `000disguiseMessages.js` also skips officer channels outright — otherwise a running
  disguise would repost the message as a webhook and the `message.author.bot` guard would drop it, losing the
  line with no error anywhere.
- **`crossBridgeOfficer` stands alone.** `guilds.getOfficerCrossBridged()` filters the registry on that flag
  and `enabled` only, deliberately not on `crossBridge`: sharing officer chat and sharing ordinary chat are
  separate decisions. It stays symmetric, so a guild with the flag off neither sends nor receives.

## Reconnection

`002autoReconnect.js` polls every 10s and starts **at most one** connect per tick, iterating
`guilds.getEnabled()`. The stagger stops a Hypixel restart bringing every account back at once.

`createMcBot(guildKey)` retires the old bot, re-authenticates and re-registers the Minecraft handlers.
**Never call `removeAllListeners()` with no argument** — it strips mineflayer's own internal listeners *and*
the `error` listener, and an EventEmitter with no `error` listener turns a late socket error on a dead bot
into an uncaught exception that kills the process. Use `retireBot()`, which removes named events and
re-attaches an error sink.

Device codes go to the requesting admin's ephemeral reply, else a DM to `addedBy`, else the console
(`utils/deviceCode.js`). They must **never** reach the log channel or any shared channel: whoever holds the
code can complete the sign-in with their own Microsoft account.

## Conventions

- **"Guild" means two things — keep them apart.** A *Hypixel guild* has a `guildKey` and lives in
  `guildsConfig.json`. A *Discord server* is `bridge.discordServerId`. discord.js calls a server a "guild", so
  `interaction.guildId` is a Discord server id — that is the library's word, not ours. Never introduce a bare
  `guildId` in new code.
- **Picking a guild in a command:** `resolveTarget(interaction)` from `utils/commandGuild.js`, with
  `GUILD_OPTION` in `options` and `guildOptionAutocomplete()` as the `autocomplete` export. Use
  `guildPhrase(guild)` / `inGuild(guild)` in reply text so a single-guild install keeps its original wording.
- **Replies:** `deferReply()` first for anything touching a Minecraft bot, then `editReply()`. User-facing
  strings use ✅ / ⚠️ / ❌ prefixes and `>` blockquotes.
- **Minecraft text:** strip formatting with `.replace(/§./g, '')`. `jsonMsg.toString()` for plain text,
  `jsonMsg.toMotd()` when the colour codes carry meaning.
- **Discord limits:** embed description 4096, message content 2000. Truncate explicitly when relaying server
  output.
- **Style:** Prettier defaults — 2-space indent, double quotes, semicolons, trailing commas, 80 columns, as
  recorded in `.prettierrc`. JSDoc on non-trivial helpers.

## Testing without connecting

Running the bot connects to live Discord and Hypixel — don't start it to "verify" a change. A good deal is
testable offline against fakes: `utils/chatRouting.js`, `utils/guilds.js`, `utils/crossBridge.js`,
`utils/queryGuild.js` (drive it with a bare `EventEmitter` whose `chat()` emits stub messages), `retireBot`,
`utils/chatQueue.js` and `utils/areCommandsDifferent.js` are all pure or injectable.

## Next

- [Adding a command](Adding-a-Command)
- [Contributing](Contributing)
