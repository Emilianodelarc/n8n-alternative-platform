import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecutionResult, ExecutionStatus } from './types'
import { v4 as uuid } from 'uuid'

interface WorkflowState {
  // Workflows
  workflows: Workflow[]
  activeWorkflowId: string | null
  
  // Editor state
  selectedNodeId: string | null
  
  // Execution
  currentExecution: WorkflowExecution | null
  executionHistory: WorkflowExecution[]
  
  // Actions - Workflows
  createWorkflow: (name: string, description?: string) => string
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void
  deleteWorkflow: (id: string) => void
  duplicateWorkflow: (id: string) => string
  setActiveWorkflow: (id: string | null) => void
  
  // Actions - Nodes
  addNode: (node: Omit<WorkflowNode, 'id'>) => string
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode['data']>) => void
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void
  deleteNode: (nodeId: string) => void
  setSelectedNode: (nodeId: string | null) => void
  
  // Actions - Edges
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => void
  deleteEdge: (edgeId: string) => void
  
  // Actions - Execution
  startExecution: (workflowId: string) => string
  updateNodeExecution: (executionId: string, nodeId: string, result: Partial<NodeExecutionResult>) => void
  completeExecution: (executionId: string, status: ExecutionStatus, error?: string) => void
  clearExecutionHistory: () => void
  
  // Helpers
  getActiveWorkflow: () => Workflow | null
  getNode: (nodeId: string) => WorkflowNode | undefined
  importWorkflow: (workflow: Workflow) => void
  exportWorkflow: (id: string) => Workflow | null
}

