const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  PROMOTION_RANKS,
  getRank,
  rankRoleId,
  findInRoster,
  parseSetRankResponse,
  stripRankPrefix,
  rankNickname,
} = require("../src/utils/guildPromotion");

test("ranks are ordered highest first and looked up by value only", () => {
  assert.deepEqual(
    PROMOTION_RANKS.map((rank) => rank.name),
    ["Senior Officer", "Officer", "Trial Officer", "Veteran", "Elite", "Titan"],
  );
  assert.equal(getRank("elite").name, "Elite");
  // A forged option value must not resolve to anything.
  assert.equal(getRank("Guild Master"), null);
});

test("the officer tiers share one in-game rank but not a role", () => {
  const officers = ["senior_officer", "officer", "trial_officer"].map(getRank);
  assert.deepEqual(
    officers.map((rank) => rank.gameRank),
    ["Officer", "Officer", "Officer"],
  );
  assert.equal(new Set(officers.map((rank) => rank.roleEnv)).size, 3);
  assert.equal(
    new Set(PROMOTION_RANKS.map((rank) => rank.roleEnv)).size,
    PROMOTION_RANKS.length,
  );
});

test("rankRoleId reads only id-shaped values", () => {
  const rank = getRank("titan");
  assert.equal(
    rankRoleId(rank, { RANK_ROLE_TITAN: " 123456789012345678 " }),
    "123456789012345678",
  );
  assert.equal(rankRoleId(rank, { RANK_ROLE_TITAN: "Titan" }), null);
  assert.equal(rankRoleId(rank, {}), null);
});

test("findInRoster tells found, absent and inconclusive apart", () => {
  const roster = [
    "§b-- §aVeteran §b--",
    "§a[MVP+] Notch §c● §7jeb_ §c●",
    "Total Members: 2",
  ];
  assert.equal(findInRoster(roster, "notch"), "found");
  assert.equal(findInRoster(roster, "Dinnerbone"), "absent");
  assert.equal(findInRoster(["Unknown command."], "Notch"), "inconclusive");
});

test("parseSetRankResponse reads success, refusals and unknown output", () => {
  assert.equal(
    parseSetRankResponse(
      "[MVP+] Notch was promoted from Knight to Elite",
      "Notch",
      "Elite",
    ).ok,
    true,
  );
  assert.equal(
    parseSetRankResponse(
      "Notch was demoted from Veteran to Titan",
      "Notch",
      "Titan",
    ).ok,
    true,
  );
  assert.match(
    parseSetRankResponse("Notch is not in your guild!", "Notch", "Elite")
      .message,
    /not in that guild/,
  );
  assert.match(
    parseSetRankResponse(
      "You must be the Guild Master to use that command!",
      "Notch",
      "Elite",
    ).message,
    /not allowed/,
  );
  const unknown = parseSetRankResponse("Something `odd`", "Notch", "Elite");
  assert.equal(unknown.ok, false);
  assert.doesNotMatch(unknown.message, /`odd`/);
  assert.equal(
    parseSetRankResponse("", "Notch", "Elite").message,
    "no answer from Hypixel",
  );
});

test("the nickname replaces an existing rank prefix and fits Discord's limit", () => {
  assert.equal(stripRankPrefix("[Knight] Notch"), "Notch");
  assert.equal(stripRankPrefix("Notch"), "Notch");
  assert.equal(rankNickname("Veteran", "Notch"), "[Veteran] Notch");
  assert.equal(rankNickname("Elite", "[Knight] Notch"), "[Elite] Notch");
  assert.equal(
    rankNickname("Trial Officer", "[Veteran] Notch"),
    "[Trial Officer] Notch",
  );
  assert.ok(rankNickname("Veteran", "a".repeat(40)).length <= 32);
});
