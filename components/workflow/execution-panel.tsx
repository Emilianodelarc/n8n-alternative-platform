'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/workflow/store'
import { useI18n } from '@/lib/i18n'
import { ChevronUp, ChevronDown, X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

interface ExecutionPanelProps {
  className?: string
}

export function ExecutionPanel({ className }: ExecutionPanelProps) {
  const { t, tt } = useI18n()
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
          <span className="text-sm font-medium text-foreground">{t('executionLog')}</span>
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
              {t(latestExecution.status as 'pending' | 'running' | 'success' | 'error' | 'skipped')}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {nodeResults.length} {t('nodes').toLowerCase()} {t('executed')}
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
              {t('clearHistory')}
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
              const nodeLabel = result.nodeLabel || node?.data.label || nodeId
              const nodeType = result.nodeType || node?.type
              const duration = result.durationMs ?? result.duration
              const startedAt = result.startedAt || result.startTime
              const finishedAt = result.finishedAt || result.endTime
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
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {tt(nodeLabel)}
                        </span>
                        {nodeType && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {nodeType}
                          </span>
                        )}
                      </div>
                    </div>
                    {duration !== undefined && (
                      <span className="text-xs text-muted-foreground">{duration}ms</span>
                    )}
                  </div>

                  <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <span>{t('started')}: {startedAt ? new Date(startedAt).toLocaleTimeString() : '-'}</span>
                    <span>{t('finished')}: {finishedAt ? new Date(finishedAt).toLocaleTimeString() : '-'}</span>
                  </div>

                  {(result.inputItemCount !== undefined || result.outputItemCount !== undefined) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded bg-background/70 px-2 py-1 text-muted-foreground">
                        {t('itemsIn')}: {result.inputItemCount ?? 0}
                      </span>
                      <span className="rounded bg-background/70 px-2 py-1 text-muted-foreground">
                        {t('itemsOut')}: {result.outputItemCount ?? 0}
                      </span>
                      {result.itemErrors && result.itemErrors.length > 0 && (
                        <span className="rounded bg-red-500/10 px-2 py-1 text-red-400">
                          {t('itemErrors')}: {result.itemErrors.length}
                        </span>
                      )}
                    </div>
                  )}

                  {result.summary && (
                    <p className="mt-2 text-xs text-muted-foreground">{tt(result.summary)}</p>
                  )}

                  {result.input !== undefined && result.input !== null && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">{t('inputs')}:</p>
                      <pre className="p-2 rounded bg-background/50 text-xs font-mono overflow-auto max-h-24">
                        {JSON.stringify(result.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result.output !== undefined && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">{t('output')}:</p>
                      <pre className="p-2 rounded bg-background/50 text-xs font-mono overflow-auto max-h-24">
                        {JSON.stringify(result.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-2">
                      <p className="text-xs text-red-400 mb-1">{t('error')}:</p>
                      <pre className="p-2 rounded bg-red-500/10 text-xs font-mono text-red-400 overflow-auto">
                        {result.error}
                      </pre>
                    </div>
                  )}

                  {result.itemErrors && result.itemErrors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-red-400 mb-1">{t('itemErrors')}:</p>
                      <pre className="p-2 rounded bg-red-500/10 text-xs font-mono text-red-400 overflow-auto max-h-24">
                        {JSON.stringify(result.itemErrors, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}

            {nodeResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('noExecutionAvailable')}
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
