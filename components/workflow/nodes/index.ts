import { BaseNode } from './base-node'
import { NODE_TYPES } from '@/lib/workflow/types'

// Create node type components mapping for React Flow
export const nodeTypes = Object.keys(NODE_TYPES).reduce(
  (acc, type) => {
    acc[type] = BaseNode
    return acc
  },
  {} as Record<string, typeof BaseNode>
)

export { BaseNode }
