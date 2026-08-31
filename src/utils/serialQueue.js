/**
 * Serialises async work against a key, so tasks sharing one run in submission
 * order rather than concurrently.
 *
 * Used for Discord reposts (ordering) and Hypixel chat queries (Hypixel gives no
 * request/response correlation, so two concurrent collectors on one account each
 * eat half the other's output).
 */
class SerialQueue {
    constructor() {
        /** @type {Map<string, Promise>} */
        this.tails = new Map();
    }

    /**
     * @param {string} key
     * @param {() => Promise<T>} task
     * @returns {Promise<T>} Resolves or rejects with the task's own result.
     * @template T
     */
    run(key, task) {
        const previous = this.tails.get(key) ?? Promise.resolve();

        // `.then(task, task)` so one failed task does not stall the key forever.
        const result = previous.then(task, task);
        const settled = result.catch(() => {
        });

        this.tails.set(key, settled);
        settled.then(() => {
            // Drop the entry once nothing is queued behind us, so idle keys do
            // not accumulate settled promises forever.
            if (this.tails.get(key) === settled) this.tails.delete(key);
        });

        return result;
    }

    /**
     * @param {string} key
     * @returns {boolean} Whether anything is currently queued for this key.
     */
    isBusy(key) {
        return this.tails.has(key);
    }
}

/**
 * Chains a task onto a record's own queue field.
 *
 * The bot registry keeps its queue on the record rather than in a shared Map,
 * so a retired bot's queue goes away with it.
 *
 * @param {{queue: Promise}} holder An object with a `queue` promise field.
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 * @template T
 */
function chain(holder, task) {
    const result = holder.queue.then(task, task);
    holder.queue = result.catch(() => {
    });
    return result;
}

module.exports = {SerialQueue, chain};
