import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../js/util.js';

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml('&<>"\''))
      .toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('returns empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces numbers to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes a realistic XSS payload', () => {
    const payload = '<img src=x onerror=alert(1)>';
    expect(escapeHtml(payload)).not.toContain('<');
    expect(escapeHtml(payload)).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes attribute injection payload', () => {
    const payload = '"><script>alert(1)</script>';
    expect(escapeHtml(payload)).toBe('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
