import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const openApiPath = path.join(root, 'packages', 'api-client', 'openapi.json');
const generatedDir = path.join(root, 'packages', 'api-client', 'src', 'generated');
const indexPath = path.join(generatedDir, 'index.ts');
const clientPath = path.join(generatedDir, 'client.ts');

const schema = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
fs.mkdirSync(generatedDir, { recursive: true });

const definitions = schema.components?.schemas ?? {};
const exportedSchemaEntries = Object.entries(definitions).filter(([, definition]) => {
  return definition && typeof definition === 'object' && (definition.type === 'object' || definition.properties || definition.anyOf || definition.oneOf || definition.allOf);
});
const exportedTypeNames = exportedSchemaEntries.map(([name]) => sanitizeTypeName(name));
const types = exportedSchemaEntries.map(([name, definition]) => {
  const typeName = sanitizeTypeName(name);
  const typeBody = mapSchemaToTs(definition, new Set(definition.required ?? []), `#/components/schemas/${name}`);
  return `export type ${typeName} = ${typeBody};`;
});

const operations = collectOperations(schema.paths ?? {});
const generatedClient = [
  `import type { ${exportedTypeNames.join(', ')} } from "./index";`,
  '',
  'export * from "./index";',
  '',
  'export type ClientRequestOptions = {',
  '  baseUrl?: string;',
  '  headers?: Record<string, string>;',
  '  signal?: AbortSignal;',
  '};',
  '',
  'export const DEFAULT_API_BASE_URL =',
  '  typeof window !== "undefined" && typeof window.location !== "undefined"',
  '    ? window.location.origin',
  '    : "http://localhost:8000";',
  '',
  'export class ApiClientError extends Error {',
  '  readonly status: number;',
  '  readonly error: ErrorEnvelope;',
  '',
  '  constructor(status: number, error: ErrorEnvelope) {',
  '    super(error.error.message || "Request failed with status " + status);',
  '    this.name = "ApiClientError";',
  '    this.status = status;',
  '    this.error = error;',
  '  }',
  '}',
  '',
  'function buildUrl(',
  '  pathTemplate: string,',
  '  pathParams: Record<string, string | number | boolean | null | undefined> = {},',
  '  queryParams: Record<string, unknown> = {},',
  '): string {',
  '  let url = pathTemplate;',
  '',
  '  for (const [key, value] of Object.entries(pathParams)) {',
  '    if (value === undefined || value === null) {',
  '      continue;',
  '    }',
  '',
  '    url = url.split("{" + key + "}").join(encodeURIComponent(String(value)));',
  '  }',
  '',
  '  const search = new URLSearchParams();',
  '',
  '  for (const [key, value] of Object.entries(queryParams)) {',
  '    if (value === undefined || value === null) {',
  '      continue;',
  '    }',
  '',
  '    if (Array.isArray(value)) {',
  '      for (const item of value) {',
  '        if (item !== undefined && item !== null) {',
  '          search.append(key, String(item));',
  '        }',
  '      }',
  '      continue;',
  '    }',
  '',
  '    search.append(key, String(value));',
  '  }',
  '',
  '  const queryString = search.toString();',
  '  return queryString ? url + "?" + queryString : url;',
  '}',
  '',
  'async function requestJson<T>(url: string, init: RequestInit, baseUrl?: string): Promise<T> {',
  '  const resolvedUrl = new URL(url, baseUrl ?? DEFAULT_API_BASE_URL).toString();',
  '  const response = await fetch(resolvedUrl, init);',
  '  const contentType = response.headers.get("content-type") ?? "";',
  '  const text = await response.text();',
  '  const payload = text && contentType.includes("application/json") ? JSON.parse(text) : text ? text : undefined;',
  '',
  '  if (!response.ok) {',
  '    const errorEnvelope = (payload && typeof payload === "object" && "error" in payload ? payload : {',
  '      error: {',
  '        code: "request_failed",',
  '        message: typeof payload === "string" ? payload : "Request failed with status " + response.status,',
  '        request_id: "",',
  '      },',
  '    }) as ErrorEnvelope;',
  '',
  '    throw new ApiClientError(response.status, errorEnvelope);',
  '  }',
  '',
  '  return payload as T;',
  '}',
  '',
  ...operations.map((operation) => generateOperationFunction(operation)),
  '',
].join('\n');

fs.writeFileSync(indexPath, `${types.join('\n\n')}\n`);
fs.writeFileSync(clientPath, `${generatedClient}\n`);

console.log('Generated TypeScript client types and request functions');

function sanitizeTypeName(value) {
  return value
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^[^A-Za-z_$]+/, '_')
    .replace(/_+/g, '_');
}

