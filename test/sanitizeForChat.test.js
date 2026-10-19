const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeForChat,
  buildGuildChatCommand,
  buildOfficerChatCommand,
  MAX_CHAT_LENGTH,
} = require("../src/utils/sanitizeForChat");

test("newlines collapse so a second line never reaches command position", () => {
  assert.equal(
    sanitizeForChat("hi\n/guild disband\r\nnow"),
    "hi /guild disband now",
  );
});

test("strips formatting codes, lone § and control characters", () => {
  assert.equal(sanitizeForChat("§aGreen"), "Green");
  assert.equal(sanitizeForChat("hello §"), "hello");
  assert.equal(sanitizeForChat("a§\nb"), "a b");
  assert.equal(
    sanitizeForChat("bell\u0007x del\u007fy nul\u0000z"),
    "bell x del y nul z",
  );
  assert.doesNotMatch(
    sanitizeForChat("§§§\u0001\u001f§"),
    /[\u0000-\u001f\u007f§]/,
  );
});

test("builds /gc and /oc commands", () => {
  assert.equal(buildGuildChatCommand("Alice", "hi"), "/gc Alice: hi");
  assert.equal(buildOfficerChatCommand("Alice", "hi"), "/oc Alice: hi");
});

test("returns null when nothing is left to send", () => {
  assert.equal(buildGuildChatCommand("Alice", " \n§ "), null);
});

test("truncates the body, never the name, to one chat packet", () => {
  const command = buildGuildChatCommand("Alice", "x".repeat(500));
  assert.equal(command.length, MAX_CHAT_LENGTH);
  assert.ok(command.startsWith("/gc Alice: "));
  assert.ok(command.endsWith("..."));
});

test("the display name is sanitised too", () => {
  assert.equal(
    buildGuildChatCommand("Ev§il\nName\u0007", "hi"),
    "/gc Evl Name: hi",
  );
  assert.equal(buildGuildChatCommand("§\u0001", "hi"), "/gc Member: hi");
});
