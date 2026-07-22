import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverOrganizationDeletionSchema } from './organization-deletion';

test('deletion schema includes writable tenant and user reference tables only', () => {
  const schema = discoverOrganizationDeletionSchema({
    definitions: {
      clinics: { properties: { id: {}, owner_id: {} } },
      bookings: { properties: { id: {}, clinic_id: {} } },
      clinic_users: { properties: { id: {}, clinic_id: {}, user_id: {} } },
      readonly_view: { properties: { clinic_id: {} } },
      'unsafe-name': { properties: { clinic_id: {} } }
    },
    paths: {
      '/clinics': { get: {}, delete: {} },
      '/bookings': { get: {}, delete: {} },
      '/clinic_users': { get: {}, delete: {} },
      '/readonly_view': { get: {} },
      '/unsafe-name': { delete: {} }
    }
  });

  assert.deepEqual(schema.clinicScopedTables, ['bookings', 'clinic_users']);
  assert.deepEqual(schema.userReferenceTables, ['clinic_users']);
  assert.equal(schema.availableTables.has('unsafe-name'), false);
});

