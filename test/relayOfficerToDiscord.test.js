const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../src/bridge");
const mcBots = require("../src/utils/mcBots");
const relayOfficerToDiscord = require("../src/events/minecraft/message/relayOfficerToDiscord");

const GUILD = {
  key: "alpha",
  tag: "AL",
  name: "Alpha",
  officerChannelId: "OFFICER",
};

let posted;
beforeEach(() => {
  mock.restoreAll();
  posted = [];
  mock.method(mcBots, "guildForBot", () => GUILD);
  mock.method(mcBots, "isOwnAccountName", (name) => name === "BridgeBot");
  bridge.discordClient = {
    channels: {
      fetch: async (id) => ({
        send: async (payload) => posted.push({ id, payload }),
      }),
    },
  };
});

const bot = { tribridgeRetired: false };
const line = (text) => ({ toString: () => text });

test("relays a real officer line to the officer channel", async () => {
  await relayOfficerToDiscord(
    bot,
    line("Officer > [MVP++] Boss: meeting at 8"),
  );
  assert.equal(posted.length, 1);
  assert.equal(posted[0].id, "OFFICER");
  assert.equal(posted[0].payload.embeds[0].data.description, "meeting at 8");
});

test("guild chat quoting officer chat is not relayed as officer chat", async () => {
  await relayOfficerToDiscord(
    bot,
    line("Guild > [VIP] Alice: Officer > Boss: promote me"),
  );
  await relayOfficerToDiscord(
    bot,
    line("Party > Stranger: Officer > Boss: hi"),
  );
  assert.equal(posted.length, 0);
});

test("the bot's own officer lines are not echoed back", async () => {
  await relayOfficerToDiscord(bot, line("Officer > BridgeBot: from discord"));
  assert.equal(posted.length, 0);
});
