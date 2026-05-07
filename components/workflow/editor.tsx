'use client'

import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Activity, Boxes, History, KeyRound, Settings2, Bug } from 'lucide-react'
import { NodeLibrary } from './node-library'
import { WorkflowCanvas } from './canvas'
import { NodePanel } from './node-panel'
import { Toolbar } from './toolbar'
import { ExecutionPanel } from './execution-panel'
import { DebugControls } from './debug-controls'
import { ExecutionHistory } from './execution-history'
import { CredentialsPanel } from './credentials-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkflowStore } from '@/lib/workflow/store'
import { executeBackendWorkflow } from '@/lib/workflow/api-client'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useI18n } from '@/lib/i18n'

interface WorkflowEditorProps {
  workflowId: string
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const { t } = useI18n()
  const [isExecuting, setIsExecuting] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<'config' | 'credentials' | 'debug' | 'history'>('config')

  // Keyboard shortcuts (undo/redo, copy/paste, delete)
  const { canUndo, canRedo, undo, redo } = useKeyboardShortcuts()
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const startExecution = useWorkflowStore((s) => s.startExecution)
  const completeExecution = useWorkflowStore((s) => s.completeExecution)
  const recordExecution = useWorkflowStore((s) => s.recordExecution)
  const saveWorkflowToBackend = useWorkflowStore((s) => s.saveWorkflowToBackend)
  const loadExecutionsFromBackend = useWorkflowStore((s) => s.loadExecutionsFromBackend)

  // Set active workflow on mount and rehydrate store
  useEffect(() => {
    // Rehydrate zustand store on client
    useWorkflowStore.persist.rehydrate()
    setActiveWorkflow(workflowId)
    void loadExecutionsFromBackend(workflowId)
  }, [workflowId, setActiveWorkflow, loadExecutionsFromBackend])

  const handleExecute = useCallback(async () => {
    if (!workflow || isExecuting) return

    setIsExecuting(true)
    const executionId = startExecution(workflow.id)

    try {
      await saveWorkflowToBackend(workflow.id)
      const execution = await executeBackendWorkflow(workflow.id)
      recordExecution(execution)
    } catch (error) {
      completeExecution(executionId, 'error', (error as Error).message)
    } finally {
      setIsExecuting(false)
    }
  }, [workflow, isExecuting, startExecution, completeExecution, recordExecution, saveWorkflowToBackend])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[#f7f6f3] text-foreground dark:bg-[#111111]">
        <Toolbar
          onExecute={handleExecute}
          isExecuting={isExecuting}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          isLibraryOpen={isLibraryOpen}
          isInspectorOpen={isInspectorOpen}
          onToggleLibrary={() => setIsLibraryOpen((open) => !open)}
          onToggleInspector={() => setIsInspectorOpen((open) => !open)}
          onOpenMobileLibrary={() => setIsLibraryOpen((open) => !open)}
          onOpenMobileInspector={() => setIsInspectorOpen((open) => !open)}
          className="z-20"
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden border-t border-black/5 bg-[#efeee9] dark:border-white/5 dark:bg-[#151515]">
          <aside className="hidden w-[52px] shrink-0 flex-col items-center gap-2 border-r border-black/10 bg-[#262626] py-3 text-white shadow-sm dark:border-white/10 lg:flex">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-md bg-[#ff6d5a]">
              <Activity className="h-4 w-4" />
            </div>
            <button
              type="button"
              onClick={() => setIsLibraryOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white"
              data-active={isLibraryOpen}
              title={t('nodes')}
            >
              <Boxes className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsInspectorOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white"
              data-active={isInspectorOpen}
              title={t('config')}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </aside>

          {isLibraryOpen && (
            <div className="absolute inset-y-0 left-0 z-20 w-[min(86vw,300px)] shadow-2xl lg:static lg:z-auto lg:w-[292px] lg:shadow-none">
              <NodeLibrary className="min-h-0" />
            </div>
          )}

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <WorkflowCanvas className="workflow-canvas-shell" />
            <ExecutionPanel />
          </div>

          {isInspectorOpen && (
          <div className="absolute inset-y-0 right-0 z-20 flex w-[min(92vw,360px)] min-h-0 shrink-0 flex-col border-l border-black/10 bg-[#f6f7fb] shadow-2xl dark:border-white/10 dark:bg-[#171717] lg:static lg:z-auto lg:w-[348px] lg:shadow-none">
            <div className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#202020]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-600 shadow-sm">
                <Settings2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{t('nodeConfigurationTitle')}</h2>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t('nodeConfigurationSubtitle')}
                </p>
              </div>
            </div>
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex h-full min-h-0 flex-col">
                <TabsList className="grid h-13 w-full grid-cols-4 gap-1 rounded-none border-b border-black/10 bg-[#eef1f7] px-2 pt-2 dark:border-white/10 dark:bg-[#1d1d1d]">
                  <TabsTrigger
                    value="config"
                    className="h-10 min-w-0 gap-1 rounded-t-lg rounded-b-none border-b-2 border-transparent px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground data-[state=active]:border-blue-500 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:hover:bg-white/5 dark:data-[state=active]:bg-[#262626]"
                  >
                    <Settings2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t('parameters')}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="credentials"
                    className="h-10 min-w-0 gap-1 rounded-t-lg rounded-b-none border-b-2 border-transparent px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground data-[state=active]:border-blue-500 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:hover:bg-white/5 dark:data-[state=active]:bg-[#262626]"
                  >
                    <KeyRound className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t('credentials')}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="debug"
                    className="h-10 min-w-0 gap-1 rounded-t-lg rounded-b-none border-b-2 border-transparent px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground data-[state=active]:border-blue-500 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:hover:bg-white/5 dark:data-[state=active]:bg-[#262626]"
                  >
                    <Bug className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t('debug')}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="h-10 min-w-0 gap-1 rounded-t-lg rounded-b-none border-b-2 border-transparent px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground data-[state=active]:border-blue-500 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:hover:bg-white/5 dark:data-[state=active]:bg-[#262626]"
                  >
                    <History className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t('history')}</span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 overflow-hidden">
                <TabsContent value="config" className="h-full m-0 data-[state=inactive]:hidden">
                  <NodePanel className="h-full" />
                </TabsContent>
                <TabsContent value="credentials" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
                  <CredentialsPanel />
                </TabsContent>
                <TabsContent value="debug" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
                  <DebugControls />
                </TabsContent>
                <TabsContent value="history" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
                  <ExecutionHistory />
                </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
