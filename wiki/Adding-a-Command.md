# Adding a command

The checklist for a change that ships. [Architecture](Architecture) explains why the pieces are shaped this
way; this page is the sequence.

## 1. Write the command

One file, `src/commands/<category>/<name>.js`. The category folder becomes a page in `/help`, so put it in an
existing one unless you genuinely want a new page.

```js
const {ApplicationCommandOptionType} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const {resolveTarget} = require('../../utils/commandGuild');
const {GUILD_OPTION, guildOptionAutocomplete} = require('../../utils/guildAutocomplete');

module.exports = {
    name: 'example',
    description: 'One sentence, sentence case, ending in a period.',
    options: [
        {
            name: 'username',
            description: 'The Minecraft username.',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        GUILD_OPTION,
    ],

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({content: '❌ You are not allowed to use this.', ephemeral: true});
        }

        await interaction.deferReply();

        const target = await resolveTarget(interaction);
        if (!target.ok) return;   // resolveTarget has already replied

        // ... work ...
    },

    autocomplete: guildOptionAutocomplete(),
};
```

## 2. Get the guild right

If the command touches a Minecraft bot, it acts on **one Hypixel guild**. Use `resolveTarget(interaction)` —
it handles every "no guild / unknown guild / disabled / offline" case in one place, with the right tone. Never
index `bridge.mcBots` with a raw option value; autocomplete values are attacker-controlled.

Use `guildPhrase(guild)` / `inGuild(guild)` in reply text so a single-guild install keeps its original
wording.

## 3. Get the permissions right

| Gate                      | Use                                               |
|---------------------------|---------------------------------------------------|
| A real Discord permission | `permissionsRequired: [PermissionFlagsBits.X]`    |
| Bot-admin                 | `isAdmin(interaction.member)` inside the callback |
| Anyone                    | Neither                                           |

Do not invent a third path, and do not add a dispatch route that skips the single-server guard in
`handleCommands.js`. See [Admin roles](Admin-Roles).

## 4. Talk to Hypixel through the helpers

- **Reading something back:** `queryGuild(record, '/guild list')`. Never hand-roll a `message` listener —
  Hypixel gives no request/response correlation, and `queryGuild` is what stops two concurrent commands eating
  each other's output.
- **Saying something:** `sendChat(record, text)`. Calling `bot.chat` directly for relayed traffic gets accounts
  muted.
- **Building a chat line from user input:** `buildGuildChatCommand(name, body)`. If you build one by hand,
  validate the username with `isValidMinecraftName()` and run free text through `sanitizeForChat()` — an
  unflattened multi-line message sends its second line at *command* position.

## 5. Reply in the house style

`deferReply()` first for anything touching a Minecraft bot, then `editReply()`. ✅ / ⚠️ / ❌ prefixes and `>`
blockquotes. Truncate explicitly against Discord's limits — 4096 for an embed description, 2000 for message
content.

## 6. The after-every-change checklist

This is the part that is easy to skip and shouldn't be. All four, in the same commit as the code:

1. **[CHANGELOG.md](https://github.com/Trilleo/TriBridge/blob/master/CHANGELOG.md)** — an entry under
   `## Unreleased`, written for the people running the bot. Format in
   [Releasing](Releasing).
2. **[DISCORD_CHANGELOG.md](https://github.com/Trilleo/TriBridge/blob/master/DISCORD_CHANGELOG.md)** — one
   line, second person, only if a guild member would notice.
3. **[README.md](https://github.com/Trilleo/TriBridge/blob/master/README.md)** — a row in the command table,
   and anything else it mentions that you changed.
4. **The docs and this wiki** —
   [docs/FEATURES.md](https://github.com/Trilleo/TriBridge/blob/master/docs/FEATURES.md) is canonical; the
   wiki page restates it for its reader. A new command always touches [Commands](Commands), which is meant to
   be exhaustive. New config file? [Config files](Config-Files). New permission?
   [Permissions](Permissions).

## 7. Do not run the bot to check

Starting it connects to live Discord and Hypixel. Test the pure parts directly instead — `chatRouting`,
`guilds`, `crossBridge`, `queryGuild` against a bare `EventEmitter`, `chatQueue`, `areCommandsDifferent`.

If a live check is genuinely the only way, say so and ask.

## Registration

Nothing to do. `001registerCommands.js` diffs the local commands against Discord's on startup and
creates, edits or deletes as needed. Two things to know:

- **Global propagation takes up to an hour**, so a new command will not appear immediately.
- **`choices` and `autocomplete` are mutually exclusive** in the Discord API. Never set both.

Setting `deleted: true` on a command unregisters it.

## Next

- [Architecture](Architecture)
- [Contributing](Contributing)
- [Releasing](Releasing)
