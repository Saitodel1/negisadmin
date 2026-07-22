import type { SupabaseClient } from '@supabase/supabase-js';

type OpenApiDefinition = {
  properties?: Record<string, unknown>;
};

type OpenApiDocument = {
  definitions?: Record<string, OpenApiDefinition>;
  paths?: Record<string, Record<string, unknown>>;
};

export type OrganizationDeletionSchema = {
  availableTables: Set<string>;
  clinicScopedTables: string[];
  userReferenceTables: string[];
};

export type OrganizationDataDeletionReport = {
  deletedRows: number;
  deletedTables: string[];
};

type IndirectRelation = {
  parentTable: string;
  childTable: string;
  childColumn: string;
};

const INDIRECT_RELATIONS: IndirectRelation[] = [
  { parentTable: 'tasks', childTable: 'task_attachments', childColumn: 'task_id' },
  { parentTable: 'tasks', childTable: 'task_checklist_items', childColumn: 'task_id' },
  { parentTable: 'tasks', childTable: 'task_events', childColumn: 'task_id' },
  { parentTable: 'tasks', childTable: 'task_watchers', childColumn: 'task_id' },
  { parentTable: 'tasks', childTable: 'task_comments', childColumn: 'task_id' },
  { parentTable: 'bookings', childTable: 'booking_history', childColumn: 'booking_id' },
  { parentTable: 'leads', childTable: 'lead_history', childColumn: 'lead_id' },
  { parentTable: 'departments', childTable: 'department_members', childColumn: 'department_id' },
  { parentTable: 'agents', childTable: 'department_members', childColumn: 'agent_id' },
  { parentTable: 'integration_connections', childTable: 'integration_secrets', childColumn: 'integration_connection_id' },
  { parentTable: 'organization_integrations', childTable: 'integration_credentials', childColumn: 'integration_id' },
  { parentTable: 'organization_integrations', childTable: 'integration_events', childColumn: 'integration_id' },
  { parentTable: 'organization_integrations', childTable: 'sync_jobs', childColumn: 'integration_id' }
];

function isSafeIdentifier(value: string) {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

export function discoverOrganizationDeletionSchema(document: OpenApiDocument): OrganizationDeletionSchema {
  const definitions = document.definitions || {};
  const availableTables = new Set(Object.keys(definitions).filter(isSafeIdentifier));
  const writableTables = new Set(
    Object.entries(document.paths || {})
      .filter(([path, methods]) => path.startsWith('/') && Boolean(methods.delete))
      .map(([path]) => path.slice(1))
      .filter(isSafeIdentifier)
  );

  const clinicScopedTables: string[] = [];
  const userReferenceTables: string[] = [];
  for (const [table, definition] of Object.entries(definitions)) {
    if (!isSafeIdentifier(table) || !writableTables.has(table)) continue;
    const columns = Object.keys(definition.properties || {});
    if (columns.includes('clinic_id')) clinicScopedTables.push(table);
    if (columns.includes('user_id')) userReferenceTables.push(table);
  }

  return {
    availableTables,
    clinicScopedTables: clinicScopedTables.sort(),
    userReferenceTables: userReferenceTables.sort()
  };
}

export async function loadOrganizationDeletionSchema(supabaseUrl: string, serviceRoleKey: string) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/openapi+json'
    }
  });
  if (!response.ok) {
    throw new Error(`Не удалось прочитать схему Supabase для удаления: HTTP ${response.status}`);
  }
  return discoverOrganizationDeletionSchema(await response.json() as OpenApiDocument);
}

async function loadClinicEntityIds(client: SupabaseClient, table: string, clinicId: string) {
  const { data, error } = await client.from(table).select('id').eq('clinic_id', clinicId);
  if (error) throw new Error(`Не удалось подготовить удаление из ${table}: ${error.message}`);
  return (data || []).map((row: { id?: unknown }) => String(row.id || '')).filter(Boolean);
}

async function deleteByIds(client: SupabaseClient, table: string, column: string, ids: string[]) {
  let deletedRows = 0;
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { count, error } = await client.from(table).delete({ count: 'exact' }).in(column, chunk);
    if (error) throw new Error(`Не удалось удалить связанные записи из ${table}: ${error.message}`);
    deletedRows += count || 0;
  }
  return deletedRows;
}

async function deleteIndirectRows(client: SupabaseClient, clinicId: string, schema: OrganizationDeletionSchema) {
  let deletedRows = 0;
  for (const relation of INDIRECT_RELATIONS) {
    if (!schema.availableTables.has(relation.parentTable) || !schema.availableTables.has(relation.childTable)) continue;
    const parentIds = await loadClinicEntityIds(client, relation.parentTable, clinicId);
    if (!parentIds.length) continue;
    deletedRows += await deleteByIds(client, relation.childTable, relation.childColumn, parentIds);
  }
  return deletedRows;
}

export async function deleteOrganizationData(
  client: SupabaseClient,
  clinicId: string,
  schema: OrganizationDeletionSchema
): Promise<OrganizationDataDeletionReport> {
  let deletedRows = await deleteIndirectRows(client, clinicId, schema);
  const pending = new Set(schema.clinicScopedTables);
  const deletedTables: string[] = [];
  const errors = new Map<string, string>();

  for (let pass = 0; pass <= schema.clinicScopedTables.length && pending.size; pass += 1) {
    let progress = false;
    for (const table of [...pending]) {
      const { count, error } = await client.from(table).delete({ count: 'exact' }).eq('clinic_id', clinicId);
      if (error) {
        errors.set(table, error.message);
        continue;
      }
      pending.delete(table);
      errors.delete(table);
      deletedTables.push(table);
      deletedRows += count || 0;
      progress = true;
    }
    if (!progress) break;
  }

  if (pending.size) {
    const details = [...pending].map((table) => `${table}: ${errors.get(table) || 'неизвестная ошибка'}`).join('; ');
    throw new Error(`Удаление остановлено. Не очищены таблицы: ${details}`);
  }

  return { deletedRows, deletedTables };
}

export async function findRemainingUserReferences(
  client: SupabaseClient,
  userId: string,
  schema: OrganizationDeletionSchema
) {
  const references: Array<{ table: string; count: number }> = [];

  const { count: ownedClinics, error: ownedClinicsError } = await client
    .from('clinics')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if (ownedClinicsError) throw new Error(`Не удалось проверить другие организации владельца: ${ownedClinicsError.message}`);
  if (ownedClinics) references.push({ table: 'clinics.owner_id', count: ownedClinics });

  for (const table of schema.userReferenceTables) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw new Error(`Не удалось проверить ссылки пользователя в ${table}: ${error.message}`);
    if (count) references.push({ table, count });
  }

  return references;
}

