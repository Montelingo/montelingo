import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const openApiPath = path.join(root, 'packages', 'api-client', 'openapi.json');
const generatedDir = path.join(root, 'packages', 'api-client', 'src', 'generated');

const schema = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
fs.mkdirSync(generatedDir, { recursive: true });

const types = [];
for (const [name, definition] of Object.entries(schema.components?.schemas ?? {})) {
  if (!definition || typeof definition !== 'object') continue;
  if (definition.type === 'object') {
    const props = definition.properties ?? {};
    const entries = Object.entries(props).map(([key, value]) => {
      const type = mapSchemaToTs(value, key);
      return `  ${key}${value.required ? '' : '?'}: ${type};`;
    });
    types.push(`export type ${pascalCase(name)} = {\n${entries.join('\n')}\n};`);
  }
}

const index = [
  'export type ErrorCode = "validation_error" | "authentication_error" | "authorization_error" | "not_found" | "conflict" | "rate_limited" | "internal_server_error" | "bad_request";',
  '',
  'export type ErrorDetail = {',
  '  field?: string | null;',
  '  code: string;',
  '  message: string;',
  '};',
  '',
  'export type ErrorEnvelope = {',
  '  error: {',
  '    code: ErrorCode;',
  '    message: string;',
  '    request_id: string;',
  '    details?: ErrorDetail[] | null;',
  '  };',
  '};',
  '',
  ...types,
].join('\n');

fs.writeFileSync(path.join(generatedDir, 'index.ts'), index + '\n');
fs.writeFileSync(path.join(generatedDir, 'client.ts'), 'export * from "./index";\n');

console.log('Generated TypeScript client types');

function pascalCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function mapSchemaToTs(value, key) {
  if (!value || typeof value !== 'object') return 'unknown';
  if (value.$ref) return 'unknown';
  if (value.type === 'string') return value.format === 'uuid' ? 'string' : 'string';
  if (value.type === 'integer' || value.type === 'number') return 'number';
  if (value.type === 'boolean') return 'boolean';
  if (value.type === 'array') return `${mapSchemaToTs(value.items)}[]`;
  if (value.type === 'object' || value.properties) {
    return 'Record<string, unknown>';
  }
  if (value.oneOf) {
    return value.oneOf.map((item) => mapSchemaToTs(item)).join(' | ');
  }
  return 'unknown';
}
