import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const openApiPath = path.join(root, 'packages', 'api-client', 'openapi.json');
const generatedDir = path.join(root, 'packages', 'api-client', 'src', 'generated');

const schema = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
fs.mkdirSync(generatedDir, { recursive: true });

const definitions = schema.components?.schemas ?? {};
const types = Object.entries(definitions)
  .filter(([, definition]) => definition && typeof definition === 'object')
  .map(([name, definition]) => {
    if (definition.type === 'object' || definition.properties || definition.anyOf || definition.oneOf || definition.allOf) {
      const typeName = sanitizeTypeName(name);
      const typeBody = mapSchemaToTs(definition, new Set(definition.required ?? []), `#/components/schemas/${name}`);
      return `export type ${typeName} = ${typeBody};`;
    }
    return null;
  })
  .filter(Boolean);

fs.writeFileSync(path.join(generatedDir, 'index.ts'), `${types.join('\n\n')}\n`);
fs.writeFileSync(path.join(generatedDir, 'client.ts'), 'export * from "./index";\n');

console.log('Generated TypeScript client types');

function sanitizeTypeName(value) {
  return value
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^[^A-Za-z_$]+/, '_')
    .replace(/_+/g, '_');
}

function resolveRef(ref) {
  if (!ref.startsWith('#/components/schemas/')) {
    return 'unknown';
  }
  const typeName = ref.split('/').at(-1) ?? 'Unknown';
  return sanitizeTypeName(typeName);
}

function mapSchemaToTs(schema, required = new Set(), refPath = 'inline') {
  if (!schema || typeof schema !== 'object') {
    return 'unknown';
  }

  if (schema.$ref) {
    return resolveRef(schema.$ref);
  }

  if (schema.type === 'null') {
    return 'null';
  }

  if (schema.anyOf) {
    const members = schema.anyOf.map((item) => mapSchemaToTs(item, required, refPath));
    const nullable = members.includes('null');
    const uniqueMembers = [...new Set(members.filter((item) => item !== 'null'))];
    const type = uniqueMembers.length === 0 ? 'null' : uniqueMembers.length === 1 ? uniqueMembers[0] : uniqueMembers.join(' | ');
    return nullable ? `${type} | null` : type;
  }

  if (schema.oneOf) {
    const members = schema.oneOf.map((item) => mapSchemaToTs(item, required, refPath));
    const nullable = members.includes('null');
    const uniqueMembers = [...new Set(members.filter((item) => item !== 'null'))];
    const type = uniqueMembers.length === 0 ? 'null' : uniqueMembers.length === 1 ? uniqueMembers[0] : uniqueMembers.join(' | ');
    return nullable ? `${type} | null` : type;
  }

  if (schema.allOf) {
    return schema.allOf.map((item) => mapSchemaToTs(item, required, refPath)).join(' & ');
  }

  if (schema.type === 'string') {
    if (schema.enum) {
      return schema.enum.map((item) => JSON.stringify(item)).join(' | ');
    }
    return 'string';
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return 'number';
  }

  if (schema.type === 'boolean') {
    return 'boolean';
  }

  if (schema.type === 'array') {
    return `${mapSchemaToTs(schema.items, required, refPath)}[]`;
  }

  if (schema.type === 'object' || schema.properties) {
    const properties = schema.properties ?? {};
    const objectRequired = new Set(schema.required ?? []);
    const entries = Object.entries(properties).map(([key, value]) => {
      const propertyName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      const suffix = objectRequired.has(key) ? '' : '?';
      return `  ${propertyName}${suffix}: ${mapSchemaToTs(value, objectRequired, refPath)};`;
    });

    if (entries.length === 0) {
      return 'Record<string, unknown>';
    }

    return `{
${entries.join('\n')}
}`;
  }

  return 'unknown';
}
