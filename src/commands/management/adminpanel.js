const { isAdmin } = require("../../utils/adminRoles");
const { mainView } = require("../../utils/adminPanel");

module.exports = {
  name: "adminpanel",
  description: "Open the admin panel to run and configure admin functions.",

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    // Ephemeral: the panel exposes who is being impersonated and every
    // channel the effect is scoped to, which is nobody else's business.
    return interaction.reply({
      ...mainView(interaction.user.id),
      ephemeral: true,
    });
  },
};
