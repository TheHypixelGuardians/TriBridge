const {getState, isActive, armExpiry} = require('../../../utils/globalProfile');
const {announceEnded} = require('../../../utils/disguise');
const {formatDuration} = require('../../../utils/duration');

module.exports = async () => {
    const stored = getState();
    const wasRunning = stored.mode !== 'off' && Boolean(stored.target);

    if (!wasRunning) return;

    // isActive() clears a lapsed effect on read, so this is also how an effect
    // that ran out while the bot was down gets noticed and reported.
    if (!isActive()) {
        console.log('Global profile change had expired while the bot was offline; cleared.');
        await announceEnded(stored, 'it ran out while the bot was offline');
        return;
    }

    // The state survived the restart, so the timer that announces its end has
    // to be re-armed — nothing else does it.
    armExpiry((previous) => announceEnded(previous, 'the time ran out'));

    const remaining = stored.expiresAt === null
        ? 'indefinite'
        : formatDuration(stored.expiresAt - Date.now());

    console.log(
        `Global profile change is still running (${stored.mode} mode, ${remaining} left).`,
    );
};
