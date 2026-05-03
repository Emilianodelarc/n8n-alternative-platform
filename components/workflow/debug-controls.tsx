'use client'

import { Bug, Play, Pause, SkipForward, StopCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useWorkflowStore } from '@/lib/workflow/store'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

export function DebugControls() {
  const { t, tt } = useI18n()
  const debugMode = useWorkflowStore((s) => s.debugMode)
  const setDebugMode = useWorkflowStore((s) => s.setDebugMode)
  const debugBreakpoints = useWorkflowStore((s) => s.debugBreakpoints)
  const debugPausedAtNode = useWorkflowStore((s) => s.debugPausedAtNode)
  const continueDebug = useWorkflowStore((s) => s.continueDebug)
  const stepDebug = useWorkflowStore((s) => s.stepDebug)
  const currentExecution = useWorkflowStore((s) => s.currentExecution)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())

  const isPaused = debugPausedAtNode !== null
  const isRunning = currentExecution !== null

  const pausedNode = debugPausedAtNode 
    ? workflow?.nodes.find(n => n.id === debugPausedAtNode)
    : null

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t('debugMode')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="debug-mode"
            checked={debugMode}
            onCheckedChange={setDebugMode}
          />
          <Label htmlFor="debug-mode" className="text-sm">
            {debugMode ? t('on') : t('off')}
          </Label>
        </div>
      </div>

      {debugMode && (
        <>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-200">
              {t('debugDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('breakpoints')} ({debugBreakpoints.size})</Label>
            {debugBreakpoints.size === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noBreakpoints')}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {Array.from(debugBreakpoints).map((nodeId) => {
                  const node = workflow?.nodes.find(n => n.id === nodeId)
                  return (
                    <Badge key={nodeId} variant="outline" className="text-xs">
                      <Circle className="w-2 h-2 mr-1 fill-red-500 text-red-500" />
                      {node?.data.label ? tt(node.data.label) : nodeId.slice(0, 8)}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>

          {isPaused && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <Pause className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-200">
                  {t('pausedAt')}: {pausedNode?.data.label ? tt(pausedNode.data.label) : t('unknown')}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={continueDebug}
                  className="flex-1"
                >
                  <Play className="w-3 h-3 mr-1" />
                  {t('continue')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stepDebug}
                  className="flex-1"
                >
                  <SkipForward className="w-3 h-3 mr-1" />
                  {t('step')}
                </Button>
              </div>
            </div>
          )}

          {isRunning && !isPaused && (
            <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-200">{t('executing')}</span>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p className="font-medium">{t('keyboardShortcuts')}</p>
        <div className="grid grid-cols-2 gap-1">
          <span>F9</span><span>{t('toggleBreakpoint')}</span>
          <span>F5</span><span>{t('continue')}</span>
          <span>F10</span><span>{t('stepOver')}</span>
        </div>
      </div>
    </div>
  )
}
