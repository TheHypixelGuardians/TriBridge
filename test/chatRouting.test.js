const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const guilds = require("../src/utils/guilds");
const { routeMessage } = require("../src/utils/chatRouting");

const ALPHA = { key: "alpha", tag: "AL", name: "Alpha", enabled: true };
const BETA = { key: "beta", tag: "BE", name: "Beta", enabled: true };

// Stubbed so the tests never read a real guildsConfig.json from the checkout.
let broadcast = true;
beforeEach(() => {
  mock.restoreAll();
  broadcast = true;
  mock.method(guilds, "getEnabled", () => [ALPHA, BETA]);
  mock.method(guilds, "broadcastByDefault", () => broadcast);
  mock.method(guilds, "getDefault", () => BETA);
});

const keys = (result) => result.targets.map((g) => g.key);

test("untagged messages broadcast", () => {
  const result = routeMessage("hello");
  assert.deepEqual(keys(result), ["alpha", "beta"]);
  assert.equal(result.body, "hello");
  assert.equal(result.targeted, false);
});

test("a known tag picks one guild and is stripped", () => {
  const result = routeMessage("!be hi there");
  assert.deepEqual(keys(result), ["beta"]);
  assert.equal(result.body, "hi there");
  assert.equal(result.targeted, true);
});

test("an unknown tag broadcasts untouched and is reported", () => {
  const result = routeMessage("!nope hi");
  assert.deepEqual(keys(result), ["alpha", "beta"]);
  assert.equal(result.body, "!nope hi");
  assert.equal(result.unknownTag, "nope");
});

test("!! escapes the routing prefix", () => {
  const result = routeMessage("!!be hi");
  assert.deepEqual(keys(result), ["alpha", "beta"]);
  assert.equal(result.body, "!be hi");
});

test("with broadcast off, untagged messages go to the default guild", () => {
  broadcast = false;
  assert.deepEqual(keys(routeMessage("hello")), ["beta"]);
});

test("candidates scope tags to the channel's own guilds", () => {
  const result = routeMessage("!be hi", { candidates: [ALPHA] });
  assert.deepEqual(keys(result), ["alpha"]);
  assert.equal(result.unknownTag, "be");
});
