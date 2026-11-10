const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGuildList } = require("../src/utils/guildOnline");

test("reads online members by rank, and the member total", () => {
  const result = parseGuildList([
    "§b--------- §6Guild§b ---------",
    "Guild Name: Example",
    "§2-- Guild Master --",
    "§a[MVP++] Boss §a●",
    "§2-- Member --",
    "§a[VIP] Notch §a●  §7Steve §c●  §ajeb_ §a●",
    "Total Members: 40",
    "Online Members: 3",
  ]);
  assert.deepEqual(Object.fromEntries(result.ranks), {
    "Guild Master": ["Boss"],
    Member: ["Notch", "jeb_"],
  });
  assert.equal(result.totalOnline, 3);
  assert.equal(result.totalMembers, 40);
});
