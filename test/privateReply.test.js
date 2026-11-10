const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPrivateReplies,
  MAX_PACKETS,
} = require("../src/utils/privateReply");

test("a short reply is one /msg packet", () => {
  assert.deepEqual(buildPrivateReplies("Notch", "Pong!"), ["/msg Notch Pong!"]);
});

test("long lines split under 100 characters, at commas and spaces", () => {
  const names = Array.from({ length: 30 }, (_, i) => `Player${i}`).join(", ");
  const packets = buildPrivateReplies("Notch", names);
  assert.ok(packets.length > 1);
  for (const packet of packets) {
    assert.ok(packet.length <= 100, packet);
    assert.ok(packet.startsWith("/msg Notch "));
  }
  assert.ok(packets[0].endsWith(","));
});

test("a reply never sends more than the packet cap", () => {
  const lines = Array.from({ length: 12 }, (_, i) => `line ${i}`);
  const packets = buildPrivateReplies("Notch", lines);
  assert.equal(packets.length, MAX_PACKETS);
  assert.ok(packets.at(-1).endsWith(" ..."));
});

test("newlines and section signs cannot reach the packet", () => {
  const [packet, ...rest] = buildPrivateReplies(
    "Notch",
    "hi\n/guild disband §k",
  );
  assert.equal(rest.length, 0);
  assert.equal(packet, "/msg Notch hi /guild disband");
});

test("an invalid name gets no packets at all", () => {
  assert.deepEqual(buildPrivateReplies("Notch /g disband", "hi"), []);
});
