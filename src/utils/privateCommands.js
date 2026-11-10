const path = require("path");
const bridge = require("../bridge");
const getAllFiles = require("./getAllFiles");
const guildRoster = require("./guildRoster");
const linkedAccounts = require("./linkedAccounts");
const blacklist = require("./blacklist");
const chatQueue = require("./chatQueue");
const privateReply = require("./privateReply");
const { isValidMinecraftName } = require("./minecraftName");

/** Every private command starts with this. */
const PREFIX = "!";

const COMMANDS_ROOT = path.join(__dirname, "..", "privateCommands");
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,15}$/;

/**
 * Who may run a command. Only `member` exists today: anyone in a bridged guild.
 * A command naming a level this list does not know is refused at load time,
 * so a future staff command can never run for everyone because the check for
 * its level was forgotten.
 */
const PERMISSIONS = ["member"];

/** Silent gap between two commands from one player, whatever they are. */
const PLAYER_GAP_MS = 3_000;
/** How long a non-command DM waits before it earns another `!help` hint. */
const HINT_GAP_MS = 10 * 60_000;

/**
 * @typedef {object} PrivateCommand
 * @property {string} name
 * @property {string[]} [aliases]
 * @property {string} description
 * @property {string} [usage]
 * @property {'member'} [permission]
 * @property {number} [cooldownMs]
 * @property {(ctx: object) => Promise<void>} run
 * @property {string} category Filled in from the folder name.
 */

/**
 * Loads and checks every command under `root/<category>/<name>.js`.
 *
 * Throws on a malformed command or on two commands claiming one name or alias,
 * so the mistake stops startup instead of one command quietly shadowing
 * another.
 *
 * @param {string} [root]
 * @returns {{commands: PrivateCommand[], byName: Map<string, PrivateCommand>}}
 */
function loadCommands(root = COMMANDS_ROOT) {
  const commands = [];
  const byName = new Map();

  for (const folder of getAllFiles(root, true).sort()) {
    const category = path.basename(folder);

    for (const file of getAllFiles(folder).sort()) {
      if (!file.endsWith(".js")) continue;
      const command = { ...require(file), category };
      const where = path.relative(root, file);

      if (!NAME_PATTERN.test(command.name ?? "")) {
        throw new Error(`Private command ${where} has an invalid name.`);
      }
      if (typeof command.run !== "function") {
        throw new Error(`Private command ${where} has no run().`);
      }
      command.permission = command.permission ?? "member";
      if (!PERMISSIONS.includes(command.permission)) {
        throw new Error(
          `Private command ${where} needs unknown permission "${command.permission}".`,
        );
      }
      command.aliases = command.aliases ?? [];

      for (const key of [command.name, ...command.aliases]) {
        const lower = String(key).toLowerCase();
        if (byName.has(lower)) {
          throw new Error(
            `Private commands ${byName.get(lower).name} and ${command.name} both claim "${lower}".`,
          );
        }
        byName.set(lower, command);
      }

      commands.push(command);
    }
  }

  return { commands, byName };
}

let registry = null;

/** @returns {{commands: PrivateCommand[], byName: Map<string, PrivateCommand>}} */
function getRegistry() {
  if (!registry) registry = loadCommands();
  return registry;
}

/**
 * @param {string} nameOrAlias With or without the prefix.
 * @returns {PrivateCommand|null}
 */
function resolve(nameOrAlias) {
  const key = String(nameOrAlias ?? "")
    .replace(/^!/, "")
    .toLowerCase();
  return getRegistry().byName.get(key) ?? null;
}

/** @returns {PrivateCommand[]} Every command, in category then name order. */
function list() {
  return getRegistry().commands;
}

/**
 * `!online sb 2` → `{ name: "online", args: ["sb", "2"] }`.
 *
 * @param {string} content
 * @returns {{name: string, args: string[]}|null} null when it is not a command.
 */
function parseCommand(content) {
  const text = String(content ?? "").trim();
  if (!text.startsWith(PREFIX)) return null;
  const [name, ...args] = text.slice(PREFIX.length).split(/\s+/);
  if (!name) return null;
  return { name: name.toLowerCase(), args };
}

const lastCommandAt = new Map();
const lastUseAt = new Map();
const lastHintAt = new Map();

