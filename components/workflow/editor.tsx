'use client'

import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Variable, History, Bug, Undo2, Redo2 } from 'lucide-react'
import { NodeLibrary } from './node-library'
import { WorkflowCanvas } from './canvas'
import { NodePanel } from './node-panel'
import { Toolbar } from './toolbar'
import { ExecutionPanel } from './execution-panel'
import { VariablesPanel } from './variables-panel'
import { DebugControls } from './debug-controls'
import { ExecutionHistory } from './execution-history'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkflowStore } from '@/lib/workflow/store'
import { executeWorkflow } from '@/lib/workflow/engine'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

interface WorkflowEditorProps {
  workflowId: string
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const { t } = useI18n()
  const [isExecuting, setIsExecuting] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'config' | 'variables' | 'debug' | 'history'>('config')
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  
  // Keyboard shortcuts (undo/redo, copy/paste, delete)
  const { canUndo, canRedo, undo, redo } = useKeyboardShortcuts()
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const startExecution = useWorkflowStore((s) => s.startExecution)
  const updateNodeExecution = useWorkflowStore((s) => s.updateNodeExecution)
  const completeExecution = useWorkflowStore((s) => s.completeExecution)

  // Set active workflow on mount and rehydrate store
  useEffect(() => {
    // Rehydrate zustand store on client
    useWorkflowStore.persist.rehydrate()
    setActiveWorkflow(workflowId)
  }, [workflowId, setActiveWorkflow])

  const handleExecute = useCallback(async () => {
    if (!workflow || isExecuting) return

    setIsExecuting(true)
    const executionId = startExecution(workflow.id)

    try {
      await executeWorkflow(workflow, {
        onNodeStart: (nodeId) => {
          updateNodeExecution(executionId, nodeId, {
            nodeId,
            status: 'running',
            input: null,
            output: null,
            startTime: new Date().toISOString(),
          })
        },
        onNodeComplete: (nodeId, result) => {
          updateNodeExecution(executionId, nodeId, {
            status: 'success',
            output: result.output,
            endTime: new Date().toISOString(),
            duration: result.duration,
          })
        },
        onNodeError: (nodeId, error) => {
          updateNodeExecution(executionId, nodeId, {
            status: 'error',
            error: error.message,
            endTime: new Date().toISOString(),
          })
        },
      })
      completeExecution(executionId, 'success')
    } catch (error) {
      completeExecution(executionId, 'error', (error as Error).message)
    } finally {
      setIsExecuting(false)
    }
  }, [workflow, isExecuting, startExecution, updateNodeExecution, completeExecution])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-background">
        <Toolbar 
          onExecute={handleExecute} 
          isExecuting={isExecuting}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
        
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Left sidebar - Node Library */}
          <NodeLibrary className="w-64 min-h-0 shrink-0" />
          
          {/* Main canvas */}
          <div className="flex-1 min-w-0 min-h-0 relative">
            <WorkflowCanvas />
            <ExecutionPanel />
          </div>
          
          {/* Right sidebar - Panel with tabs */}
          <div className="w-80 min-h-0 shrink-0 border-l border-border bg-card flex flex-col">
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex flex-col h-full min-h-0">
              <TabsList className="grid w-full grid-cols-4 rounded-none border-b h-10">
                <TabsTrigger value="config" className="text-xs rounded-none data-[state=active]:bg-background">
                  {t('config')}
                </TabsTrigger>
                <TabsTrigger value="variables" className="text-xs rounded-none data-[state=active]:bg-background">
                  <Variable className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="debug" className="text-xs rounded-none data-[state=active]:bg-background">
                  <Bug className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs rounded-none data-[state=active]:bg-background">
                  <History className="w-3 h-3" />
                </TabsTrigger>
              </TabsList>
              <div className="flex-1 min-h-0 overflow-hidden">
                <TabsContent value="config" className="h-full m-0 data-[state=inactive]:hidden">
                  {selectedNodeId ? (
                    <NodePanel className="h-full" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {t('selectNode')}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="variables" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
                  <VariablesPanel />
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
        </div>
      </div>
    </ReactFlowProvider>
  )
}
