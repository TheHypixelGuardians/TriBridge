const {
  getRequestChannelId,
  createRequest,
  attachMessage,
  buildRequestEmbed,
} = require("../../../utils/featureRequests");

module.exports = async (client, interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== "request_modal") return;

  await interaction.deferReply({ ephemeral: true });

  const channelId = getRequestChannelId();
  if (!channelId) {
    return interaction.editReply(
      "❌ No feature request channel is configured.",
    );
  }

  const title = interaction.fields.getTextInputValue("title").trim();
  const description = interaction.fields
    .getTextInputValue("description")
    .trim();

  // Persisted before the send so two concurrent submits cannot share an ID.
  const record = createRequest({
    userId: interaction.user.id,
    userTag: interaction.user.username,
    title,
    description,
  });

  try {
    const channel = await client.channels.fetch(channelId);

    // The description is arbitrary member-supplied text posted by the bot,
    // so without this an @everyone in a request body would ping.
    const message = await channel.send({
      embeds: [buildRequestEmbed(record)],
      allowedMentions: { parse: [] },
    });

    attachMessage(record.id, channel.id, message.id);
    await interaction.editReply(`✅ Submitted as request **#${record.id}**.`);
  } catch (error) {
    console.error(error);
    await interaction.editReply(
      `⚠️ Saved as request **#${record.id}**, but I could not post it — check my permissions in the request channel.`,
    );
  }
};
