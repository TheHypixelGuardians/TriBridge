# Global profile change

Pick a member and a duration, and for that long **everybody's messages are reposted wearing that member's name
and avatar** — in Discord, in the guild-chat copy, and on guild chat coming back the other way.

It is a joke feature with real teeth: it deletes people's messages and reposts them under someone else's face.
Read [Auditing](Auditing) before running one live.

Set it up from [`/adminpanel`](Admin-Panel) → **Global Profile**.

## Setting one up

1. **Pick the member** everybody will appear as. If they have a [linked account](Account-Linking), their
   Minecraft name is used on the guild-chat side too.
2. **Pick a duration** — 5 minutes to 24 hours, **Until stopped**, or **Custom…**.
3. **Choose the bridge directions** (below).
4. **Start in test mode** or **Start live**.

**Testers & channels** opens the scope view: who the testers are, which channels test mode applies in, and
which channels a live effect should skip.

### Custom durations

`90m`, `2h30m`, `1d12h`, or a bare number read as minutes. `0`, `none`, `never`, `forever`, `permanent` and
`indefinite` all mean "until somebody stops it". Trailing junk is rejected outright rather than quietly
ignored — `2h then stop` is not two hours, it is an error.

## The two switches

The effect has three legs, and two of them have their own switch on the panel:

| Leg                 | Switch                          | Governs                                |
|---------------------|---------------------------------|----------------------------------------|
| Discord repost      | *always on*                     | The message in the bridge channel      |
| Discord → Minecraft | **Discord → Minecraft: on/off** | The name guild chat is told            |
| Minecraft → Discord | **Minecraft → Discord: on/off** | The name on incoming guild-chat embeds |

Switching *Discord → Minecraft* off stops the disguise **at the bridge** rather than turning it off outright —
Discord still shows the target's face, guild chat gets real names. That is the setting for running a joke in
Discord without confusing people in-game.

Neither switch affects [guild-to-guild bridging](Guild-to-Guild-Bridging). Forwarded chat always uses real
names.

## Test mode

Test mode applies the effect **only to listed testers, and only in listed channels**. Everything else in the
server is untouched. Use it before going live.

On the guild-chat side, a tester is recognised by their [account link](Account-Linking) — the bot has no
Discord author to check when a line arrives from Minecraft, so it matches the Minecraft name back to a link
and checks that. **A tester with no link will not see their guild chat rewritten**, and without that rule
testing would silently relabel guild members who never agreed to take part.

## Live mode

Applies server-wide, except:

- **channels you excluded** in the scope view, and
- **channels where the bot lacks Manage Webhooks or Manage Messages** — those are skipped and left completely
  alone, with one warning to the log channel. They are never partially disguised.

The target is never disguised as themselves; reposting would cost a send and a delete to produce exactly the
same message.

## Stopping it

**Stop effect** on the panel, at any time. An effect with an expiry also ends on its own.

A lapsed effect is cleared the next time anything asks whether it is running, not only by its timer — so a
timer lost to a restart or a clock jump can never leave the disguise stuck on. The state is in a file, so a
restart does not end a running effect either.

## What it costs

A repost is a **new message**, and the original is deleted. So, while an effect is running:

- **the author cannot edit or delete their own message afterwards** — Discord considers it the bot's;
- **replies keep a jump link** instead of Discord's reply header;
- **messages carrying stickers, polls, forwards or voice notes are left undisguised** rather than reposted
  without them;
- **the real author is no longer visible on the message** — which is exactly why every disguised message is
  [audited](Auditing).

Reposts within a channel are chained so a burst arrives in the order it was sent.

## Before you run one live

- Set an [audit channel](Auditing). Without one, a disguised message has no record of who actually wrote it.
- Check the bot has **Manage Webhooks** and **Manage Messages** everywhere you mean it to apply.
- Exclude channels where deleted-and-reposted messages would be a problem — anything people rely on editing.
- Consider telling the server first. People notice.

## Next

- [Auditing](Auditing)
- [Admin panel](Admin-Panel)
- [Permissions](Permissions)
