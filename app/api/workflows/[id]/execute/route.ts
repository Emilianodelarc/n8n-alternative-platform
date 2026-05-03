import { NextResponse } from 'next/server'
import type { NodeExecutionResult, WorkflowExecution } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { getCredentialConfig, getWorkflow, saveExecution } from '@/lib/db/workflows'
import { executeWorkflow } from '@/lib/workflow/engine'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  const { id } = await context.params
  const executionId = crypto.randomUUID()
  const startTime = new Date().toISOString()
  const nodeResults: Record<string, NodeExecutionResult> = {}

  try {
    const workflow = await getWorkflow(id)
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    await executeWorkflow(
      workflow,
      {
        onNodeStart: (nodeId) => {
          nodeResults[nodeId] = {
            nodeId,
            status: 'running',
            input: null,
            output: null,
            startTime: new Date().toISOString(),
          }
        },
        onNodeComplete: (nodeId, result) => {
          nodeResults[nodeId] = {
            ...nodeResults[nodeId],
            status: 'success',
            output: result.output,
            endTime: new Date().toISOString(),
            duration: result.duration,
          }
        },
        onNodeError: (nodeId, error) => {
          nodeResults[nodeId] = {
            ...nodeResults[nodeId],
            status: 'error',
            error: error.message,
            endTime: new Date().toISOString(),
          }
        },
      },
      { webhookPayload: body.webhookPayload, credentialResolver: getCredentialConfig }
    )

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'success',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults,
    }
    const saved = await saveExecution(execution)
    return NextResponse.json({ execution: saved })
  } catch (error) {
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: id,
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults,
      error: (error as Error).message,
    }
    const saved = await saveExecution(execution).catch(() => execution)
    return NextResponse.json({ execution: saved, error: (error as Error).message })
  }
}
