import { NextResponse } from 'next/server'
import type { NodeExecutionResult, WorkflowExecution } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { executeWorkflow } from '@/lib/workflow/engine'
import { findWorkflowByWebhookPath, getCredentialConfig, saveExecution } from '@/lib/db/workflows'

interface RouteContext {
  params: Promise<{ path: string }>
}

async function handleWebhook(request: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  const { path } = await context.params
  const method = request.method.toUpperCase()
  const workflow = await findWorkflowByWebhookPath(path, method)

  if (!workflow) {
    return NextResponse.json({ error: 'No workflow found for this webhook path and method' }, { status: 404 })
  }

  const executionId = crypto.randomUUID()
  const startTime = new Date().toISOString()
  const nodeResults: Record<string, NodeExecutionResult> = {}

  try {
    const payload =
      method === 'GET'
        ? Object.fromEntries(new URL(request.url).searchParams.entries())
        : await request.json().catch(() => ({}))

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
      { webhookPayload: payload, credentialResolver: getCredentialConfig }
    )

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'success',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults,
    }
    await saveExecution(execution)
    return NextResponse.json({ ok: true, workflowId: workflow.id, executionId })
  } catch (error) {
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults,
      error: (error as Error).message,
    }
    await saveExecution(execution).catch(() => undefined)
    return NextResponse.json({ ok: false, error: (error as Error).message, executionId }, { status: 500 })
  }
}

export const GET = handleWebhook
export const POST = handleWebhook
export const PUT = handleWebhook
export const PATCH = handleWebhook
export const DELETE = handleWebhook
