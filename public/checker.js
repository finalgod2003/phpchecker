/*
 * Adapted from openai/php2shell-checker (Apache-2.0).
 * Upstream ffcd3fc82e5b404f2a04a95b2805ca7639d530fa; see NOTICE.
 * Changes: ES module exports and structured reports for a web interface.
 */
export const RULE_DATE = '2026-10-21';
export const FIXED_IN = Object.freeze({ '8.2': 35, '8.3': 36, '8.4': 27, '8.5': 12 });
const OLDER_BRANCHES = new Set(['5.4', '5.5', '5.6', '7.0', '7.1', '7.2', '7.3', '7.4', '8.0', '8.1']);

export function versionStatus(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)([-+~].*)?$/.exec(version || '');
  if (!match) return 'unknown';
  if (/(?:^|[-+~.])(?:dev|alpha|beta|rc)/i.test(match[4] || '')) return 'unknown';
  const branch = `${Number(match[1])}.${Number(match[2])}`;
  if (OLDER_BRANCHES.has(branch)) return 'potentially_vulnerable';
  const fixed = FIXED_IN[branch];
  if (fixed === undefined) return 'unknown';
  if (Number(match[3]) < fixed) return 'potentially_vulnerable';
  return 'ok';
}

export function normalizeVersion(value) {
  return String(value || '').trim().replace(/^PHP[ /]+/i, '');
}

export function makeReport(version, extra = {}) {
  const status = versionStatus(version);
  const branch = version?.match(/^(\d+)\.(\d+)/)?.slice(1).map(Number).join('.');
  return {
    php_version: version || null,
    patch_status: status,
    fixed_in: FIXED_IN[branch] === undefined ? null : `${branch}.${FIXED_IN[branch]}`,
    rule_date: RULE_DATE,
    checked_at: new Date().toISOString(),
    ...extra,
  };
}

export function reportFromHeaders(headerText, extra = {}) {
  let version = null, status = 'unknown';
  for (const match of headerText.matchAll(/\bPHP[ /]([^\s,;)]+)/gi)) {
    const candidateStatus = versionStatus(match[1]);
    // Upstream rule: warnings and unrecognized versions take precedence.
    if (version === null || candidateStatus === 'potentially_vulnerable' || status === 'ok') {
      version = match[1];
      status = candidateStatus;
    }
    if (status === 'potentially_vulnerable') break;
  }
  return makeReport(version, extra);
}
