import type { Workflow, WorkflowExecution } from '@/lib/workflow/types'
import { getSql } from './neon'

let databaseInitialized = false

export async function initializeDatabase() {
  const sql = getSql()

  await sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
      edges JSONB NOT NULL DEFAULT '[]'::jsonb,
      variables JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      node_results JSONB NOT NULL DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS workflow_executions_workflow_id_idx ON workflow_executions(workflow_id)`
  await sql`CREATE INDEX IF NOT EXISTS workflows_updated_at_idx ON workflows(updated_at DESC)`
  databaseInitialized = true
}

async function ensureDatabaseInitialized() {
  if (databaseInitialized) return
  await initializeDatabase()
}

type WorkflowRow = {
  id: string
  name: string
  description: string | null
  nodes: Workflow['nodes']
  edges: Workflow['edges']
  variables: Workflow['variables']
  created_at: Date | string
  updated_at: Date | string
}

type ExecutionRow = {
  id: string
  workflow_id: string
  status: WorkflowExecution['status']
  node_results: WorkflowExecution['nodeResults']
  error: string | null
  started_at: Date | string
  ended_at: Date | string | null
}

type CredentialRow = {
  id: string
  name: string
  service: string
  config: Record<string, unknown>
  created_at: Date | string
  updated_at: Date | string
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    nodes: row.nodes || [],
    edges: row.edges || [],
    variables: row.variables || {},
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  }
}

function mapExecution(row: ExecutionRow): WorkflowExecution {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    nodeResults: row.node_results || {},
    error: row.error || undefined,
    startTime: toIso(row.started_at)!,
    endTime: toIso(row.ended_at),
  }
}

export async function listWorkflows() {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    SELECT id, name, description, nodes, edges, variables, created_at, updated_at
    FROM workflows
    ORDER BY updated_at DESC
  ` as WorkflowRow[]
  return rows.map(mapWorkflow)
}

export async function getWorkflow(id: string) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    SELECT id, name, description, nodes, edges, variables, created_at, updated_at
    FROM workflows
    WHERE id = ${id}
    LIMIT 1
  ` as WorkflowRow[]
  return rows[0] ? mapWorkflow(rows[0]) : null
}

export async function upsertWorkflow(workflow: Workflow) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO workflows (id, name, description, nodes, edges, variables, created_at, updated_at)
    VALUES (
      ${workflow.id},
      ${workflow.name},
      ${workflow.description || null},
      ${JSON.stringify(workflow.nodes)}::jsonb,
      ${JSON.stringify(workflow.edges)}::jsonb,
      ${JSON.stringify(workflow.variables || {})}::jsonb,
      ${workflow.createdAt || new Date().toISOString()},
      ${workflow.updatedAt || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      nodes = EXCLUDED.nodes,
      edges = EXCLUDED.edges,
      variables = EXCLUDED.variables,
      updated_at = EXCLUDED.updated_at
    RETURNING id, name, description, nodes, edges, variables, created_at, updated_at
  ` as WorkflowRow[]
  return mapWorkflow(rows[0])
}

export async function deleteWorkflowById(id: string) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  await sql`DELETE FROM workflows WHERE id = ${id}`
}

export async function saveExecution(execution: WorkflowExecution) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    INSERT INTO workflow_executions (id, workflow_id, status, node_results, error, started_at, ended_at)
    VALUES (
      ${execution.id},
      ${execution.workflowId},
      ${execution.status},
      ${JSON.stringify(execution.nodeResults || {})}::jsonb,
      ${execution.error || null},
      ${execution.startTime || new Date().toISOString()},
      ${execution.endTime || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      node_results = EXCLUDED.node_results,
      error = EXCLUDED.error,
      ended_at = EXCLUDED.ended_at
    RETURNING id, workflow_id, status, node_results, error, started_at, ended_at
  ` as ExecutionRow[]
  return mapExecution(rows[0])
}

export async function listExecutions(workflowId: string) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    SELECT id, workflow_id, status, node_results, error, started_at, ended_at
    FROM workflow_executions
    WHERE workflow_id = ${workflowId}
    ORDER BY started_at DESC
    LIMIT 50
  ` as ExecutionRow[]
  return rows.map(mapExecution)
}

export async function findWorkflowByWebhookPath(path: string, method: string) {
  const workflows = await listWorkflows()
  const normalizedMethod = method.toUpperCase()

  return workflows.find((workflow) =>
    workflow.nodes.some((node) => {
      if (node.type !== 'webhook-trigger') return false
      const config = node.data.config || {}
      return config.path === path && String(config.method || 'POST').toUpperCase() === normalizedMethod
    })
  ) || null
}

export async function getCredentialConfig(id: string) {
  await ensureDatabaseInitialized()
  const sql = getSql()
  const rows = await sql`
    SELECT id, name, service, config, created_at, updated_at
    FROM credentials
    WHERE id = ${id}
    LIMIT 1
  ` as CredentialRow[]

  return rows[0]?.config || null
}
