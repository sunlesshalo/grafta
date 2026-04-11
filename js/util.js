// ── util.js — shared helpers ──

/**
 * Escape a string for safe inclusion in an HTML template context.
 * Accepts any value; null/undefined/numbers/other non-strings are coerced to
 * their string form (or empty string for null/undefined).
 *
 * Must be applied to ALL user-controlled values before interpolating into
 * template strings that are assigned to `.innerHTML`. See AUDIT.md
 * Review — 2026-04-10 for the threat model.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
