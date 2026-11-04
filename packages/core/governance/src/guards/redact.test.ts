import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('redacts an email address (blocked case)', () => {
    const result = redactSecrets('contact me at jane.doe@example.com for details');
    expect(result.redacted).not.toContain('jane.doe@example.com');
    expect(result.found).toContain('email');
  });

  it('redacts an AWS access key (blocked case)', () => {
    const result = redactSecrets('key: AKIAIOSFODNN7EXAMPLE');
    expect(result.redacted).toContain('[REDACTED:aws_key]');
    expect(result.found).toContain('aws_key');
  });

  it('redacts a generic long API-key-shaped token (blocked case)', () => {
    const result = redactSecrets('token=ag_cda46a6a3e97e1807ab940deee304393');
    expect(result.found).toContain('api_key');
  });

  it('leaves ordinary short text untouched (benign case)', () => {
    const text = 'Azure Functions triggers and bindings overview';
    const result = redactSecrets(text);
    expect(result.redacted).toBe(text);
    expect(result.found).toEqual([]);
  });
});
