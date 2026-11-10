module.exports = {
  name: "help",
  aliases: ["commands", "?"],
  description: "Lists the private commands, or explains one.",
  usage: "!help [command]",
  cooldownMs: 3_000,

  run: async (ctx) => {
    const { prefix, commands } = ctx;

    if (ctx.args[0]) {
      const command = commands.resolve(ctx.args[0]);
      if (!command) {
        return ctx.reply(
          `There is no ${prefix}${ctx.args[0].replace(/^!/, "")} command. Type ${prefix}help for the list.`,
        );
      }
      const aliases = command.aliases.length
        ? ` Also: ${command.aliases.map((a) => prefix + a).join(", ")}.`
        : "";
      return ctx.reply([
        `${command.usage ?? prefix + command.name} - ${command.description}${aliases}`,
      ]);
    }

    const byCategory = new Map();
    for (const command of commands.list()) {
      if (!byCategory.has(command.category))
        byCategory.set(command.category, []);
      byCategory.get(command.category).push(prefix + command.name);
    }

    return ctx.reply([
      `Commands (${prefix}help <command> for more):`,
      ...[...byCategory].map(
        ([category, names]) => `${category}: ${names.join(", ")}`,
      ),
    ]);
  },
};
