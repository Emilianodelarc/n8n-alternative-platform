'use client'

import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { NodeLibrary } from './node-library'
import { WorkflowCanvas } from './canvas'
import { NodePanel } from './node-panel'
import { Toolbar } from './toolbar'
import { ExecutionPanel } from './execution-panel'
import { useWorkflowStore } from '@/lib/workflow/store'
import { executeWorkflow } from '@/lib/workflow/engine'
import { cn } from '@/lib/utils'

interface WorkflowEditorProps {
  workflowId: string
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const startExecution = useWorkflowStore((s) => s.startExecution)
  const updateNodeExecution = useWorkflowStore((s) => s.updateNodeExecution)
  const completeExecution = useWorkflowStore((s) => s.completeExecution)

  // Set active workflow on mount
  useState(() => {
    setActiveWorkflow(workflowId)
  })

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
        <Toolbar onExecute={handleExecute} isExecuting={isExecuting} />
        
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left sidebar - Node Library */}
          <NodeLibrary className="w-64 shrink-0" />
          
          {/* Main canvas */}
          <div className="flex-1 relative">
            <WorkflowCanvas />
            <ExecutionPanel />
          </div>
          
          {/* Right sidebar - Node Panel */}
          <div
            className={cn(
              'shrink-0 transition-all duration-200',
              selectedNodeId ? 'w-80' : 'w-0'
            )}
          >
            {selectedNodeId && <NodePanel className="w-80" />}
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  )
}
