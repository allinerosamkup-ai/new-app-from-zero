import assert from 'node:assert/strict';

import { getSessionUserId } from './auth_session';

assert.equal(
  getSessionUserId({
    session: {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  }),
  '550e8400-e29b-41d4-a716-446655440000',
);

assert.equal(
  getSessionUserId({
    session: null,
  }),
  null,
);

console.log('auth_store tests passed');
