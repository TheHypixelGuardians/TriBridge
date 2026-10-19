const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const queryGuild = require("../src/utils/queryGuild");

const line = (text) => ({ toString: () => text, toMotd: () => text });

/** A bot that answers every command with the given lines, in order. */
function fakeRecord(replies) {
  const bot = new EventEmitter();
  bot.tribridgeRetired = false;
  bot.sent = [];
  bot.chat = (text) => {
    bot.sent.push(text);
    setImmediate(() => {
      for (const reply of replies) bot.emit("message", line(reply));
    });
  };
  return { bot, connected: true, queue: Promise.resolve() };
}

const FAST = { idleMs: 20, maxMs: 200, settleMs: 0 };

test("collects the server's reply", async () => {
  const record = fakeRecord(["You invited Steve to your guild."]);
  const result = await queryGuild(record, "/guild invite Steve", FAST);
  assert.deepEqual(result, {
    ok: true,
    lines: ["You invited Steve to your guild."],
  });
  assert.deepEqual(record.bot.sent, ["/guild invite Steve"]);
});

test("leaves out guild chat, officer chat and presence heard meanwhile", async () => {
  const record = fakeRecord([
    "Officer > Boss: do not leak this",
    "Guild > [VIP] Alice: I invited my friend",
    "Guild > Notch joined.",
    "Steve has already been invited to your guild!",
  ]);
  const result = await queryGuild(record, "/guild invite Steve", FAST);
  assert.deepEqual(result.lines, [
    "Steve has already been invited to your guild!",
  ]);
});

test("refuses when the bot is offline", async () => {
  const record = fakeRecord([]);
  record.connected = false;
  assert.deepEqual(await queryGuild(record, "/guild list", FAST), {
    ok: false,
    reason: "offline",
  });
  assert.deepEqual(await queryGuild(null, "/guild list", FAST), {
    ok: false,
    reason: "offline",
  });
});

test("queries on one bot run one at a time", async () => {
  const record = fakeRecord(["ok"]);
  const order = [];
  const original = record.bot.chat;
  record.bot.chat = (text) => {
    order.push(
      `send ${text} with ${record.bot.listenerCount("message")} listener(s)`,
    );
    original(text);
  };
  await Promise.all([
    queryGuild(record, "/a", FAST),
    queryGuild(record, "/b", FAST),
  ]);
  assert.deepEqual(order, [
    "send /a with 1 listener(s)",
    "send /b with 1 listener(s)",
  ]);
});
