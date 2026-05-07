import type { ExecutionStatus, Workflow, WorkflowEdge, WorkflowNode } from '@/lib/workflow/types'

export type WorkflowItem = {
  json: Record<string, unknown>
  binary?: Record<string, unknown>
  pairedItem?: number
}

export type WorkflowNodeExecutionMode = 'once' | 'perItem'

export interface WorkflowItemError {
  itemIndex: number
  message: string
  input?: WorkflowItem
}

export interface WorkflowNodeExecutionLog {
  nodeId: string
  nodeLabel: string
  nodeType: string
  status: ExecutionStatus
  startedAt: string
  finishedAt?: string
  durationMs?: number
  input: unknown
  output: unknown
  error?: string
  inputItemCount?: number
  outputItemCount?: number
  currentItemIndex?: number
  itemErrors?: WorkflowItemError[]
  summary?: string
}

export interface WorkflowGraphExecutionResult {
  status: 'success' | 'error'
  logs: WorkflowNodeExecutionLog[]
  outputs: Map<string, unknown>
  error?: {
    nodeId: string
    nodeLabel: string
    nodeType: string
    message: string
  }
}

export interface WorkflowEngineContext {
  workflow: Workflow
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  outputs: Map<string, unknown>
  itemOutputs: Map<string, WorkflowItem[]>
  webhookPayload?: unknown
  credentialResolver?: (credentialId: string) => Promise<Record<string, unknown> | null>
}

export interface ExecuteWorkflowGraphOptions {
  webhookPayload?: unknown
  credentialResolver?: (credentialId: string) => Promise<Record<string, unknown> | null>
}
