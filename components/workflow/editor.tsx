'use client'

import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Bug, History, KeyRound, PanelLeft, PanelRight, Variable } from 'lucide-react'
import { NodeLibrary } from './node-library'
import { WorkflowCanvas } from './canvas'
import { NodePanel } from './node-panel'
import { Toolbar } from './toolbar'
import { ExecutionPanel } from './execution-panel'
import { VariablesPanel } from './variables-panel'
import { DebugControls } from './debug-controls'
import { ExecutionHistory } from './execution-history'
import { CredentialsPanel } from './credentials-panel'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
  const [rightPanelTab, setRightPanelTab] = useState<'config' | 'variables' | 'credentials' | 'debug' | 'history'>('config')
  const [isLibraryOpen, setIsLibraryOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false)
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)

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

  const inspector = (
    <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex h-full min-h-0 flex-col">
      <TabsList className="grid h-11 w-full shrink-0 grid-cols-5 rounded-none border-b bg-card p-0">
        <TabsTrigger value="config" className="h-11 rounded-none text-xs data-[state=active]:bg-background">
          {t('config')}
        </TabsTrigger>
        <TabsTrigger value="variables" className="h-11 rounded-none text-xs data-[state=active]:bg-background" title="Variables">
          <Variable className="h-3.5 w-3.5" />
        </TabsTrigger>
        <TabsTrigger value="credentials" className="h-11 rounded-none text-xs data-[state=active]:bg-background" title={t('credentials')}>
          <KeyRound className="h-3.5 w-3.5" />
        </TabsTrigger>
        <TabsTrigger value="debug" className="h-11 rounded-none text-xs data-[state=active]:bg-background" title="Debug">
          <Bug className="h-3.5 w-3.5" />
        </TabsTrigger>
        <TabsTrigger value="history" className="h-11 rounded-none text-xs data-[state=active]:bg-background" title="History">
          <History className="h-3.5 w-3.5" />
        </TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value="config" className="m-0 h-full data-[state=inactive]:hidden">
          {selectedNodeId ? (
            <NodePanel className="h-full border-l-0" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t('selectNode')}
            </div>
          )}
        </TabsContent>
        <TabsContent value="variables" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
          <VariablesPanel />
        </TabsContent>
        <TabsContent value="credentials" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
          <CredentialsPanel />
        </TabsContent>
        <TabsContent value="debug" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
          <DebugControls />
        </TabsContent>
        <TabsContent value="history" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
          <ExecutionHistory />
        </TabsContent>
      </div>
    </Tabs>
  )

  return (
    <ReactFlowProvider>
      <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-background">
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
          onOpenMobileLibrary={() => setIsMobileLibraryOpen(true)}
          onOpenMobileInspector={() => setIsMobileInspectorOpen(true)}
        />

        <div className="relative hidden min-h-0 flex-1 overflow-hidden lg:block">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {isLibraryOpen && (
              <>
                <ResizablePanel defaultSize={22} minSize={16} maxSize={32} className="min-w-[220px]">
                  <NodeLibrary className="min-h-0" />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}
            <ResizablePanel defaultSize={isLibraryOpen && isInspectorOpen ? 50 : 72} minSize={36}>
              <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
                <WorkflowCanvas />
                <ExecutionPanel />
                {!isLibraryOpen && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-4 z-10 h-9 w-9 shadow-sm"
                    onClick={() => setIsLibraryOpen(true)}
                    title={t('nodes')}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}
                {!isInspectorOpen && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-4 z-10 h-9 w-9 shadow-sm"
                    onClick={() => setIsInspectorOpen(true)}
                    title={t('config')}
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </ResizablePanel>
            {isInspectorOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={28} minSize={22} maxSize={40} className="min-w-[300px]">
                  <div className="flex h-full min-h-0 flex-col border-l border-border bg-card">
                    {inspector}
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden lg:hidden">
          <WorkflowCanvas />
          <ExecutionPanel />
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-md border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            <Button variant="ghost" size="sm" onClick={() => setIsMobileLibraryOpen(true)}>
              <PanelLeft className="mr-2 h-4 w-4" />
              {t('nodes')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsMobileInspectorOpen(true)}>
              <PanelRight className="mr-2 h-4 w-4" />
              {t('config')}
            </Button>
          </div>
        </div>

        <Sheet open={isMobileLibraryOpen} onOpenChange={setIsMobileLibraryOpen}>
          <SheetContent side="left" className="w-[86vw] max-w-sm p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('nodes')}</SheetTitle>
            </SheetHeader>
            <NodeLibrary />
          </SheetContent>
        </Sheet>

        <Sheet open={isMobileInspectorOpen} onOpenChange={setIsMobileInspectorOpen}>
          <SheetContent side="right" className="w-[92vw] max-w-md p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('config')}</SheetTitle>
            </SheetHeader>
            {inspector}
          </SheetContent>
        </Sheet>
      </div>
    </ReactFlowProvider>
  )
}
