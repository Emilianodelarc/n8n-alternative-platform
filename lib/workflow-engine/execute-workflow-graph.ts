import type { Workflow } from '@/lib/workflow/types'
import { executeNodeForEachItem, executeNodeOnce, getExecutionMode } from './node-executor'
import { getNextNodes, getStartNodes } from './graph'
import { toWorkflowItems } from './items'
import type {
  ExecuteWorkflowGraphOptions,
  WorkflowItem,
  WorkflowItemError,
  WorkflowEngineContext,
  WorkflowGraphExecutionResult,
  WorkflowNodeExecutionLog,
} from './types'

function now() {
  return new Date().toISOString()
}

function durationMs(startedAt: string, finishedAt: string) {
  return Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt))
}

function appendInput(currentInput: unknown, nextInput: unknown) {
  if (currentInput === undefined) return nextInput
  if (Array.isArray(currentInput)) return [...currentInput, nextInput]
  return [currentInput, nextInput]
}

export async function executeWorkflowGraph(
  workflow: Workflow,
  options: ExecuteWorkflowGraphOptions = {}
): Promise<WorkflowGraphExecutionResult> {
  const ctx: WorkflowEngineContext = {
    workflow,
    nodes: workflow.nodes,
    edges: workflow.edges,
    outputs: new Map(),
    itemOutputs: new Map(),
    webhookPayload: options.webhookPayload,
    credentialResolver: options.credentialResolver,
  }
  const logs: WorkflowNodeExecutionLog[] = []
  const startNodes = getStartNodes(workflow.nodes, workflow.edges)
  const queue = startNodes.map((node) => ({ node, input: undefined as unknown }))
  const queuedNodeIds = new Set(queue.map((item) => item.node.id))
  const executedNodeIds = new Set<string>()
  const pendingInputs = new Map<string, unknown>()

  while (queue.length > 0) {
    const { node, input } = queue.shift()!
    queuedNodeIds.delete(node.id)
    if (executedNodeIds.has(node.id)) continue

    const startedAt = now()
    const inputItems = toWorkflowItems(input)
    const log: WorkflowNodeExecutionLog = {
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.type,
      status: 'running',
      startedAt,
      input: inputItems,
      output: null,
      inputItemCount: inputItems.length,
    }
    logs.push(log)

    try {
      const executionMode = getExecutionMode(node)
      let output: WorkflowItem[] | Record<string, WorkflowItem[]>
      let itemErrors: WorkflowItemError[] = []

      if (executionMode === 'perItem') {
        const result = await executeNodeForEachItem(node, inputItems, ctx)
        output = result.items
        itemErrors = result.itemErrors
      } else {
        output = await executeNodeOnce(node, inputItems, ctx)
      }

      const finishedAt = now()
      const outputItems = Array.isArray(output)
        ? output
        : Object.values(output).flatMap((items) => items)

      log.status = 'success'
      log.finishedAt = finishedAt
      log.durationMs = durationMs(startedAt, finishedAt)
      log.output = output
      log.outputItemCount = outputItems.length
      log.itemErrors = itemErrors
      log.summary = formatNodeSummary(node.data.label, inputItems.length, outputItems.length, itemErrors.length)
      ctx.outputs.set(node.id, output)
      ctx.itemOutputs.set(node.id, outputItems)
      executedNodeIds.add(node.id)

      for (const next of getNextNodes(node, output, workflow.nodes, workflow.edges)) {
        const currentPendingInput = pendingInputs.get(next.node.id)
        pendingInputs.set(next.node.id, appendInput(currentPendingInput, next.input))
        if (!queuedNodeIds.has(next.node.id) && !executedNodeIds.has(next.node.id)) {
          queue.push({ node: next.node, input: pendingInputs.get(next.node.id) })
          queuedNodeIds.add(next.node.id)
        }
      }
    } catch (error) {
      const finishedAt = now()
      const message = error instanceof Error ? error.message : String(error)

      log.status = 'error'
      log.finishedAt = finishedAt
      log.durationMs = durationMs(startedAt, finishedAt)
      log.error = message

      return {
        status: 'error',
        logs,
        outputs: ctx.outputs,
        error: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
          message,
        },
      }
    }
  }

  return {
    status: 'success',
    logs,
    outputs: ctx.outputs,
  }
}

export { getNextNodes, getStartNodes } from './graph'
export { executeNode, executeNodeForEachItem, executeNodeOnce } from './node-executor'

function formatNodeSummary(nodeLabel: string, inputCount: number, outputCount: number, errorCount: number) {
  const base = `${nodeLabel}: ${inputCount} item(s) received, ${outputCount} item(s) returned`
  return errorCount > 0 ? `${base}, ${errorCount} item error(s)` : base
}
