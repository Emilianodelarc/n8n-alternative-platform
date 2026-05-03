import type { Workflow, WorkflowExecution } from './types'

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'API request failed')
  }
  return data as T
}

export async function fetchBackendWorkflows() {
  const response = await fetch('/api/workflows', { cache: 'no-store' })
  const data = await parseJson<{ workflows: Workflow[] }>(response)
  return data.workflows
}

export async function saveBackendWorkflow(workflow: Workflow) {
  const response = await fetch(`/api/workflows/${workflow.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  const data = await parseJson<{ workflow: Workflow }>(response)
  return data.workflow
}

export async function createBackendWorkflow(workflow: Workflow) {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  const data = await parseJson<{ workflow: Workflow }>(response)
  return data.workflow
}

export async function deleteBackendWorkflow(id: string) {
  const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
  await parseJson<{ ok: boolean }>(response)
}

export async function executeBackendWorkflow(id: string) {
  const response = await fetch(`/api/workflows/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const data = await parseJson<{ execution: WorkflowExecution }>(response)
  return data.execution
}

export async function fetchBackendExecutions(workflowId: string) {
  const response = await fetch(`/api/workflows/${workflowId}/executions`, { cache: 'no-store' })
  const data = await parseJson<{ executions: WorkflowExecution[] }>(response)
  return data.executions
}

