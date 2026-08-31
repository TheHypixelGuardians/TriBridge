const { isAdmin } = require("../../utils/adminRoles");
const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");
const createMcBot = require("../../utils/createMcBot");
const { registerSink, requestSignIn } = require("../../utils/deviceCode");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
} = require("../../utils/commandGuild");

// Long enough for a cached-token connect to spawn, short enough to stay well
// inside the interaction's life. A sign-in flow blocks far longer than this, so
// the reply reports "started" rather than waiting for it.
const SPAWN_WAIT_MS = 8_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for a record to come online, giving up after a while.
 *
 * @param {import('../../utils/mcBots').BotRecord} record
 * @returns {Promise<boolean>}
 */
async function waitForSpawn(record) {
  const deadline = Date.now() + SPAWN_WAIT_MS;
  while (Date.now() < deadline) {
    if (record.connected && record.bot) return true;
    if (record.awaitingDeviceCode) return false;
    await sleep(250);
  }
  return Boolean(record.connected && record.bot);
}

module.exports = {
  name: "login",
  description: "Connect the bot to Hypixel.",
  options: [
    {
      ...GUILD_OPTION,
      description:
        "Which Hypixel guild to connect. Defaults to every disconnected guild.",
    },
  ],

  autocomplete: guildOptionAutocomplete(),

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    if (!guilds.isConfigured()) {
      return interaction.editReply(
        "⚠️ No Hypixel guilds are configured yet.\n> An admin can add one with `/guilds add`.",
      );
    }

    const raw = interaction.options.getString("guild");
    let wanted;

    if (raw) {
      const key = guilds.resolveKey(raw);
      if (!key) {
        return interaction.editReply(
          `❌ There is no Hypixel guild called \`${raw}\`.\n> Run \`/guilds list\` to see the registered ones.`,
        );
      }
      wanted = [guilds.get(key)];
    } else {
      // Deliberately not "the default guild" like every other command:
      // after an outage, "connect the bot" means "connect whatever is down".
      wanted = guilds.getEnabled();
    }

    const targets = wanted.filter((guild) => {
      const record = mcBots.ensureRecord(guild.key);
      return !record.connected;
    });

    const alreadyUp = wanted.length - targets.length;

    if (targets.length === 0) {
      return interaction.editReply(
        alreadyUp === 1 && wanted.length === 1
          ? "✅ The bot is already connected to Hypixel."
          : `✅ All ${alreadyUp} guilds are already connected.`,
      );
    }

    await interaction.editReply(
      `🔄 Connecting ${targets.map((g) => `**${g.name}**`).join(", ")}…`,
    );

    const results = await Promise.all(
      targets.map((guild) => connect(guild, interaction)),
    );

    const lines = results.map(({ guild, state, error }) => {
      if (state === "connected") return `> ✅ **${guild.name}** — connected.`;
      if (state === "busy")
        return `> 🔄 **${guild.name}** — a connection attempt is already in progress.`;
      if (state === "signin")
        return `> 🔐 **${guild.name}** — needs a Microsoft sign-in; the code has been sent to you.`;
      if (state === "failed") return `> ❌ **${guild.name}** — ${error}`;
      return `> 🔄 **${guild.name}** — still connecting; check \`/ping\` in a moment.`;
    });

    if (alreadyUp > 0)
      lines.push(`> ✅ ${alreadyUp} other guild(s) were already connected.`);

    return interaction.editReply(lines.join("\n"));
  },
};

/**
 * @param {object} guild
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<{guild: object, state: string, error?: string}>}
 */
async function connect(guild, interaction) {
  const record = mcBots.ensureRecord(guild.key);
  if (record.connecting || record.awaitingDeviceCode) {
    return { guild, state: "busy" };
  }

  // Route any device code to this admin's ephemeral follow-up rather than the
  // log channel — see utils/deviceCode.js for why it must stay private.
  const unregister = registerSink(guild.key, (embed) =>
    interaction.followUp({ embeds: [embed], ephemeral: true }),
  );

  const attempt = createMcBot(guild.key, {
    onMsaCode: (info, g) => requestSignIn(info, g),
  })
    .catch((error) => {
      record.lastError = error;
      return null;
    })
    .finally(unregister);

  // A cached token connects in a second or two; a sign-in takes minutes, so
  // don't hold the reply open for it.
  const spawned = await Promise.race([
    attempt.then(() => waitForSpawn(record)),
    sleep(SPAWN_WAIT_MS).then(() => Boolean(record.connected)),
  ]);

  if (spawned) return { guild, state: "connected" };
  if (record.awaitingDeviceCode) return { guild, state: "signin" };
  if (record.lastError)
    return { guild, state: "failed", error: record.lastError.message };
  return { guild, state: "pending" };
}
