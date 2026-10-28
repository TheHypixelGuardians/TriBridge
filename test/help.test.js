const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits, PermissionsBitField } = require("discord.js");
const {
  canSeeCommand,
  helpPagesFor,
  buildEmbed,
} = require("../src/commands/information/help");

const perms = (...flags) => new PermissionsBitField(flags);
const member = { botAdmin: false, permissions: perms() };
const admin = { botAdmin: true, permissions: perms() };

test("bot-admin commands only show for bot-admin roles", () => {
  assert.equal(canSeeCommand({ adminOnly: true }, member), false);
  assert.equal(canSeeCommand({ adminOnly: true }, admin), true);
  assert.equal(canSeeCommand({}, member), true);
});

test("permissionsRequired must all be held, Administrator passes", () => {
  const command = {
    permissionsRequired: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
    ],
  };
  assert.equal(canSeeCommand(command, member), false);
  assert.equal(
    canSeeCommand(command, {
      botAdmin: false,
      permissions: perms(PermissionFlagsBits.KickMembers),
    }),
    false,
  );
  assert.equal(
    canSeeCommand(command, {
      botAdmin: false,
      permissions: perms(
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
      ),
    }),
    true,
  );
  assert.equal(
    canSeeCommand(command, {
      botAdmin: false,
      permissions: perms(PermissionFlagsBits.Administrator),
    }),
    true,
  );
  assert.equal(
    canSeeCommand(command, { botAdmin: true, permissions: null }),
    false,
  );
});

test("pages drop hidden commands and empty categories", () => {
  const pages = [
    {
      category: "Information",
      entries: [{ line: "`/ping`", adminOnly: false }],
    },
    {
      category: "Management",
      entries: [{ line: "`/send`", adminOnly: true }],
    },
  ];
  assert.deepEqual(helpPagesFor(member, pages), [
    { category: "Information", lines: ["`/ping`"] },
  ]);
  assert.equal(helpPagesFor(admin, pages).length, 2);
});

test("every page says why a command can be missing", () => {
  const embed = buildEmbed([{ category: "Info", lines: ["`/ping`"] }], 0);
  assert.match(embed.data.description, /Missing a command\?/);
});
