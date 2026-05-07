import { NextResponse } from 'next/server'
import type { NodeExecutionResult, WorkflowExecution } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { executeWorkflowGraph, type WorkflowNodeExecutionLog } from '@/lib/workflow-engine'
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

  try {
    const payload =
      method === 'GET'
        ? Object.fromEntries(new URL(request.url).searchParams.entries())
        : await request.json().catch(() => ({}))

    const graphExecution = await executeWorkflowGraph(workflow, {
      webhookPayload: payload,
      credentialResolver: getCredentialConfig,
    })
    const endTime = new Date().toISOString()
    const nodeResults = Object.fromEntries(
      graphExecution.logs.map((log) => [log.nodeId, mapExecutionLog(log)])
    )
    const logs = Object.values(nodeResults)

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: graphExecution.status,
      startTime,
      endTime,
      durationMs: Math.max(0, Date.parse(endTime) - Date.parse(startTime)),
      nodeResults,
      logs,
      errorNodeId: graphExecution.error?.nodeId,
      errorMessage: graphExecution.error?.message,
      error: graphExecution.error?.message,
    }
    await saveExecution(execution)
    if (graphExecution.status === 'error') {
      return NextResponse.json({ ok: false, error: graphExecution.error?.message, executionId }, { status: 500 })
    }
    return NextResponse.json({ ok: true, workflowId: workflow.id, executionId })
  } catch (error) {
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults: {},
      logs: [],
      errorMessage: (error as Error).message,
      error: (error as Error).message,
    }
    await saveExecution(execution).catch(() => undefined)
    return NextResponse.json({ ok: false, error: (error as Error).message, executionId }, { status: 500 })
  }
}

function mapExecutionLog(log: WorkflowNodeExecutionLog): NodeExecutionResult {
  return {
    nodeId: log.nodeId,
    nodeLabel: log.nodeLabel,
    nodeType: log.nodeType,
    status: log.status,
    input: log.input,
    output: log.output,
    error: log.error,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    durationMs: log.durationMs,
    startTime: log.startedAt,
    endTime: log.finishedAt,
    duration: log.durationMs,
  }
}

export const GET = handleWebhook
export const POST = handleWebhook
export const PUT = handleWebhook
export const PATCH = handleWebhook
export const DELETE = handleWebhook
