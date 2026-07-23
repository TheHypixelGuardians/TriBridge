const UNITS = {s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000};

const UNIT_ORDER = [
    ['d', UNITS.d],
    ['h', UNITS.h],
    ['m', UNITS.m],
    ['s', UNITS.s],
];

// Ways of asking for "no expiry at all". Kept separate from a parse failure so
// the caller can tell "run until I stop it" from "I typoed the duration".
const INDEFINITE_WORDS = new Set([
    '0',
    'none',
    'never',
    'forever',
    'permanent',
    'indefinite',
    'indefinitely',
]);

/**
 * Parses a human duration such as `90m`, `2h30m`, `1d12h` or a bare `45`
 * (read as minutes).
 *
 * @param {string} text
 * @returns {{ok: true, ms: number|null}|{ok: false}} `ms: null` means the effect
 *   should never expire on its own; `ok: false` means the text was not a
 *   duration at all.
 */
function parseDuration(text) {
    const raw = String(text ?? '').trim().toLowerCase();
    if (!raw) return {ok: false};
    if (INDEFINITE_WORDS.has(raw)) return {ok: true, ms: null};

    if (/^\d+$/.test(raw)) {
        const minutes = Number(raw);
        return {ok: true, ms: minutes > 0 ? minutes * UNITS.m : null};
    }

    // Anchored so trailing junk is rejected outright rather than quietly
    // ignored — "2h then stop" must not be read as two hours.
    if (!/^(\d+\s*[smhd]\s*)+$/.test(raw)) return {ok: false};

    let ms = 0;
    for (const [, amount, unit] of raw.matchAll(/(\d+)\s*([smhd])/g)) {
        ms += Number(amount) * UNITS[unit];
    }

    return {ok: true, ms: ms > 0 ? ms : null};
}

/**
 * Renders a duration for display, coarsest two units only — `1d 4h`, not
 * `1d 4h 3m 12s`.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 */
function formatDuration(ms) {
    if (ms === null || ms === undefined) return 'indefinite';
    if (ms <= 0) return '0s';

    const parts = [];
    let left = ms;

    for (const [unit, size] of UNIT_ORDER) {
        const amount = Math.floor(left / size);
        if (amount > 0) {
            parts.push(`${amount}${unit}`);
            left -= amount * size;
        }
    }

    return parts.length > 0 ? parts.slice(0, 2).join(' ') : '<1s';
}

module.exports = {parseDuration, formatDuration, UNITS};
