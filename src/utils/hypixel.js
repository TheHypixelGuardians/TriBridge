const BASE_URL = "https://api.hypixel.net/v2";
const TIMEOUT_MS = 8_000;
const USER_AGENT = "TriBridge (+https://github.com/Trilleo/THGBridge)";

/**
 * @returns {string|null}
 */
function getApiKey() {
  const key = process.env.HYPIXEL_API_KEY;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed || null;
}

/**
 * @param {string} path Path under /v2, e.g. "/guild".
 * @param {Record<string, string>} params Query params (key is added automatically).
 * @returns {Promise<
 *   | {ok: true, data: object}
 *   | {ok: false, code: 'no-key'|'http'|'rate-limit'|'invalid-key'|'upstream'}
 * >}
 */
async function hypixelGet(path, params = {}) {
  const key = getApiKey();
  if (!key) return { ok: false, code: "no-key" };

  const url = new URL(BASE_URL + path);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(name, value);
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, code: "http" };
  }

  if (response.status === 429) return { ok: false, code: "rate-limit" };
  if (response.status === 403) return { ok: false, code: "invalid-key" };
  if (!response.ok) return { ok: false, code: "http" };

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, code: "upstream" };
  }

  if (!data || data.success !== true) {
    const cause = String(data?.cause ?? "").toLowerCase();
    if (cause.includes("invalid") && cause.includes("key")) {
      return { ok: false, code: "invalid-key" };
    }
    if (cause.includes("rate")) return { ok: false, code: "rate-limit" };
    return { ok: false, code: "upstream" };
  }

  return { ok: true, data };
}

/**
 * Looks up the Hypixel guild a player belongs to.
 *
 * @param {string} uuid Mojang UUID (dashed or undashed).
 * @returns {Promise<
 *   | {ok: true, guild: object|null}
 *   | {ok: false, code: string}
 * >}
 */
async function getGuildByPlayer(uuid) {
  const cleaned = String(uuid ?? "")
    .replace(/-/g, "")
    .trim();
  if (!cleaned) return { ok: false, code: "http" };

  const result = await hypixelGet("/guild", { player: cleaned });
  if (!result.ok) return result;

  return { ok: true, guild: result.data.guild ?? null };
}

module.exports = {
  getApiKey,
  getGuildByPlayer,
};
