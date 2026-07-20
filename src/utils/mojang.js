const PROFILE_URL = 'https://api.mojang.com/users/profiles/minecraft/';

/**
 * Looks up a Minecraft account by name.
 *
 * Distinguishes "no such player" (null) from "couldn't reach Mojang" (throws)
 * so callers can report the two cases differently.
 *
 * @param {string} name Username to look up (any casing).
 * @returns {Promise<{uuid: string, name: string}|null>} Profile with canonical
 *   casing, or null if no account has that name.
 * @throws {Error} If Mojang is unreachable or returns an unexpected status.
 */
async function lookupProfile(name) {
    const response = await fetch(PROFILE_URL + encodeURIComponent(name), {
        signal: AbortSignal.timeout(5000),
    });

    // Mojang answers an unknown name with 404, and historically with 204.
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) {
        throw new Error(`Mojang API returned ${response.status}`);
    }

    const data = await response.json();
    if (!data?.id || !data?.name) return null;

    return { uuid: data.id, name: data.name };
}

module.exports = { lookupProfile };
