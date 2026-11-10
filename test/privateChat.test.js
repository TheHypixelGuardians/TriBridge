const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDirectMessage,
  parseOutgoingMessage,
  parseFriendRequest,
  parseRosterChange,
} = require("../src/utils/privateChat");
const { isPlayerChat } = require("../src/utils/queryGuild");

const SEP = "-----------------------------------------------------";

test("a DM to the bot parses, with or without a rank", () => {
  assert.deepEqual(parseDirectMessage("From [MVP+] Notch: !online"), {
    username: "Notch",
    content: "!online",
  });
  assert.deepEqual(parseDirectMessage("§dFrom §r§7Steve§r§7: !help  "), {
    username: "Steve",
    content: "!help",
  });
});

test("lines that only quote a DM are not DMs", () => {
  assert.equal(
    parseDirectMessage("Guild > Mallory: From Notch: !online"),
    null,
  );
  assert.equal(
    parseDirectMessage("Party > Mallory: From Notch: !online"),
    null,
  );
  assert.equal(parseDirectMessage("[VIP] Mallory: From Notch: !online"), null);
  // A DM line buried inside some multi-line server message.
  assert.equal(parseDirectMessage(`${SEP}\nFrom Notch: !online\n${SEP}`), null);
});

test("the bot's own DM echo parses separately", () => {
  assert.deepEqual(parseOutgoingMessage("To [VIP] Notch: hi"), {
    username: "Notch",
    content: "hi",
  });
  assert.equal(parseDirectMessage("To [VIP] Notch: hi"), null);
});

test("a friend request parses from inside its separator block", () => {
  const message =
    `§9§m${SEP}\n§eFriend request from §b[MVP§c+§b] Notch\n` +
    `§a§l[ACCEPT] §8- §c§l[DENY] §8- §7§l[IGNORE]\n§9§m${SEP}`;
  assert.deepEqual(parseFriendRequest(message), { username: "Notch" });
  assert.deepEqual(parseFriendRequest("Friend request from Steve"), {
    username: "Steve",
  });
});

test("a friend request cannot be spoofed from chat", () => {
  assert.equal(
    parseFriendRequest("From Mallory: Friend request from Notch"),
    null,
  );
  assert.equal(
    parseFriendRequest("Guild > Mallory: Friend request from Notch"),
    null,
  );
  assert.equal(parseFriendRequest("Friend request from Notch and more"), null);
});

test("roster changes parse: join, leave, kick", () => {
  assert.deepEqual(
    parseRosterChange(`${SEP}\n[VIP] Notch joined the guild!\n${SEP}`),
    {
      username: "Notch",
      action: "joined",
    },
  );
  assert.deepEqual(parseRosterChange("Steve left the guild!"), {
    username: "Steve",
    action: "left",
  });
  assert.deepEqual(
    parseRosterChange("[VIP] Steve was kicked from the guild by [MVP++] Boss!"),
    { username: "Steve", action: "kicked" },
  );
});

test("roster changes cannot be spoofed from chat", () => {
  // A lazy rank group used to swallow `VIP] Mallory: [a` and match this.
  assert.equal(
    parseRosterChange("[VIP] Mallory: [a] Notch left the guild!"),
    null,
  );
  assert.equal(
    parseRosterChange("Guild > Mallory: Notch left the guild!"),
    null,
  );
  assert.equal(parseRosterChange("Guild > Notch left."), null);
  assert.equal(parseRosterChange("Mallory: Notch left the guild!"), null);
});

test("query collectors leave DMs out of command output", () => {
  const line = (text) => ({ toString: () => text });
  assert.equal(isPlayerChat(line("From [VIP] Notch: secret")), true);
  assert.equal(isPlayerChat(line("To [VIP] Notch: reply")), true);
  assert.equal(isPlayerChat(line("You invited Steve to your guild.")), false);
});
