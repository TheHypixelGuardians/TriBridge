const getLocalCommands = require("../../../utils/getLocalCommands");
const getApplicationCommands = require("../../../utils/getApplicationCommands");
const areCommandsDifferent = require("../../../utils/areCommandsDifferent");

module.exports = async (client) => {
  try {
    const localCommands = getLocalCommands();
    const applicationCommands = await getApplicationCommands(client);

    for (const localCommand of localCommands) {
      const { name, description, options } = localCommand;
      // Sent as null, not left out, so removing it from a command clears it
      // on Discord's side too.
      const defaultMemberPermissions =
        localCommand.defaultMemberPermissions ?? null;

      const existingCommand = applicationCommands.cache.find(
        (cmd) => cmd.name === name,
      );

      if (existingCommand) {
        if (localCommand.deleted) {
          await applicationCommands.delete(existingCommand.id);
          console.log(`Deleted command ${name}.`);
          continue;
        }

        if (areCommandsDifferent(existingCommand, localCommand)) {
          await applicationCommands.edit(existingCommand.id, {
            description,
            options,
            defaultMemberPermissions,
          });

          console.log(`Edited command ${name}.`);
        }
      } else {
        if (localCommand.deleted) {
          console.log(`Skipping registering command ${name}.`);
          continue;
        }

        await applicationCommands.create({
          name,
          description,
          options,
          defaultMemberPermissions,
        });

        console.log(`Registered command ${name}.`);
      }
    }
  } catch (error) {
    console.log(error);
  }
};
