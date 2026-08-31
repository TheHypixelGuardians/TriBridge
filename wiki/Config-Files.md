# Config files

Everything TriBridge remembers lives in the project root, next to the repository. All of it is **gitignored**,
so a `git pull` never touches it and nothing secret can be committed by accident.

Each file is created on demand the first time it is needed. A missing file is not an error — it means the
feature has not been configured yet.

`.env` is the exception: it is the one file you write yourself, and the bot will not start without it. Copy
the `.env.example` template in the repository and fill it in — that copy is tracked in git, the `.env` it
produces is not.

| File                         | Holds                                               | Managed with                                     |
|------------------------------|-----------------------------------------------------|--------------------------------------------------|
| `.env`                       | Token, bridge channel, log channel, first account   | Editing it — see [Configuration](Configuration)  |
| `.minecraft-auth/`           | Cached Microsoft tokens, one entry per account      | The bot                                          |
| `guildsConfig.json`          | The Hypixel guild registry                          | [`/guilds`](Hypixel-Guilds)                      |
| `adminRolesConfig.json`      | Discord role ids that hold bot-admin                | [`/adminrole`](Admin-Roles)                      |
| `linkedAccountsConfig.json`  | Discord user → Minecraft name and UUID              | [`/link`, `/unlink`](Account-Linking)            |
| `linkRoleConfig.json`        | The role given to linked users                      | [`/linkrole`](Link-Role)                         |
| `auditChannelConfig.json`    | The default audit channel                           | [`/auditchannel`](Auditing)                      |
| `globalProfileConfig.json`   | The running global profile change, and its scope    | [`/adminpanel`](Global-Profile-Change)           |
| `featureRequestsConfig.json` | The request channel, the next id, and every request | [`/request`, `/requeststatus`](Feature-Requests) |

## Back these up

`guildsConfig.json` and `linkedAccountsConfig.json` are the two that cost real work to rebuild — the registry
is the whole bridge setup, and the links are something every member did by hand. Back them up alongside
`.env`.

`.minecraft-auth/` is worth keeping too: losing it does not lose anything permanent, but every account has to
go through a device-code sign-in again.

## Things worth knowing

**A malformed file degrades to defaults rather than crashing.** A `guildsConfig.json` that will not parse is
read as an empty registry, and the bot starts anyway with a warning — `/guilds` is the only way to repair the
registry, so Discord has to come up even when the registry is broken.

**`key` and `account` in `guildsConfig.json` are immutable**, and the commands enforce it. `account` is the
key prismarine-auth hashes for its token cache: editing it by hand silently starts a fresh device-code flow
against a different cache file, against an account nothing is signed in to. Remove the guild and add it again
instead.

**Per-guild channel overrides live in `guildsConfig.json`**, not in `auditChannelConfig.json` — so removing a
guild cannot leave an orphaned channel setting behind.

**Each file is cached in memory** after its first read and written back whole on a change. Hand-editing a file
while the bot is running will be overwritten by the next write; stop the process first.

**Never print or share these.** `.env` holds a bot token, `.minecraft-auth/` holds live Microsoft credentials,
and `guildsConfig.json` holds account addresses — which is why `/guilds` masks them in every reply.

## Next

- [Configuration](Configuration)
- [Hypixel guilds](Hypixel-Guilds)
- [Updating](Updating)
