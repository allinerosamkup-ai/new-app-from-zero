import { z } from 'zod';

const MAX_EVENT_NAME_LENGTH = 80;
const MAX_PATH_LENGTH = 256;
const MAX_PROPERTY_STRING_LENGTH = 256;
const MAX_PROPERTY_DEPTH = 6;

const FORBIDDEN_PII_KEYS = new Set([
  'name',
  'fullname',
  'firstname',
  'lastname',
  'displayname',
  'profilename',
  'email',
  'useremail',
  'phone',
  'userphone',
  'phonenumber',
  'telefone',
  'celular',
  'cpf',
  'cnpj',
  'ssn',
  'document',
  'documentnumber',
  'address',
  'street',
  'zipcode',
  'postalcode',
  'birthdate',
  'birthday',
  'dob',
]);

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PhonePattern = /^\+?[0-9()\-\s]{7,20}$/;
const CpfPattern = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

type PropertyIssue = {
  path: (string | number)[];
  message: string;
};

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function validateEventLogValue(value: unknown, path: (string | number)[] = [], depth = 0): PropertyIssue[] {
  const issues: PropertyIssue[] = [];

  if (depth > MAX_PROPERTY_DEPTH) {
    issues.push({ path, message: 'properties depth is too deep' });
    return issues;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return issues;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_PROPERTY_STRING_LENGTH) {
      issues.push({ path, message: 'properties strings must stay short' });
    }

    if (EmailPattern.test(value) || PhonePattern.test(value) || CpfPattern.test(value)) {
      issues.push({ path, message: 'properties cannot contain direct PII values' });
    }

    return issues;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      issues.push(...validateEventLogValue(value[index], [...path, index], depth + 1));
    }
    return issues;
  }

  if (isPlainObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = normalizeKey(key);
      if (FORBIDDEN_PII_KEYS.has(normalizedKey)) {
        issues.push({ path: [...path, key], message: 'properties cannot contain PII fields' });
        continue;
      }

      issues.push(...validateEventLogValue(nestedValue, [...path, key], depth + 1));
    }
    return issues;
  }

  issues.push({ path, message: 'properties must be valid JSON' });
  return issues;
}

const EventLogPropertiesSchema = z.unknown().superRefine((value, ctx) => {
  for (const issue of validateEventLogValue(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path,
    });
  }
});

export function validateEventLogProperties(value: unknown) {
  return EventLogPropertiesSchema.safeParse(value);
}

export const EventLogCreateSchema = z.object({
  eventName: z.string().trim().min(1).max(MAX_EVENT_NAME_LENGTH).regex(/^[A-Za-z][A-Za-z0-9._:-]*$/),
  properties: z.unknown().optional(),
  path: z.string().trim().min(1).max(MAX_PATH_LENGTH).regex(/^\/[^\s]*$/).optional(),
}).superRefine((value, ctx) => {
  if (value.properties === undefined) {
    return;
  }

  const result = validateEventLogProperties(value.properties);
  if (result.success) {
    return;
  }

  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: ['properties', ...issue.path],
    });
  }
});

export type EventLogCreateInput = z.infer<typeof EventLogCreateSchema>;
