import { NextResponse } from 'next/server'
import type { NodeExecutionResult, WorkflowExecution } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { getCredentialConfig, getWorkflow, saveExecution } from '@/lib/db/workflows'
import { executeWorkflowGraph, type WorkflowNodeExecutionLog } from '@/lib/workflow-engine'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  const { id } = await context.params
  const executionId = crypto.randomUUID()
  const startTime = new Date().toISOString()

  try {
    const workflow = await getWorkflow(id)
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const graphExecution = await executeWorkflowGraph(workflow, {
      webhookPayload: body.webhookPayload,
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
    const saved = await saveExecution(execution)
    return NextResponse.json(
      graphExecution.status === 'success'
        ? { execution: saved }
        : { execution: saved, error: graphExecution.error?.message }
    )
  } catch (error) {
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: id,
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      nodeResults: {},
      logs: [],
      errorMessage: (error as Error).message,
      error: (error as Error).message,
    }
    const saved = await saveExecution(execution).catch(() => execution)
    return NextResponse.json({ execution: saved, error: (error as Error).message })
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
