'use client'

import { useState } from 'react'
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  Trash2,
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useWorkflowStore } from '@/lib/workflow/store'
import { useI18n } from '@/lib/i18n'
import type { WorkflowExecution, ExecutionStatus } from '@/lib/workflow/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<ExecutionStatus, { icon: React.ElementType; color: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground' },
  running: { icon: Play, color: 'text-blue-500' },
  success: { icon: CheckCircle, color: 'text-green-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  skipped: { icon: Clock, color: 'text-muted-foreground' },
}

function ExecutionItem({ execution }: { execution: WorkflowExecution }) {
  const { t, tt } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const workflows = useWorkflowStore((s) => s.workflows)
  
  const workflow = workflows.find((w) => w.id === execution.workflowId)
  const config = statusConfig[execution.status]
  const StatusIcon = config.icon

  const duration = execution.endTime
    ? new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()
    : null

  const nodeResults = Object.entries(execution.nodeResults)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors text-left">
          <div className="flex items-center gap-3">
            <StatusIcon className={cn('w-4 h-4', config.color)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate text-sm">
                  {workflow?.name ? tt(workflow.name) : t('unknownWorkflow')}
                </span>
                <Badge variant="outline" className={cn('text-xs', config.color)}>
                  {t(execution.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>{new Date(execution.startTime).toLocaleString()}</span>
                {duration && <span>{(duration / 1000).toFixed(2)}s</span>}
              </div>
            </div>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-4 pl-4 border-l border-border space-y-2">
          {execution.error && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {execution.error}
            </div>
          )}
          {nodeResults.length > 0 && (
            <div className="space-y-1">
              {nodeResults.map(([nodeId, result]) => {
                const node = workflow?.nodes.find((n) => n.id === nodeId)
                const nodeConfig = statusConfig[result.status]
                const NodeIcon = nodeConfig.icon
                return (
                  <div
                    key={nodeId}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs"
                  >
                    <NodeIcon className={cn('w-3 h-3', nodeConfig.color)} />
                    <span className="font-medium">{node?.data.label ? tt(node.data.label) : nodeId}</span>
                    {result.duration && (
                      <span className="text-muted-foreground">{result.duration}ms</span>
                    )}
                    {result.error && (
                      <span className="text-red-400 truncate flex-1">{result.error}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ExecutionHistory() {
  const { t } = useI18n()
  const executionHistory = useWorkflowStore((s) => s.executionHistory)
  const clearExecutionHistory = useWorkflowStore((s) => s.clearExecutionHistory)

  const stats = {
    total: executionHistory.length,
    success: executionHistory.filter((e) => e.status === 'success').length,
    error: executionHistory.filter((e) => e.status === 'error').length,
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t('executionHistory')}</h3>
        </div>
        {executionHistory.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={clearExecutionHistory}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('clear')}
          </Button>
        )}
      </div>

      {executionHistory.length > 0 && (
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t('total')}</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="font-medium">{stats.success}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            <span className="font-medium">{stats.error}</span>
          </div>
        </div>
      )}

      <ScrollArea className="h-[350px]">
        {executionHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('noExecutionsYet')}</p>
            <p className="text-xs">{t('runWorkflowHistory')}</p>
          </div>
        ) : (
          <div className="space-y-2 pr-4">
            {executionHistory.map((execution) => (
              <ExecutionItem key={execution.id} execution={execution} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
