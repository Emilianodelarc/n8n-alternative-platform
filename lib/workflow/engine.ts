import type { Workflow, WorkflowNode, WorkflowEdge } from './types'

interface ExecutionCallbacks {
  onNodeStart?: (nodeId: string) => void
  onNodeComplete?: (nodeId: string, result: { output: unknown; duration: number }) => void
  onNodeError?: (nodeId: string, error: Error) => void
}

interface ExecutionContext {
  workflow: Workflow
  outputs: Map<string, unknown>
  callbacks: ExecutionCallbacks
}

// Get nodes in topological order for execution
function getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacencyList = new Map<string, string[]>()

  // Initialize
  nodes.forEach((node) => {
    inDegree.set(node.id, 0)
    adjacencyList.set(node.id, [])
  })

  // Build graph
  edges.forEach((edge) => {
    adjacencyList.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // Kahn's algorithm
  const queue: string[] = []
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId)
  })

  const result: WorkflowNode[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (node) result.push(node)

    adjacencyList.get(nodeId)?.forEach((targetId) => {
      const newDegree = (inDegree.get(targetId) || 0) - 1
      inDegree.set(targetId, newDegree)
      if (newDegree === 0) queue.push(targetId)
    })
  }

  return result
}

// Get the input data for a node based on connected edges
function getNodeInput(
  nodeId: string,
  edges: WorkflowEdge[],
  outputs: Map<string, unknown>
): unknown {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  
  if (incomingEdges.length === 0) {
    return null
  }
  
  if (incomingEdges.length === 1) {
    const sourceOutput = outputs.get(incomingEdges[0].source)
    if (incomingEdges[0].sourceHandle) {
      const handleOutput = sourceOutput as Record<string, unknown>
      return handleOutput?.[incomingEdges[0].sourceHandle] ?? sourceOutput
    }
    return sourceOutput
  }
  
  // Multiple inputs - combine them
  return incomingEdges.reduce((acc, edge) => {
    const key = edge.sourceHandle || edge.source
    acc[key] = outputs.get(edge.source)
    return acc
  }, {} as Record<string, unknown>)
}

// Execute a single node
async function executeNode(
  node: WorkflowNode,
  input: unknown,
  ctx: ExecutionContext
): Promise<unknown> {
  const { type, data } = node
  const config = data.config || {}

  switch (type) {
    // Triggers - just pass through or provide initial data
    case 'manual-trigger':
      return { triggered: true, timestamp: new Date().toISOString() }

    case 'webhook-trigger':
      return { method: config.method, triggered: true, timestamp: new Date().toISOString() }

    case 'schedule-trigger':
      return { interval: config.interval, triggered: true, timestamp: new Date().toISOString() }

    // HTTP Request
    case 'http-request': {
      const { method, url, headers, body } = config as {
        method: string
        url: string
        headers: string
        body: string
      }
      
      if (!url) {
        throw new Error('URL is required')
      }

      const parsedHeaders = headers ? JSON.parse(headers) : {}
      const fetchOptions: RequestInit = {
        method: method || 'GET',
        headers: parsedHeaders,
      }

      if (body && method !== 'GET') {
        fetchOptions.body = body
      }

      const response = await fetch(url, fetchOptions)
      const contentType = response.headers.get('content-type')
      
      let responseData: unknown
      if (contentType?.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      }
    }

    // Simulated actions
    case 'send-email': {
      const { to, subject, body } = config as { to: string; subject: string; body: string }
      console.log(`[SIMULATED EMAIL] To: ${to}, Subject: ${subject}, Body: ${body}`)
      return { sent: true, to, subject, timestamp: new Date().toISOString() }
    }

    case 'slack-message': {
      const { channel, message } = config as { channel: string; message: string }
      console.log(`[SIMULATED SLACK] Channel: ${channel}, Message: ${message}`)
      return { sent: true, channel, message, timestamp: new Date().toISOString() }
    }

    // Code execution
    case 'code': {
      const { code } = config as { code: string }
      const fn = new Function('input', code)
      return fn(input)
    }

    // Logic nodes
    case 'if-else': {
      const { condition } = config as { condition: string }
      const fn = new Function('input', `return ${condition}`)
      const result = fn(input)
      return { true: result ? input : undefined, false: !result ? input : undefined }
    }

    case 'switch': {
      const { expression, cases } = config as { expression: string; cases: string }
      const fn = new Function('input', `return ${expression}`)
      const value = fn(input)
      const casesList = JSON.parse(cases) as string[]
      
      const result: Record<string, unknown> = { default: input }
      casesList.forEach((c, i) => {
        result[`case${i}`] = value === c ? input : undefined
      })
      
      return result
    }

    case 'loop': {
      const { arrayPath } = config as { arrayPath: string }
      const fn = new Function('input', `return ${arrayPath}`)
      const array = fn(input)
      
      if (!Array.isArray(array)) {
        throw new Error('Loop input must be an array')
      }
      
      // Return items for processing
      return { items: array, done: array }
    }

    case 'merge': {
      // Just combine inputs
      return input
    }

    // Transform nodes
    case 'set': {
      const { assignments } = config as { assignments: string }
      const parsed = JSON.parse(assignments)
      return { ...((input as object) || {}), ...parsed }
    }

    case 'transform': {
      const { code } = config as { code: string }
      const fn = new Function('input', code)
      return fn(input)
    }

    case 'filter': {
      const { condition } = config as { condition: string }
      const fn = new Function('item', `return (${condition})(item)`)
      if (!Array.isArray(input)) {
        throw new Error('Filter input must be an array')
      }
      return input.filter((item) => fn(item))
    }

    case 'split': {
      if (!Array.isArray(input)) {
        throw new Error('Split input must be an array')
      }
      return input
    }

    // Utility nodes
    case 'delay': {
      const { seconds } = config as { seconds: number }
      await new Promise((resolve) => setTimeout(resolve, (seconds || 1) * 1000))
      return input
    }

    case 'no-op':
      return input

    default:
      return input
  }
}

export async function executeWorkflow(
  workflow: Workflow,
  callbacks: ExecutionCallbacks = {}
): Promise<Map<string, unknown>> {
  const ctx: ExecutionContext = {
    workflow,
    outputs: new Map(),
    callbacks,
  }

  const executionOrder = getExecutionOrder(workflow.nodes, workflow.edges)

  for (const node of executionOrder) {
    const startTime = performance.now()
    callbacks.onNodeStart?.(node.id)

    try {
      const input = getNodeInput(node.id, workflow.edges, ctx.outputs)
      const output = await executeNode(node, input, ctx)
      const duration = Math.round(performance.now() - startTime)

      ctx.outputs.set(node.id, output)
      callbacks.onNodeComplete?.(node.id, { output, duration })
    } catch (error) {
      callbacks.onNodeError?.(node.id, error as Error)
      throw error
    }
  }

  return ctx.outputs
}
