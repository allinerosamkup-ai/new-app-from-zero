import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  PRIVACY_EXPORT_ALLOWLIST,
  PRIVACY_EXPORT_EXCLUDED_MODELS,
} from '../services/privacy-redaction.allowlist';

/**
 * Reads packages/database/prisma/schema.prisma and asserts that every model
 * is either:
 *   - present in PRIVACY_EXPORT_ALLOWLIST with every field classified, OR
 *   - explicitly listed in PRIVACY_EXPORT_EXCLUDED_MODELS.
 *
 * Purpose: when a new column is added to a PII model in schema.prisma, this
 * test fails until the developer makes an explicit decision about whether
 * the new field is exportable, redacted, or model-excluded. Prevents silent
 * PII leakage in /api/privacy/export.
 */

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const schemaPath = path.join(repoRoot, 'packages', 'database', 'prisma', 'schema.prisma');

type SchemaModel = {
  name: string;
  fields: string[];
};

const PRISMA_SCALAR_TYPES = new Set([
  'String',
  'Int',
  'BigInt',
  'Boolean',
  'Float',
  'Decimal',
  'DateTime',
  'Json',
  'Bytes',
]);

function parseSchemaModels(source: string): SchemaModel[] {
  const models: SchemaModel[] = [];
  const modelBlock = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

  for (const match of source.matchAll(modelBlock)) {
    const [, name, body] = match;
    const fields: string[] = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('//')) continue;
      if (line.startsWith('@@')) continue;
      const fieldMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (!fieldMatch) continue;
      const [, fieldName, fieldType] = fieldMatch;
      // Skip Prisma relation fields. Scalar fields use one of the known
      // primitive types; everything else is a relation to another model.
      if (!PRISMA_SCALAR_TYPES.has(fieldType)) continue;
      fields.push(fieldName);
    }
    models.push({ name, fields });
  }

  return models;
}

function run() {
  const schemaSource = readFileSync(schemaPath, 'utf8');
  const models = parseSchemaModels(schemaSource);
  assert.ok(models.length > 0, 'schema.prisma must define at least one model');

  const failures: string[] = [];

  for (const model of models) {
    const isExcluded = PRIVACY_EXPORT_EXCLUDED_MODELS.has(model.name);
    const allowlistEntry = PRIVACY_EXPORT_ALLOWLIST[model.name];

    if (!isExcluded && !allowlistEntry) {
      failures.push(
        `Model "${model.name}" is in schema.prisma but neither allowlisted in PRIVACY_EXPORT_ALLOWLIST nor in PRIVACY_EXPORT_EXCLUDED_MODELS. Decide: include in export or exclude explicitly.`,
      );
      continue;
    }

    if (isExcluded && allowlistEntry) {
      failures.push(
        `Model "${model.name}" is both excluded and allowlisted. Pick one.`,
      );
      continue;
    }

    if (!allowlistEntry) continue;

    const classified = new Set([...allowlistEntry.include, ...allowlistEntry.redact]);

    for (const field of model.fields) {
      if (!classified.has(field)) {
        failures.push(
          `Model "${model.name}" has field "${field}" not classified in PRIVACY_EXPORT_ALLOWLIST. Add it to include[] or redact[].`,
        );
      }
    }
  }

  assert.deepEqual(
    failures,
    [],
    `Privacy allowlist drift detected:\n  - ${failures.join('\n  - ')}`,
  );

  console.log('privacy-allowlist tests passed');
}

run();
