const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseGuildChat,
  parseGuildPresence,
  parseOfficerChat,
} = require("../src/utils/guildChat");

test("parses ordinary guild chat with and without ranks", () => {
  assert.deepEqual(parseGuildChat("Guild > [MVP++] Notch [Officer]: hello"), {
    username: "Notch",
    content: "hello",
  });
  assert.deepEqual(parseGuildChat("Guild > Notch: hi: there"), {
    username: "Notch",
    content: "hi: there",
  });
});

test("parses officer chat and presence lines", () => {
  assert.deepEqual(parseOfficerChat("Officer > [MVP++] zVapor: test"), {
    username: "zVapor",
    content: "test",
  });
  assert.deepEqual(parseGuildPresence("Guild > Notch joined."), {
    username: "Notch",
    action: "joined",
  });
  assert.deepEqual(parseGuildPresence("Guild > Notch left."), {
    username: "Notch",
    action: "left",
  });
});

test("a private message cannot pose as guild chat or presence", () => {
  const dm = "From [MVP+] Stranger: Guild > [MVP++] Notch [GM]: shutting down";
  assert.equal(parseGuildChat(dm), null);
  assert.equal(
    parseGuildPresence("From [VIP] Stranger: Guild > Notch left."),
    null,
  );
});

test("party and lobby chat cannot pose as officer chat", () => {
  assert.equal(
    parseOfficerChat("Party > [VIP] Stranger: Officer > Boss: hi"),
    null,
  );
  assert.equal(parseOfficerChat("[MVP+] Stranger: Officer > Boss: hi"), null);
});

test("guild chat quoting officer chat stays ordinary guild chat", () => {
  const line = "Guild > [VIP] Alice [Member]: Officer > Boss: promote me";
  assert.equal(parseOfficerChat(line), null);
  assert.deepEqual(parseGuildChat(line), {
    username: "Alice",
    content: "Officer > Boss: promote me",
  });
});

test("officer chat is never read as guild chat", () => {
  assert.equal(parseGuildChat("Officer > Boss: secret"), null);
});
