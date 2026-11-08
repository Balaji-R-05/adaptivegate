import { afterEach, describe, expect, it } from 'vitest';
import { isEmailAllowed } from './allowlist';

describe('isEmailAllowed', () => {
  afterEach(() => {
    delete process.env.ALLOWED_EMAILS;
  });

  it('allows any email when ALLOWED_EMAILS is unset (self-hosted default)', () => {
    expect(isEmailAllowed('anyone@example.com')).toBe(true);
  });

  it('allows any email when ALLOWED_EMAILS is blank', () => {
    process.env.ALLOWED_EMAILS = '  ';
    expect(isEmailAllowed('anyone@example.com')).toBe(true);
  });

  it('allows an email in the list', () => {
    process.env.ALLOWED_EMAILS = 'a@example.com, b@example.com';
    expect(isEmailAllowed('b@example.com')).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    process.env.ALLOWED_EMAILS = ' A@Example.com ,b@example.com';
    expect(isEmailAllowed('a@example.com')).toBe(true);
  });

  it('rejects an email not in the list', () => {
    process.env.ALLOWED_EMAILS = 'a@example.com';
    expect(isEmailAllowed('stranger@example.com')).toBe(false);
  });
});
