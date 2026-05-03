'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { NODE_TYPES, type NodeCategory } from '@/lib/workflow/types'
import { useWorkflowStore } from '@/lib/workflow/store'
import {
  Play,
  Webhook,
  Clock,
  Globe,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  GitFork,
  Repeat,
  Merge,
  Variable,
  Wand,
  Filter,
  Split,
  Timer,
  Circle,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play,
  Webhook,
  Clock,
  Globe,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  GitFork,
  Repeat,
  Merge,
  Variable,
  Wand,
  Filter,
  Split,
  Timer,
  Circle,
}

const categoryColors: Record<NodeCategory, string> = {
  trigger: 'border-green-500/50 bg-green-500/10',
  action: 'border-blue-500/50 bg-blue-500/10',
  logic: 'border-amber-500/50 bg-amber-500/10',
  transform: 'border-purple-500/50 bg-purple-500/10',
  utility: 'border-zinc-500/50 bg-zinc-500/10',
}

const categoryIconColors: Record<NodeCategory, string> = {
  trigger: 'text-green-400',
  action: 'text-blue-400',
  logic: 'text-amber-400',
  transform: 'text-purple-400',
  utility: 'text-zinc-400',
}

const categoryBorderColors: Record<NodeCategory, string> = {
  trigger: 'border-green-500',
  action: 'border-blue-500',
  logic: 'border-amber-500',
  transform: 'border-purple-500',
  utility: 'border-zinc-500',
}

interface BaseNodeData {
  label: string
  description?: string
  category: NodeCategory
  config: Record<string, unknown>
}

function BaseNodeComponent({ id, data, type, selected }: NodeProps) {
  const nodeData = data as BaseNodeData
  const nodeType = NODE_TYPES[type as string]
  const currentExecution = useWorkflowStore((s) => s.currentExecution)
  const nodeResult = currentExecution?.nodeResults[id]
  
  const Icon = iconMap[nodeType?.icon || 'Circle'] || Circle
  const category = nodeData.category || nodeType?.category || 'utility'
  
  const isRunning = nodeResult?.status === 'running'
  const isSuccess = nodeResult?.status === 'success'
  const isError = nodeResult?.status === 'error'
  
  const inputs = nodeType?.inputs || []
  const outputs = nodeType?.outputs || []

  return (
    <div
      className={cn(
        'relative min-w-[180px] rounded-lg border-2 bg-card shadow-lg transition-all',
        categoryColors[category],
        selected && categoryBorderColors[category],
        !selected && 'border-border/50',
        isRunning && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background animate-pulse',
        isSuccess && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background',
        isError && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background'
      )}
    >
      {/* Input handles */}
      {inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background hover:!bg-foreground transition-colors"
          style={{
            top: inputs.length === 1 ? '50%' : `${((index + 1) / (inputs.length + 1)) * 100}%`,
          }}
        />
      ))}

      {/* Node content */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-md', categoryColors[category])}>
            <Icon className={cn('w-4 h-4', categoryIconColors[category])} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {nodeData.label || nodeType?.label}
            </p>
            {nodeType?.description && (
              <p className="text-xs text-muted-foreground truncate">
                {nodeType.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Execution status */}
        {nodeResult && (
          <div className={cn(
            'mt-2 px-2 py-1 rounded text-xs font-medium',
            isRunning && 'bg-amber-500/20 text-amber-400',
            isSuccess && 'bg-green-500/20 text-green-400',
            isError && 'bg-red-500/20 text-red-400'
          )}>
            {isRunning && 'Running...'}
            {isSuccess && `Done (${nodeResult.duration}ms)`}
            {isError && 'Error'}
          </div>
        )}
      </div>

      {/* Output handles */}
      {outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background hover:!bg-foreground transition-colors"
          style={{
            top: outputs.length === 1 ? '50%' : `${((index + 1) / (outputs.length + 1)) * 100}%`,
          }}
        />
      ))}
      
      {/* Output labels for multi-output nodes */}
      {outputs.length > 1 && (
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-around pr-6 pointer-events-none">
          {outputs.map((output) => (
            <span key={output.id} className="text-[10px] text-muted-foreground">
              {output.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
