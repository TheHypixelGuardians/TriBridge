const {getAllLinks} = require('./linkedAccounts');
const {getLinkRoleId, applyLinkRoleById, describeFailure} = require('./linkRole');

/**
 * Grants the configured link role to everybody who already has a link.
 *
 * Exists because linking predates the role, so the stored links are the source
 * of truth and the roles have to be brought up to date from them — at startup,
 * and again whenever an admin points `/linkrole` at a different role. It only
 * ever adds: members who hold the role without a link are left alone, since the
 * role may well be handed out for other reasons too.
 *
 * Members are fetched one at a time on purpose — see resolveMember in
 * linkRole.js for why the bulk roster fetch is unavailable here.
 *
 * @returns {Promise<{granted: number, alreadyHad: number, missing: number, failed: number, failure: string|null}>}
 *   `missing` counts linked users who are no longer in the guild. `failure` is
 *   a description of the first hard failure, for reporting to an admin.
 */
async function syncLinkRoles() {
    const summary = {granted: 0, alreadyHad: 0, missing: 0, failed: 0, failure: null};
    if (!getLinkRoleId()) return summary;

    for (const link of getAllLinks()) {
        const result = await applyLinkRoleById(link.discordId, 'add');

        if (result.ok) {
            if (result.changed) summary.granted++;
            else summary.alreadyHad++;
            continue;
        }

        if (result.reason === 'no-member') {
            summary.missing++;
            continue;
        }

        summary.failed++;
        summary.failure ??= describeFailure(result);

        // A missing role or a permission problem applies to every remaining
        // member as well; retrying it once per link just burns rate limit.
        if (result.reason === 'missing-role' || result.reason === 'forbidden') {
            summary.failed += getAllLinks().length - summary.granted - summary.alreadyHad
                - summary.missing - summary.failed;
            break;
        }
    }

    return summary;
}

module.exports = syncLinkRoles;