/** Drops cooldown entries nobody can be waiting on any more. */
function sweep(now) {
  for (const map of [lastCommandAt, lastUseAt, lastHintAt]) {
    if (map.size < 500) continue;
    for (const [key, at] of map) {
      if (now - at > HINT_GAP_MS) map.delete(key);
    }
  }
}

/**
 * Handles one private message to a bridge bot: checks who sent it, then runs
 * the command it names.
 *
 * Never throws — it runs inside a Minecraft event handler, where a rejection
 * ends the process.
 *
 * Membership is checked on every message, not only when the friend request was
 * accepted, and it fails closed: an inconclusive roster is a refusal. A clean
 * "not a member" also removes the friend, which catches anyone who left while
 * the bot missed the departure line.
 *
 * @param {import('./mcBots').BotRecord} record The bot that received it.
 * @param {object} guild That bot's registry record.
 * @param {string} sender Minecraft name, from `parseDirectMessage()`.
 * @param {string} content The message text.
 * @param {{now?: number}} [options]
 * @returns {Promise<'ran'|'refused'|'ignored'|'unknown'|'hint'|'cooldown'|'error'>}
 */
async function handleDirectMessage(
  record,
  guild,
  sender,
  content,
  options = {},
) {
  const now = options.now ?? Date.now();
  if (!isValidMinecraftName(sender)) return "ignored";

  const key = sender.toLowerCase();
  const reply = (lines) => privateReply.sendPrivateReply(record, sender, lines);

  try {
    sweep(now);
    const parsed = parseCommand(content);

    if (!parsed) {
      // A hint, not silence, so a member who typed `online` learns the
      // prefix — but rarely, so an auto-responder cannot loop with the bot.
      if (now - (lastHintAt.get(key) ?? -Infinity) < HINT_GAP_MS) {
        return "ignored";
      }
      lastHintAt.set(key, now);
      await reply(`Hi! I answer commands. Type ${PREFIX}help to see them.`);
      return "hint";
    }

    if (now - (lastCommandAt.get(key) ?? -Infinity) < PLAYER_GAP_MS) {
      return "ignored";
    }
    lastCommandAt.set(key, now);

    const membership = await guildRoster.findMembership(sender);
    if (membership.guilds.length === 0) {
      if (membership.inconclusive) {
        await reply(
          "I couldn't check your guild membership right now. Try again in a minute.",
        );
      } else {
        await reply(
          "Private commands are for members of the guilds this bridge serves.",
        );
        await chatQueue.sendChat(record, `/friend remove ${sender}`);
      }
      return "refused";
    }

    const link = await linkedAccounts.getLinkByName(sender);
    if (
      link &&
      (await blacklist.isBlacklisted(bridge.discordServerId, link.discordId))
    ) {
      await reply("You are blacklisted from the bridge.");
      return "refused";
    }

    const command = resolve(parsed.name);
    if (!command) {
      await reply(
        `Unknown command ${PREFIX}${parsed.name}. Type ${PREFIX}help for the list.`,
      );
      return "unknown";
    }

    const useKey = `${key}:${command.name}`;
    const cooldownMs = Number(command.cooldownMs) || 0;
    const since = now - (lastUseAt.get(useKey) ?? -Infinity);
    if (since < cooldownMs) {
      const wait = Math.ceil((cooldownMs - since) / 1000);
      await reply(`Wait ${wait}s before using ${PREFIX}${command.name} again.`);
      return "cooldown";
    }
    lastUseAt.set(useKey, now);

    await command.run({
      sender,
      record,
      guild,
      memberOf: membership.guilds,
      link,
      args: parsed.args,
      prefix: PREFIX,
      lineBudget: privateReply.lineBudget(sender),
      reply,
      commands: { resolve, list },
    });
    return "ran";
  } catch (error) {
    console.error(
      `[${record?.key}] private command from ${sender} failed:`,
      error,
    );
    await reply("Something went wrong running that command.").catch(() => {});
    return "error";
  }
}

/** Test hook: forgets every cooldown and the loaded registry. */
function reset() {
  lastCommandAt.clear();
  lastUseAt.clear();
  lastHintAt.clear();
  registry = null;
}

module.exports = {
  loadCommands,
  resolve,
  list,
  parseCommand,
  handleDirectMessage,
  reset,
  PREFIX,
  PERMISSIONS,
  PLAYER_GAP_MS,
};
