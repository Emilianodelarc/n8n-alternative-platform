'use client'

import { useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  MarkerType,
  type Node,
  type ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflowStore } from '@/lib/workflow/store'
import { NODE_TYPES, type NodeCategory } from '@/lib/workflow/types'
import { nodeTypes } from './nodes'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

type WorkflowFlowNode = Node<Record<string, unknown>>

const edgeStroke = '#2563eb'

interface WorkflowCanvasProps {
  className?: string
}

export function WorkflowCanvas({ className }: WorkflowCanvasProps) {
  const { t } = useI18n()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const addNode = useWorkflowStore((s) => s.addNode)
  const updateNode = useWorkflowStore((s) => s.updateNode)
  const deleteNode = useWorkflowStore((s) => s.deleteNode)
  const storeAddEdge = useWorkflowStore((s) => s.addEdge)
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Sync store changes to local state
  useEffect(() => {
    if (!workflow) {
      setNodes([])
      setEdges([])
      return
    }
    
    setNodes(
      workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: { ...node.data },
        selected: node.id === selectedNodeId,
      }))
    )
    
    setEdges(
      workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeStroke,
          width: 18,
          height: 18,
        },
        style: {
          stroke: edgeStroke,
          strokeWidth: 4,
          opacity: 1,
        },
      }))
    )
  }, [workflow, selectedNodeId, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        storeAddEdge({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
        })
      }
    },
    [storeAddEdge]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      nodesToDelete.forEach((node) => deleteNode(node.id))
    },
    [deleteNode]
  )

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => deleteEdge(edge.id))
    },
    [deleteEdge]
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNode(node.id, { position: node.position })
    },
    [updateNode]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const data = event.dataTransfer.getData('application/reactflow')
      if (!data || !reactFlowInstance.current || !reactFlowWrapper.current) return

      const { type, label, category } = JSON.parse(data) as { type: string; label: string; category: NodeCategory }
      const nodeTypeDef = NODE_TYPES[type]
      if (!nodeTypeDef) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      addNode({
        type,
        position,
        data: {
          label,
          category,
          config: { ...nodeTypeDef.defaultConfig },
        },
      })
    },
    [addNode]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  if (!workflow) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-background', className)}>
        <p className="text-muted-foreground">{t('noWorkflowSelected')}</p>
      </div>
    )
  }

  return (
    <div ref={reactFlowWrapper} className={cn('h-full w-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dot)"
        />
        <Controls
          className="!bg-card !border-border !rounded-lg !shadow-lg [&_button]:!bg-card [&_button]:!border-border [&_button]:!text-foreground [&_button:hover]:!bg-accent"
        />
        <MiniMap
          className="!bg-card !border-border !rounded-lg"
          nodeColor={(node) => {
            const category = (node.data as { category?: NodeCategory })?.category
            switch (category) {
              case 'trigger':
                return '#22c55e'
              case 'action':
                return '#3b82f6'
              case 'logic':
                return '#f59e0b'
              case 'transform':
                return '#8b5cf6'
              default:
                return '#6b7280'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
    </div>
  )
}
