'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/workflow/store'
import { ChevronUp, ChevronDown, X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

interface ExecutionPanelProps {
  className?: string
}

export function ExecutionPanel({ className }: ExecutionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const currentExecution = useWorkflowStore((s) => s.currentExecution)
  const executionHistory = useWorkflowStore((s) => s.executionHistory)
  const clearExecutionHistory = useWorkflowStore((s) => s.clearExecutionHistory)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())

  const executions = currentExecution ? [currentExecution, ...executionHistory] : executionHistory

  if (executions.length === 0) {
    return null
  }

  const latestExecution = executions[0]
  const nodeResults = Object.entries(latestExecution?.nodeResults || {})

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-card border-t border-border transition-all duration-200',
        isExpanded ? 'h-64' : 'h-10',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Execution Log</span>
          {latestExecution && (
            <span
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                latestExecution.status === 'running' && 'bg-amber-500/20 text-amber-400',
                latestExecution.status === 'success' && 'bg-green-500/20 text-green-400',
                latestExecution.status === 'error' && 'bg-red-500/20 text-red-400'
              )}
            >
              {latestExecution.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {latestExecution.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
              {latestExecution.status === 'error' && <XCircle className="w-3 h-3" />}
              {latestExecution.status}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {nodeResults.length} node{nodeResults.length !== 1 ? 's' : ''} executed
          </span>
        </div>

        <div className="flex items-center gap-2">
          {executionHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                clearExecutionHistory()
              }}
            >
              Clear History
            </Button>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-4 space-y-3">
            {nodeResults.map(([nodeId, result]) => {
              const node = workflow?.nodes.find((n) => n.id === nodeId)
              return (
                <div
                  key={nodeId}
                  className={cn(
                    'p-3 rounded-lg border',
                    result.status === 'running' && 'border-amber-500/30 bg-amber-500/5',
                    result.status === 'success' && 'border-green-500/30 bg-green-500/5',
                    result.status === 'error' && 'border-red-500/30 bg-red-500/5',
                    result.status === 'pending' && 'border-border bg-muted/50',
                    result.status === 'skipped' && 'border-border bg-muted/50 opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.status === 'running' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                      {result.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {result.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                      {result.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium text-foreground">
                        {node?.data.label || nodeId}
                      </span>
                    </div>
                    {result.duration !== undefined && (
                      <span className="text-xs text-muted-foreground">{result.duration}ms</span>
                    )}
                  </div>

                  {result.output !== undefined && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Output:</p>
                      <pre className="p-2 rounded bg-background/50 text-xs font-mono overflow-auto max-h-24">
                        {JSON.stringify(result.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-2">
                      <p className="text-xs text-red-400 mb-1">Error:</p>
                      <pre className="p-2 rounded bg-red-500/10 text-xs font-mono text-red-400 overflow-auto">
                        {result.error}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}

            {nodeResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No execution data available
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
