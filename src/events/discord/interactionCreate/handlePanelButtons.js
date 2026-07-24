const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const {isAdmin} = require('../../../utils/adminRoles');
const {
    DURATION_CHOICES,
    customId,
    parseCustomId,
    getDraft,
    clearDraft,
    mainView,
    profileView,
    scopeView,
} = require('../../../utils/adminPanel');
const {announceStarted, announceEnded} = require('../../../utils/disguise');
const {parseDuration} = require('../../../utils/duration');
const {
    getState,
    start,
    stop,
    armExpiry,
    setDirection,
    setTesters,
    setTestChannels,
    setExcludedChannels,
} = require('../../../utils/globalProfile');
const {isAllowedGuild} = require('../../../utils/guildGuard');
const {getLink} = require('../../../utils/linkedAccounts');
const {resolveMember} = require('../../../utils/linkRole');

/**
 * Begins a global profile change from the panel's draft.
 */
async function startEffect(interaction, mode, invokerId) {
    const draft = getDraft(invokerId);

    if (!draft.targetId) {
        return interaction.reply({
            content: '❌ Pick who everybody should look like first.',
            ephemeral: true,
        });
    }

    if (!draft.duration) {
        return interaction.reply({
            content: '❌ Pick how long it should run first.',
            ephemeral: true,
        });
    }

    // Fetched by id rather than swept off the roster: a bare guild.members
    // .fetch() needs the privileged GuildMembers intent, which index.js does
    // not request.
    const member = await resolveMember(draft.targetId);
    if (!member) {
        return interaction.reply({
            content: `❌ That member is no longer in this server, so I cannot copy their profile.`,
            ephemeral: true,
        });
    }

    // Snapshotted here rather than looked up per message: the gate runs on
    // every message in the server and must not make API calls.
    const link = getLink(member.id);
    const state = start({
        target: {
            userId: member.id,
            name: member.displayName,
            avatarURL: member.displayAvatarURL({size: 256}),
            mcName: link?.name ?? null,
            mcUuid: link?.uuid ?? null,
        },
        durationMs: draft.duration.ms,
        startedBy: invokerId,
        mode,
    });

    armExpiry((previous) => announceEnded(previous, 'the time ran out'));
    clearDraft(invokerId);

    await interaction.update(mainView(invokerId));
    await announceStarted(state, invokerId);
}

async function stopEffect(interaction, invokerId) {
    const previous = stop();

    await interaction.update(mainView(invokerId));

    // The button is disabled when nothing is running, but a panel left open
    // from an earlier effect can still send this.
    if (previous.target) {
        await announceEnded(previous, `<@${invokerId}> stopped it`);
    }
}

function showCustomDurationModal(interaction, invokerId) {
    const modal = new ModalBuilder()
        .setCustomId(customId('profile', 'customDuration', invokerId))
        .setTitle('Custom duration')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('duration')
                    .setLabel('How long should it run?')
                    .setPlaceholder('90m, 2h30m, 3d — or "forever"')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(32)
                    .setRequired(true),
            ),
        );

    return interaction.showModal(modal);
}

async function handleMain(interaction, action, invokerId) {
    if (action === 'profile') return interaction.update(profileView(invokerId));
    if (action === 'stop') return stopEffect(interaction, invokerId);
    if (action === 'refresh') return interaction.update(mainView(invokerId));
}

async function handleProfile(interaction, action, invokerId) {
    if (action === 'target') {
        getDraft(invokerId).targetId = interaction.values[0];
        return interaction.update(profileView(invokerId));
    }

    if (action === 'duration') {
        const value = interaction.values[0];
        if (value === 'custom') return showCustomDurationModal(interaction, invokerId);

        const choice = DURATION_CHOICES.find((option) => option.value === value);
        if (!choice) return interaction.update(profileView(invokerId));

        getDraft(invokerId).duration = {value: choice.value, ms: choice.ms};
        return interaction.update(profileView(invokerId));
    }

    if (action === 'customDuration') {
        const parsed = parseDuration(interaction.fields.getTextInputValue('duration'));
        if (!parsed.ok) {
            return interaction.reply({
                content: '❌ I could not read that as a duration. Try `90m`, `2h30m`, `3d`, or `forever`.',
                ephemeral: true,
            });
        }

        getDraft(invokerId).duration = {value: 'custom', ms: parsed.ms};

        // A modal opened from a component can edit the message it came from;
        // one opened any other way has nothing to edit.
        return interaction.isFromMessage()
            ? interaction.update(profileView(invokerId))
            : interaction.reply({...profileView(invokerId), ephemeral: true});
    }

    // Read back off the stored state rather than off the button that was
    // clicked: a panel left open shows whatever was true when it was drawn, and
    // clicking a stale one should not flip the switch to what it already is.
    if (action === 'toggleMinecraft' || action === 'toggleDiscord') {
        const key = action === 'toggleMinecraft' ? 'disguiseToMinecraft' : 'disguiseToDiscord';
        setDirection(key, !getState()[key]);
        return interaction.update(profileView(invokerId));
    }

    if (action === 'startTest') return startEffect(interaction, 'test', invokerId);
    if (action === 'startLive') return startEffect(interaction, 'live', invokerId);
    if (action === 'scope') return interaction.update(scopeView(invokerId));
    if (action === 'back') return interaction.update(mainView(invokerId));
}

async function handleScope(interaction, action, invokerId) {
    // The select menus hand back the whole selection, so each one is written
    // through wholesale rather than diffed.
    if (action === 'testers') setTesters(interaction.values);
    else if (action === 'testChannels') setTestChannels(interaction.values);
    else if (action === 'excludedChannels') setExcludedChannels(interaction.values);
    else if (action === 'back') return interaction.update(profileView(invokerId));
    else return;

    return interaction.update(scopeView(invokerId));
}

module.exports = async (client, interaction) => {
    if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) {
        return;
    }

    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;

    // Same guard handleCommands.js applies: commands are registered globally,
    // and the panel reaches the bot's admin state.
    if (!isAllowedGuild(interaction)) {
        return interaction.reply({
            content: '❌ This bot only serves its configured guild.',
            ephemeral: true,
        });
    }

    // Re-checked on every click, not just when the panel was opened — an admin
    // role can be taken away while the panel sits there.
    if (!isAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ You do not have permission to use the admin panel.',
            ephemeral: true,
        });
    }

    if (interaction.user.id !== parsed.invokerId) {
        return interaction.reply({
            content: '❌ Only the admin who opened this panel can use it.',
            ephemeral: true,
        });
    }

    try {
        if (parsed.view === 'main') return await handleMain(interaction, parsed.action, parsed.invokerId);
        if (parsed.view === 'profile') return await handleProfile(interaction, parsed.action, parsed.invokerId);
        if (parsed.view === 'scope') return await handleScope(interaction, parsed.action, parsed.invokerId);
    } catch (error) {
        console.error('Admin panel interaction failed:', error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Something went wrong handling that. Check the console.',
                ephemeral: true,
            }).catch(() => {});
        }
    }
};
