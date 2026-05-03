'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { NODE_TYPES, type NodeCategory } from '@/lib/workflow/types'
import { useWorkflowStore } from '@/lib/workflow/store'
import { useI18n } from '@/lib/i18n'
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
  Bell,
  BookOpen,
  Brain,
  Braces,
  CalendarDays,
  CreditCard,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Github,
  HardDrive,
  ListFilter,
  MessageCircle,
  OctagonX,
  Phone,
  Presentation,
  Reply,
  Route,
  Send,
  Sparkles,
  Table,
  Table2,
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
  Bell,
  BookOpen,
  Brain,
  Braces,
  CalendarDays,
  CreditCard,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Github,
  HardDrive,
  ListFilter,
  MessageCircle,
  OctagonX,
  Phone,
  Presentation,
  Reply,
  Route,
  Send,
  Sparkles,
  Table,
  Table2,
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
  const { t, tt } = useI18n()
  const nodeData = data as unknown as BaseNodeData
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
  const getOutputLabel = (output: { id: string; label: string }) => {
    if (output.id === 'route1' && typeof nodeData.config.route1Label === 'string') return tt(nodeData.config.route1Label)
    if (output.id === 'route2' && typeof nodeData.config.route2Label === 'string') return tt(nodeData.config.route2Label)
    if (output.id === 'route3' && typeof nodeData.config.route3Label === 'string') return tt(nodeData.config.route3Label)
    return tt(output.label)
  }

  return (
    <div
      className={cn(
        'relative min-w-[190px] overflow-hidden rounded-md border bg-card shadow-sm transition-all hover:shadow-md',
        selected && categoryBorderColors[category],
        !selected && 'border-border',
        isRunning && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background animate-pulse',
        isSuccess && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background',
        isError && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background'
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', categoryColors[category])} />
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
      <div className="p-3 pl-4">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', categoryColors[category], categoryBorderColors[category])}>
            <Icon className={cn('h-4 w-4', categoryIconColors[category])} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {tt(nodeData.label || nodeType?.label || '')}
            </p>
            {nodeType?.description && (
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {tt(nodeType.description)}
              </p>
            )}
          </div>
        </div>
        
        {/* Execution status */}
        {nodeResult && (
          <div className={cn(
            'mt-2 rounded border px-2 py-1 text-xs font-medium',
            isRunning && 'bg-amber-500/20 text-amber-400',
            isSuccess && 'bg-green-500/20 text-green-400',
            isError && 'bg-red-500/20 text-red-400'
          )}>
            {isRunning && t('running')}
            {isSuccess && `${tt('Done')} (${nodeResult.duration}ms)`}
            {isError && t('error')}
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
            <span key={output.id} className="max-w-20 truncate text-[10px] text-muted-foreground">
              {getOutputLabel(output)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
