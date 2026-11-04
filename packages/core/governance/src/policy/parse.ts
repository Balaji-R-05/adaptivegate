import { load } from 'js-yaml';
import { policyDocumentSchema, type PolicyDocument } from './schema';

export class PolicyParseError extends Error {}

export function parsePolicyDocument(yamlText: string): PolicyDocument {
  let raw: unknown;
  try {
    raw = load(yamlText);
  } catch (error) {
    throw new PolicyParseError(`invalid YAML: ${error instanceof Error ? error.message : error}`);
  }

  const result = policyDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new PolicyParseError(`invalid policy document: ${result.error.message}`);
  }
  return result.data;
}