function sanitizeFunctionName(value) {
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

function isEmptySchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return true;
  }

  if (schema.$ref || schema.type || schema.properties || schema.items || schema.enum || schema.anyOf || schema.oneOf || schema.allOf) {
    return false;
  }

  return Object.keys(schema).length === 0;
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

  if (isEmptySchema(schema)) {
    return 'void';
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

function collectOperations(paths) {
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  const operations = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      operations.push({
        method,
        path: pathKey,
        operation,
      });
    }
  }

  return operations;
}

function getRequestBodySchema(operation) {
  const requestBody = operation.requestBody;
  if (!requestBody || !requestBody.content) {
    return null;
  }

  const jsonContent = requestBody.content['application/json'] ?? requestBody.content['application/*+json'];
  const contentSchema = jsonContent?.schema ?? null;
  return contentSchema;
}

function getQueryParameterType(operation) {
  const parameters = operation.parameters ?? [];
  const queryParameters = parameters.filter((parameter) => parameter.in === 'query');

  if (queryParameters.length === 0) {
    return null;
  }

  const required = new Set(queryParameters.filter((param) => param.required).map((param) => param.name));
  const entries = queryParameters.map((parameter) => {
    const schema = parameter.schema ?? {};
    const type = mapSchemaToTs(schema, required, 'inline');
    const suffix = required.has(parameter.name) ? '' : '?';
    return `  ${parameter.name}${suffix}: ${type};`;
  });

  return `{
${entries.join('\n')}
}`;
}

function getPathParameterType(pathTemplate) {
  const matches = [...pathTemplate.matchAll(/\{([^}]+)\}/g)];
  if (matches.length === 0) {
    return null;
  }

  const entries = matches.map((match) => `  ${match[1]}: string;`);
  return `{
${entries.join('\n')}
}`;
}

function getSuccessResponseSchema(operation) {
  const responses = operation.responses ?? {};
  const statusCodes = ['200', '201', '202', '204', 'default'];

  for (const statusCode of statusCodes) {
    const response = responses[statusCode];
    if (!response || !response.content) {
      continue;
    }

    const content = response.content['application/json'] ?? response.content['application/*+json'] ?? Object.values(response.content)[0];
    if (!content || !content.schema) {
      continue;
    }

    if (isEmptySchema(content.schema)) {
      return 'void';
    }

    return mapSchemaToTs(content.schema, new Set(), `#/paths/${operation.operationId ?? 'operation'}/responses/${statusCode}`);
  }

  return 'void';
}

function generateOperationFunction(operationData) {
  const { method, path, operation } = operationData;
  const operationId = sanitizeFunctionName(operation.operationId ?? `${method}_${path}`);
  const pathParamType = getPathParameterType(path);
  const queryParamType = getQueryParameterType(operation);
  const requestBodySchema = getRequestBodySchema(operation);
  const successType = getSuccessResponseSchema(operation);

  const params = [];
  const urlArgs = [];

  if (pathParamType) {
    params.push(`pathParams: ${pathParamType} = {}`);
    urlArgs.push('pathParams ?? {}');
  } else {
    urlArgs.push('{}');
  }

  if (queryParamType) {
    params.push(`query: ${queryParamType} = {}`);
    urlArgs.push('query ?? {}');
  } else {
    urlArgs.push('{}');
  }

  if (requestBodySchema) {
    params.push(`body: ${mapSchemaToTs(requestBodySchema, new Set(), 'inline')}`);
  }

  params.push('options: ClientRequestOptions = {}');

  const bodyAssignment = requestBodySchema ? [
    '  if (body !== undefined) {',
    '    init.headers = {',
    '      ...(init.headers ?? {}),',
    '      "Content-Type": "application/json",',
    '    };',
    '    init.body = JSON.stringify(body);',
    '  }',
  ].join('\n') : '';

  const requestCall = [
    '  const init: RequestInit = {',
    '    method: ' + JSON.stringify(method.toUpperCase()) + ',',
    '    headers: { ...(options.headers ?? {}) },',
    '    signal: options.signal,',
    '  };',
    bodyAssignment ? '\n' + bodyAssignment : '',
    '  return requestJson<' + successType + '>(buildUrl(' + JSON.stringify(path) + ', ' + urlArgs.join(', ') + '), init, options.baseUrl ?? DEFAULT_API_BASE_URL);',
  ].join('\n');

  return [
    'export async function ' + operationId + '(' + params.join(', ') + '): Promise<' + successType + '> {',
    '  const url = buildUrl(' + JSON.stringify(path) + ', ' + urlArgs.join(', ') + ');',
    requestCall,
    '}',
  ].join('\n');
}
