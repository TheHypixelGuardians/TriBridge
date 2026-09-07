const bridge = require("../../../bridge");
const guilds = require("../../../utils/guilds");
const db = require("../../../utils/db");

/**
 * Publishes the channels this bot owns to the THG community bot's database.
 *
 * The community bot runs the global profile change in every ordinary channel,
 * and has to leave two kinds of channel alone:
 *
 * - **The bridge channel**, because `relayToMinecraft.js` does its own repost
 *   there. Two bots deleting the same message race, and the loser deletes a
 *   message the winner already replaced.
 * - **Officer channels**, because a webhook repost is authored by a bot and
 *   `relayOfficerToMinecraft.js` drops anything a bot authored. An officer's
 *   line would vanish from Discord and never reach Hypixel, with no error
 *   anywhere.
 *
 * Publishing them is deliberately preferred over configuring the same ids twice:
 * an officer channel changes with `/guilds edit`, and a second copy in the
 * community bot's configuration would quietly go stale the moment it did. This
 * is the only thing this bot writes to that database.
 *
 * Runs after 000resolveServer, which is what resolves `discordServerId`.
 */
module.exports = async () => {
  if (!db.isConfigured()) return;

  const guildId = bridge.discordServerId;
  if (!guildId) {
    console.error(
      "Cannot publish the bridge channels: the Discord server is unresolved.",
    );
    return;
  }

  const wanted = new Map();

  if (bridge.discordChannelId) {
    wanted.set(bridge.discordChannelId, "bridge");
  }

  for (const guild of guilds.getAll()) {
    if (guild.officerChannelId) wanted.set(guild.officerChannelId, "officer");
  }

  for (const [channelId, kind] of wanted) {
    await db.query(
      `INSERT INTO "BridgeChannel" ("id", "guildId", "channelId", "kind", "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
       ON CONFLICT ("guildId", "channelId")
       DO UPDATE SET "kind" = EXCLUDED."kind", "updatedAt" = now()`,
      [guildId, channelId, kind],
    );
  }

  // Anything published earlier and no longer ours is dropped, so a channel that
  // stops being an officer channel becomes disguisable again rather than being
  // skipped forever.
  const ids = [...wanted.keys()];
  await db.query(
    `DELETE FROM "BridgeChannel"
      WHERE "guildId" = $1
        AND NOT ("channelId" = ANY($2::text[]))`,
    [guildId, ids],
  );

  console.log(
    `Published ${wanted.size} bridge channel(s) to the community bot's database.`,
  );
};
