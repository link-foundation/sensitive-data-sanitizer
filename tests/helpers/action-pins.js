// Tag-pinned workflow actions use a full semver tag (vMAJOR.MINOR.PATCH).
// Dependabot moves the numbers, so tests assert the action and the pin
// shape; the workflow stays the single place that names the release.

const PINNED_TAG = String.raw`v\d+\.\d+\.\d+`;

/**
 * Matches a `uses:` line calling `action` at a full semver tag.
 *
 * @param {string} action Action path, e.g. `actions/checkout`.
 * @returns {RegExp}
 */
export function pinnedUses(action) {
  return new RegExp(`uses: ${RegExp.escape(action)}@${PINNED_TAG}(?=\\s|$)`);
}

/**
 * Matches a bare `uses` value (as parsed from YAML) of `action` at a full
 * semver tag.
 *
 * @param {string} action Action path, e.g. `docker/setup-buildx-action`.
 * @returns {RegExp}
 */
export function pinnedRef(action) {
  return new RegExp(`^${RegExp.escape(action)}@${PINNED_TAG}$`);
}
