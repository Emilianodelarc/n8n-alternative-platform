import type { WorkflowEdge, WorkflowNode } from '@/lib/workflow/types'

function hasValueForHandle(output: unknown, handle?: string) {
  if (!handle) return output !== undefined
  if (!output || typeof output !== 'object') return false
  return (output as Record<string, unknown>)[handle] !== undefined
}

function getOutputForHandle(output: unknown, handle?: string) {
  if (!handle) return output
  if (!output || typeof output !== 'object') return undefined
  return (output as Record<string, unknown>)[handle]
}

export function getStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const targetIds = new Set(edges.map((edge) => edge.target))
  const roots = nodes.filter((node) => !targetIds.has(node.id))
  const triggerRoots = roots.filter((node) => node.data.category === 'trigger' || node.type.includes('trigger'))
  return triggerRoots.length > 0 ? triggerRoots : roots
}

export function getNextNodes(
  node: WorkflowNode,
  output: unknown,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]))

  return edges
    .filter((edge) => edge.source === node.id)
    .filter((edge) => hasValueForHandle(output, edge.sourceHandle))
    .map((edge) => {
      const nextNode = nodeById.get(edge.target)
      if (!nextNode) return null
      return {
        edge,
        node: nextNode,
        input: getOutputForHandle(output, edge.sourceHandle),
      }
    })
    .filter(Boolean) as Array<{ edge: WorkflowEdge; node: WorkflowNode; input: unknown }>
}
