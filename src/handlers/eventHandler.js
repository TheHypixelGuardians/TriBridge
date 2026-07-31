const getAllFiles = require('../utils/getAllFiles');

/**
 * Binds every file under `<eventsPath>/<eventName>/` to `client.on(eventName)`.
 *
 * Files inside a folder run sequentially in sorted order — hence the numeric
 * prefixes where ordering matters. The first argument handlers receive is the
 * client the event came from, so under `events/minecraft/**` it is the
 * mineflayer bot, not the Discord client.
 *
 * @param {import('node:events').EventEmitter} client
 * @param {string} eventsPath
 * @returns {() => void} Removes every listener this call registered. Needed to
 *   retire one Minecraft bot without disturbing the others; the Discord call
 *   site simply ignores it.
 */
module.exports = (client, eventsPath) => {
    const eventFolders = getAllFiles(eventsPath, true);
    const registered = [];

    for (const eventFolder of eventFolders) {
        const eventFiles = getAllFiles(eventFolder);
        eventFiles.sort((a, b) => (a > b ? 1 : -1));

        const eventName = eventFolder.replace(/\\/g, '/').split('/').pop();

        const listener = async (...args) => {
            for (const eventFile of eventFiles) {
                const eventFunction = require(eventFile);
                await eventFunction(client, ...args);
            }
        };

        client.on(eventName, listener);
        registered.push({eventName, listener});
    }

    return () => {
        for (const {eventName, listener} of registered) {
            client.off(eventName, listener);
        }
        registered.length = 0;
    };
};
