# Using the bridge

There is one channel in this Discord server — the **bridge channel** — wired to Hypixel guild chat. Anything
you type there is spoken in guild chat, and anything said in guild chat appears there. You do not need
Minecraft open, and you do not need to install anything.

## Talking to the guild

Type in the bridge channel. That is the whole thing.

Your message arrives in-game as `Your Name: what you typed`. If you have
[linked your Minecraft account](Account-Linking), it arrives under your **Minecraft** name instead, and your
message in Discord is reposted with your Minecraft head so both sides show the same person.

A few practical limits, all of them Minecraft's rather than the bot's:

- **100 characters.** Minecraft 1.8 caps a chat line, so a long message is cut off in-game. Discord keeps the
  whole thing; the guild does not.
- **Attachments do not travel.** A message with a file and no text arrives in guild chat as `[attachment]`.
  Nobody in-game can open it.
- **Formatting does not travel.** Bold, links and emoji reach guild chat as the characters you typed.
- **One line at a time.** A multi-line Discord message is flattened before it is sent.

## Reading the guild

Guild chat comes back as embeds, coloured per guild, with the speaker's Minecraft head. Members joining and
leaving the guild are relayed too.

If this server bridges **more than one** Hypixel guild, the guild's tag is shown next to the speaker's name —
`Notch [SB]` — so you can tell which guild said what. With a single guild there is no tag, because there is
nothing to tell apart.

## Sending to one guild

If more than one guild is bridged, start a message with a guild's tag to reach only that guild:

```
!sb hey
```

See [Guild tags](Guild-Tags) for the full rules, including how to type a literal `!` and what the ❓ and 📡
reactions mean.

## Asking the bot something

A couple of things are answered rather than relayed. Type them in the bridge channel or in guild chat:

```
!nw Notch
```

See [Networth](Networth).

## Slash commands

Everything else is a slash command. `/help` browses them by category; [Commands](Commands) lists them all.
The ones you are most likely to want:

| Command                | Does                                                        |
|------------------------|-------------------------------------------------------------|
| `/link <username>`     | Bind your Minecraft account — see [Account linking](Account-Linking) |
| `/online`              | Who is online in the guild right now                        |
| `/networth [username]` | A player's SkyBlock networth                                |
| `/ping`                | Whether the bot is actually connected                       |
| `/request`             | Suggest a feature — see [Feature requests](Feature-Requests) |
| `/help`                | Every command, by category                                  |

## If a message does not arrive

- **`/ping`** says whether each guild's Minecraft account is connected. If it is offline, the message was not
  delivered and staff already have a notice about it.
- **A ❓ reaction** means you used a guild tag nobody recognises. Your message still went to every guild, with
  the `!nope` still on the front of it.
- **A 📡 reaction** means you aimed at one guild with `!tag` and that guild's account is offline. Nothing was
  delivered.
- **Nothing at all, from anyone** — see [Troubleshooting](Troubleshooting), and tell a server admin.

## Next

- [Guild tags](Guild-Tags)
- [Account linking](Account-Linking)
- [Commands](Commands)