// Example workflows for demo
const createExampleWorkflows = (): Workflow[] => [
  {
    id: 'example-1',
    name: 'Simple HTTP Request',
    description: 'Fetch data from an API and log it',
    nodes: [
      {
        id: 'node-1',
        type: 'manual-trigger',
        position: { x: 100, y: 200 },
        data: {
          label: 'Manual Trigger',
          category: 'trigger',
          config: {},
        },
      },
      {
        id: 'node-2',
        type: 'http-request',
        position: { x: 400, y: 200 },
        data: {
          label: 'HTTP Request',
          category: 'action',
          config: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/todos/1',
            headers: '{}',
            body: '',
          },
        },
      },
      {
        id: 'node-3',
        type: 'no-op',
        position: { x: 700, y: 200 },
        data: {
          label: 'Log Result',
          category: 'utility',
          config: {},
        },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
    ],
    variables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'example-2',
    name: 'Conditional Flow',
    description: 'Branch based on condition',
    nodes: [
      {
        id: 'node-1',
        type: 'manual-trigger',
        position: { x: 100, y: 200 },
        data: {
          label: 'Start',
          category: 'trigger',
          config: {},
        },
      },
      {
        id: 'node-2',
        type: 'set',
        position: { x: 350, y: 200 },
        data: {
          label: 'Set Value',
          category: 'transform',
          config: { assignments: '{"value": true}' },
        },
      },
      {
        id: 'node-3',
        type: 'if-else',
        position: { x: 600, y: 200 },
        data: {
          label: 'Check Value',
          category: 'logic',
          config: { condition: 'input.value === true' },
        },
      },
      {
        id: 'node-4',
        type: 'no-op',
        position: { x: 900, y: 100 },
        data: {
          label: 'True Path',
          category: 'utility',
          config: {},
        },
      },
      {
        id: 'node-5',
        type: 'no-op',
        position: { x: 900, y: 300 },
        data: {
          label: 'False Path',
          category: 'utility',
          config: {},
        },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
      { id: 'edge-3', source: 'node-3', sourceHandle: 'true', target: 'node-4' },
      { id: 'edge-4', source: 'node-3', sourceHandle: 'false', target: 'node-5' },
    ],
    variables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'example-3',
    name: 'Data Transformation',
    description: 'Transform and filter data',
    nodes: [
      {
        id: 'node-1',
        type: 'manual-trigger',
        position: { x: 100, y: 200 },
        data: {
          label: 'Start',
          category: 'trigger',
          config: {},
        },
      },
      {
        id: 'node-2',
        type: 'http-request',
        position: { x: 350, y: 200 },
        data: {
          label: 'Fetch Users',
          category: 'action',
          config: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users',
            headers: '{}',
            body: '',
          },
        },
      },
      {
        id: 'node-3',
        type: 'transform',
        position: { x: 600, y: 200 },
        data: {
          label: 'Extract Names',
          category: 'transform',
          config: { code: 'return input.map(user => ({ name: user.name, email: user.email }));' },
        },
      },
      {
        id: 'node-4',
        type: 'filter',
        position: { x: 850, y: 200 },
        data: {
          label: 'Filter',
          category: 'transform',
          config: { condition: 'item => item.name.length > 10' },
        },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
      { id: 'edge-3', source: 'node-3', target: 'node-4' },
    ],
    variables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // Initial state
      workflows: createExampleWorkflows(),
      activeWorkflowId: null,
      selectedNodeId: null,
      currentExecution: null,
      executionHistory: [],

      // Workflow actions
      createWorkflow: (name, description) => {
        const id = uuid()
        const workflow: Workflow = {
          id,
          name,
          description,
          nodes: [],
          edges: [],
          variables: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ workflows: [...state.workflows, workflow] }))
        return id
      },

      updateWorkflow: (id, updates) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
          ),
        }))
      },

      deleteWorkflow: (id) => {
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          activeWorkflowId: state.activeWorkflowId === id ? null : state.activeWorkflowId,
        }))
      },

      duplicateWorkflow: (id) => {
        const workflow = get().workflows.find((w) => w.id === id)
        if (!workflow) return ''
        const newId = uuid()
        const duplicate: Workflow = {
          ...workflow,
          id: newId,
          name: `${workflow.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ workflows: [...state.workflows, duplicate] }))
        return newId
      },

      setActiveWorkflow: (id) => {
        set({ activeWorkflowId: id, selectedNodeId: null })
      },

      // Node actions
      addNode: (node) => {
        const id = `node-${uuid()}`
        const newNode: WorkflowNode = { ...node, id }
        set((state) => {
          const workflow = state.workflows.find((w) => w.id === state.activeWorkflowId)
          if (!workflow) return state
          return {
            workflows: state.workflows.map((w) =>
              w.id === state.activeWorkflowId
                ? { ...w, nodes: [...w.nodes, newNode], updatedAt: new Date().toISOString() }
                : w
            ),
          }
        })
        return id
      },

      updateNode: (nodeId, updates) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? {
                  ...w,
                  nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
                  updatedAt: new Date().toISOString(),
                }
              : w
          ),
        }))
      },

      updateNodeData: (nodeId, data) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? {
                  ...w,
                  nodes: w.nodes.map((n) =>
                    n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : w
          ),
        }))
      },

      updateNodeConfig: (nodeId, config) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? {
                  ...w,
                  nodes: w.nodes.map((n) =>
                    n.id === nodeId
                      ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
                      : n
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : w
          ),
        }))
      },

      deleteNode: (nodeId) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? {
                  ...w,
                  nodes: w.nodes.filter((n) => n.id !== nodeId),
                  edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                  updatedAt: new Date().toISOString(),
                }
              : w
          ),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        }))
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNodeId: nodeId })
      },

      // Edge actions
      addEdge: (edge) => {
        const id = `edge-${uuid()}`
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? { ...w, edges: [...w.edges, { ...edge, id }], updatedAt: new Date().toISOString() }
              : w
          ),
        }))
      },

      deleteEdge: (edgeId) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === state.activeWorkflowId
              ? { ...w, edges: w.edges.filter((e) => e.id !== edgeId), updatedAt: new Date().toISOString() }
              : w
          ),
        }))
      },

      // Execution actions
      startExecution: (workflowId) => {
        const executionId = uuid()
        const execution: WorkflowExecution = {
          id: executionId,
          workflowId,
          status: 'running',
          startTime: new Date().toISOString(),
          nodeResults: {},
        }
        set({ currentExecution: execution })
        return executionId
      },

      updateNodeExecution: (executionId, nodeId, result) => {
        set((state) => {
          if (state.currentExecution?.id !== executionId) return state
          return {
            currentExecution: {
              ...state.currentExecution,
              nodeResults: {
                ...state.currentExecution.nodeResults,
                [nodeId]: {
                  ...state.currentExecution.nodeResults[nodeId],
                  ...result,
                } as NodeExecutionResult,
              },
            },
          }
        })
      },

      completeExecution: (executionId, status, error) => {
        set((state) => {
          if (state.currentExecution?.id !== executionId) return state
          const completed: WorkflowExecution = {
            ...state.currentExecution,
            status,
            error,
            endTime: new Date().toISOString(),
          }
          return {
            currentExecution: null,
            executionHistory: [completed, ...state.executionHistory].slice(0, 50),
          }
        })
      },

      clearExecutionHistory: () => {
        set({ executionHistory: [] })
      },

      // Helpers
      getActiveWorkflow: () => {
        const state = get()
        return state.workflows.find((w) => w.id === state.activeWorkflowId) || null
      },

      getNode: (nodeId) => {
        const workflow = get().getActiveWorkflow()
        return workflow?.nodes.find((n) => n.id === nodeId)
      },

      importWorkflow: (workflow) => {
        const newId = uuid()
        const imported: Workflow = {
          ...workflow,
          id: newId,
          name: `${workflow.name} (Imported)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ workflows: [...state.workflows, imported] }))
      },

      exportWorkflow: (id) => {
        return get().workflows.find((w) => w.id === id) || null
      },
    }),
    {
      name: 'workflow-storage',
      partialize: (state) => ({
        workflows: state.workflows,
        executionHistory: state.executionHistory,
      }),
    }
  )
)
