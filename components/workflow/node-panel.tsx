'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/workflow/store'
import { NODE_TYPES, type ConfigField, type NodeCategory, type Workflow, type WorkflowExecution, type WorkflowNode } from '@/lib/workflow/types'
import { executeNode } from '@/lib/workflow-engine'
import { fetchBackendCredentials, type CredentialSummary } from '@/lib/workflow/api-client'
import { useI18n } from '@/lib/i18n'
import { X, Trash2, Settings, Play, Code, Info, Copy, Check, AlertCircle, KeyRound, ClipboardList, ArrowRight, Loader2 } from 'lucide-react'

const categoryStyles: Record<NodeCategory, { bg: string; text: string; border: string }> = {
  trigger: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  action: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  logic: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  transform: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  utility: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
}

const connectionFields: ConfigField[] = [
  {
    key: 'credentialType',
    label: 'Credential Type',
    type: 'select',
    defaultValue: 'none',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Bearer Token / OAuth Access Token', value: 'bearerToken' },
      { label: 'API Key Header', value: 'apiKeyHeader' },
      { label: 'Basic Auth', value: 'basicAuth' },
      { label: 'Raw Headers JSON', value: 'rawHeaders' },
    ],
  },
  { key: 'credentialName', label: 'Credential Name', type: 'text', placeholder: 'Production Google OAuth' },
  { key: 'accessToken', label: 'Bearer / OAuth Access Token', type: 'password', placeholder: 'ya29... or sk_...' },
  { key: 'apiKeyName', label: 'API Key Header Name', type: 'text', placeholder: 'Authorization or x-api-key' },
  { key: 'apiKeyValue', label: 'API Key Header Value', type: 'password', placeholder: 'secret value' },
  { key: 'basicUsername', label: 'Basic Auth Username', type: 'text' },
  { key: 'basicPassword', label: 'Basic Auth Password', type: 'password' },
  { key: 'credentialHeaders', label: 'Additional Headers (JSON)', type: 'json', placeholder: '{"X-Custom":"value"}' },
]

const connectionFieldKeys = new Set(connectionFields.map((field) => field.key))

const connectionNodeTypes = new Set([
  'http-request',
  'slack-message',
  'discord',
  'telegram',
  'whatsapp',
  'airtable',
  'notion',
  'github',
  'stripe',
  'openai',
  'anthropic',
  'postgres-query',
  'mysql',
  'mongodb',
  'redis',
])

function fieldIsVisible(field: ConfigField, config: Record<string, unknown>) {
  if (!field.visibleWhen) return true

  return Object.entries(field.visibleWhen).every(([dependencyKey, expected]) => {
    const currentValue = config[dependencyKey]
    if (Array.isArray(expected)) return expected.includes(currentValue)
    return currentValue === expected
  })
}

function configValue(config: Record<string, unknown>, key: string, fallback: unknown) {
  return config[key] ?? fallback
}

function fieldMatchesNodeMode(nodeType: string, field: ConfigField, config: Record<string, unknown>) {
  const key = field.key

  if (key === 'credentialType') return true
  if (key === 'credentialName') return configValue(config, 'credentialType', 'none') !== 'none'
  if (key === 'accessToken') return configValue(config, 'credentialType', 'none') === 'bearerToken'
  if (key === 'apiKeyName' || key === 'apiKeyValue') return configValue(config, 'credentialType', 'none') === 'apiKeyHeader'
  if (key === 'basicUsername' || key === 'basicPassword') return configValue(config, 'credentialType', 'none') === 'basicAuth'
  if (key === 'credentialHeaders') return configValue(config, 'credentialType', 'none') === 'rawHeaders'

  switch (nodeType) {
    case 'schedule-trigger': {
      const triggerType = configValue(config, 'triggerType', 'interval')
      if (key === 'interval') return triggerType === 'interval'
      if (key === 'cronExpression') return triggerType === 'cron'
      return true
    }

    case 'webhook-trigger':
      if (key === 'responseCode' || key === 'responseData') {
        return configValue(config, 'responseMode', 'onReceived') !== 'responseNode'
      }
      return true

    case 'http-request': {
      if (key === 'credentialId') return configValue(config, 'authentication', 'none') === 'predefinedCredential'
      if (key === 'queryParameters') return configValue(config, 'sendQuery', false) === true
      if (key === 'headers') return configValue(config, 'sendHeaders', true) === true
      if (key === 'bodyContentType' || key === 'body') return configValue(config, 'sendBody', false) === true
      return true
    }

    case 'if-else': {
      const mode = configValue(config, 'mode', 'conditions')
      if (key === 'combinator' || key === 'conditions') return mode === 'conditions'
      if (key === 'condition') return mode === 'expression'
      return true
    }

    case 'switch': {
      const mode = configValue(config, 'mode', 'rules')
      if (key === 'rules') return mode === 'rules'
      if (key === 'expression' || key === 'cases') return mode === 'expression'
      return true
    }

    case 'router': {
      const mode = configValue(config, 'mode', 'rules')
      if (key === 'rules') return mode === 'rules'
      if (key === 'routeField') return mode === 'field'
      return true
    }

    case 'transform': {
      const operation = configValue(config, 'operation', 'sort')
      if (key === 'field' || key === 'order') return operation === 'sort'
      if (key === 'limit') return operation === 'limit'
      if (key === 'aggregateFields') return operation === 'aggregate'
      if (key === 'code') return operation === 'customCode'
      return true
    }

    case 'delay': {
      const mode = configValue(config, 'mode', 'timeInterval')
      if (key === 'seconds') return mode === 'timeInterval'
      if (key === 'resumeAt') return mode === 'specificTime'
      if (key === 'webhookSuffix') return mode === 'webhook'
      return true
    }

    default:
      return true
  }
}

interface NodeGuide {
  purpose: string
  configure: string[]
  data: string[]
  nextStep: string
}

const nodeGuides: Record<string, NodeGuide> = {
  'webhook-trigger': {
    purpose: 'Receives data from an external form, app, or test payload and starts the workflow.',
    configure: [
      'Set the HTTP method and path that identify this webhook.',
      'Use Example Payload to paste the JSON you expect to receive, so the next nodes are easier to configure.',
      'For a welcome email, include user.email and user.name in the payload.',
    ],
    data: ['The next node receives the webhook output as input.data.', 'Example: {{input.data.user.email}} reads the email from the sample payload.'],
    nextStep: 'Connect this trigger to an action node, then use fields from input.data in that action.',
  },
  'send-email': {
    purpose: 'Builds an email from the incoming data and sends it through a real email provider when credentials are available.',
    configure: [
      'Set From Email to the sender address you want recipients to see.',
      'Set To to a fixed email or to a value from the previous node, for example {{input.data.user.email}}.',
      'Write the Subject and Body. HTML format lets you use tags like <p> and <strong>.',
      'Leave Attachments as [] unless another node provides files.',
    ],
    data: ['Use {{input.data.user.name}} for the user name in the welcome template.', 'Use {{input.data.user.email}} for the recipient address.'],
    nextStep: 'Before running in production, connect real email credentials or an email API backend for this node.',
  },
  delay: {
    purpose: 'Waits before continuing to the next node.',
    configure: ['For a simple pause, keep Resume as After Time Interval and set Seconds.', 'One day is 86400 seconds.'],
    data: ['The data passes through unchanged after the wait.'],
    nextStep: 'Connect it before the follow-up action that should happen later.',
  },
  'http-request': {
    purpose: 'Calls an external API and passes the response to the next node.',
    configure: ['Choose the HTTP method, paste the URL, then enable query parameters, headers, or body only when the API needs them.', 'Add credentials in Connection if the API is private.'],
    data: ['The response is available to the next node as input.data.'],
    nextStep: 'Run once, inspect Output, then map the returned fields in the next node.',
  },
  code: {
    purpose: 'Runs JavaScript to reshape or calculate data.',
    configure: ['Read the incoming data from input.', 'Return the exact object or array the next node should receive.'],
    data: ['Example: return { email: input.data.user.email, name: input.data.user.name };'],
    nextStep: 'Run the workflow and check Output to confirm the returned shape.',
  },
  set: {
    purpose: 'Creates or updates fields without writing JavaScript.',
    configure: ['Add fields in Fields to Set as JSON.', 'Keep Include Other Input Fields enabled when you want to preserve the original data.'],
    data: ['Example: {"fullName":"{{input.firstName}} {{input.lastName}}"}'],
    nextStep: 'Use this before actions that need clean field names.',
  },
  'google-sheets': {
    purpose: 'Reads spreadsheets/files from Google or writes rows and ranges into Google Sheets.',
    configure: [
      'Choose the Operation first. The panel only shows the fields required for that specific action.',
      'Use Read Sheet / File when you want to inspect a Google Sheet, CSV, or XLSX from a link or from incoming input.',
      'Use Create Spreadsheet for a brand-new document, Create Sheet Tab for a new tab inside an existing spreadsheet, and Add Row(s) when you want to append tabular data.',
    ],
    data: [
      'For Add Row(s), use Columns / Mapping when the previous node returns objects, or Values when you already have a 2D array.',
      'For Read Sheet / File, the output can include rows/records for CSV and workbook data for XLSX files.',
    ],
    nextStep: 'Pick the operation, fill only the fields now shown, run once, and inspect Output to confirm the resulting JSON shape.',
  },
}

const categoryGuides: Record<NodeCategory, NodeGuide> = {
  trigger: {
    purpose: 'Starts the workflow and creates the first data object.',
    configure: ['Configure when or how the workflow should start.', 'Add test data when the node supports it.'],
    data: ['Trigger nodes do not need an input node.'],
    nextStep: 'Connect it to the first action or transform node.',
  },
  action: {
    purpose: 'Does work in an external service or creates a side effect.',
    configure: ['Fill required fields first.', 'Use values from the previous node with template expressions when needed.'],
    data: ['Incoming data is available as input in code fields and template examples.'],
    nextStep: 'Run the previous nodes, inspect Output, then map the fields you need.',
  },
  logic: {
    purpose: 'Chooses which path the workflow should follow.',
    configure: ['Define the condition, expression, or route rules.', 'Connect each output handle to the node that should run for that path.'],
    data: ['Logic nodes usually pass the original input down the matching path.'],
    nextStep: 'Use the output labels on the canvas to wire each branch.',
  },
  transform: {
    purpose: 'Changes the shape of the incoming data before another node uses it.',
    configure: ['Choose the operation and define the fields, mapping, or code.', 'Keep the output small and explicit when the next node only needs a few fields.'],
    data: ['The next node receives this transformed result as input.'],
    nextStep: 'Check Output after running to verify the new data shape.',
  },
  utility: {
    purpose: 'Controls workflow behavior without usually changing the data.',
    configure: ['Set the control option this utility needs.', 'Most utility nodes pass data through unchanged.'],
    data: ['The next node normally receives the same input.'],
    nextStep: 'Place it between the nodes whose timing or behavior you want to control.',
  },
}

interface NodePanelProps {
  className?: string
}

interface ExpressionSuggestion {
  label: string
  expression: string
  value?: unknown
}

interface ManualNodeRun {
  status: 'idle' | 'running' | 'success' | 'error'
  input: unknown
  output?: unknown
  error?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

const hiddenMapperPaths = new Set([
  'input.triggered',
  'input.method',
  'input.path',
  'input.responseMode',
  'input.timestamp',
])

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function summarizeValue(value: unknown) {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function maskSensitiveNodeData(value: unknown, key = ''): unknown {
  if (/password|secret|token|apiKeyValue|accessToken/i.test(key)) {
    return value ? '••••••••' : value
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveNodeData(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([itemKey, itemValue]) => [
        itemKey,
        maskSensitiveNodeData(itemValue, itemKey),
      ])
    )
  }

  return value
}

function formatNodeData(value: unknown) {
  try {
    return JSON.stringify(maskSensitiveNodeData(value), null, 2)
  } catch {
    return '{}'
  }
}

function getConfigDefaults(nodeType: { defaultConfig: Record<string, unknown>; configSchema: ConfigField[] }) {
  return nodeType.configSchema.reduce(
    (defaults, field) => {
      if (field.defaultValue !== undefined && defaults[field.key] === undefined) {
        defaults[field.key] = field.defaultValue
      }
      return defaults
    },
    { ...nodeType.defaultConfig } as Record<string, unknown>
  )
}

function mergeConfigDefaults(
  nodeType: { defaultConfig: Record<string, unknown>; configSchema: ConfigField[] },
  config: Record<string, unknown> | undefined
) {
  return {
    ...getConfigDefaults(nodeType),
    ...(config || {}),
  }
}

function configHasMissingDefaults(
  nodeType: { defaultConfig: Record<string, unknown>; configSchema: ConfigField[] },
  config: Record<string, unknown> | undefined
) {
  const defaults = getConfigDefaults(nodeType)
  return Object.keys(defaults).some((key) => config?.[key] === undefined)
}

function collectExpressionPaths(value: unknown, prefix: string, depth = 0): ExpressionSuggestion[] {
  if (depth > 3 || value === null || value === undefined) return []
  if (hiddenMapperPaths.has(prefix)) return []

  if (Array.isArray(value)) {
    const first = value[0]
    return collectExpressionPaths(first, `${prefix}.0`, depth + 1)
  }

  if (typeof value !== 'object') {
    if (typeof value === 'boolean') return []
    return [{ label: prefix, expression: `{{${prefix}}}`, value }]
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
    collectExpressionPaths(item, `${prefix}.${key}`, depth + 1)
  )
}

function getExampleOutputForNode(node: WorkflowNode) {
  const config = node.data.config || {}

  if (node.type === 'webhook-trigger') {
    return {
      method: config.method || 'POST',
      path: config.path || '',
      responseMode: config.responseMode || 'immediate',
      data: parseJson(config.samplePayload, {}),
    }
  }

  if (node.type === 'manual-trigger') {
    return {
      triggered: true,
      data: parseJson(config.outputData, {}),
    }
  }

  return null
}

function getManualInputForNode(
  node: WorkflowNode,
  workflow: Workflow | null,
  currentExecution: WorkflowExecution | null,
  lastExecution?: WorkflowExecution
) {
  if (!workflow) return undefined

  const incomingEdges = workflow.edges.filter((edge) => edge.target === node.id)
  if (incomingEdges.length === 0) return undefined

  const inputEntries = incomingEdges.map((edge) => {
    const sourceNode = workflow.nodes.find((item) => item.id === edge.source)
    const sourceOutput =
      currentExecution?.nodeResults[edge.source]?.output ??
      lastExecution?.nodeResults[edge.source]?.output ??
      (sourceNode ? getExampleOutputForNode(sourceNode) : undefined)
    const input =
      edge.sourceHandle && sourceOutput && typeof sourceOutput === 'object'
        ? (sourceOutput as Record<string, unknown>)[edge.sourceHandle] ?? sourceOutput
        : sourceOutput
    return { edge, input }
  })

  if (inputEntries.length === 1) return inputEntries[0].input

  return Object.fromEntries(
    inputEntries.map(({ edge, input }) => [edge.sourceHandle || edge.source, input])
  )
}

function autoScrollConfigPanel(clientY: number, scrollContainer: HTMLDivElement) {
  const rect = scrollContainer.getBoundingClientRect()
  const edgeSize = 110
  const maxSpeed = 22
  const distanceToTop = clientY - rect.top
  const distanceToBottom = rect.bottom - clientY

  if (distanceToTop < edgeSize) {
    scrollContainer.scrollTop -= Math.ceil(((edgeSize - distanceToTop) / edgeSize) * maxSpeed)
  } else if (distanceToBottom < edgeSize) {
    scrollContainer.scrollTop += Math.ceil(((edgeSize - distanceToBottom) / edgeSize) * maxSpeed)
  }
}

export function NodePanel({ className }: NodePanelProps) {
  const { t, tt, locale } = useI18n()
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const getNode = useWorkflowStore((s) => s.getNode)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig)
  const deleteNode = useWorkflowStore((s) => s.deleteNode)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const currentExecution = useWorkflowStore((s) => s.currentExecution)
  const executionHistory = useWorkflowStore((s) => s.executionHistory)
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())

  const node = selectedNodeId ? getNode(selectedNodeId) : null
  const nodeType = node ? NODE_TYPES[node.type] : null
  const nodeResult = selectedNodeId ? currentExecution?.nodeResults[selectedNodeId] : null

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({})
  const [copied, setCopied] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isDraggingExpression, setIsDraggingExpression] = useState(false)
  const [dragTargetField, setDragTargetField] = useState<string | null>(null)
  const [manualRun, setManualRun] = useState<ManualNodeRun>({ status: 'idle', input: undefined })
  const [credentials, setCredentials] = useState<CredentialSummary[]>([])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const configScrollRef = useRef<HTMLDivElement | null>(null)
  const googleCredential = credentials.find((credential) => credential.service === 'google')
  const googleAccountEmail =
    googleCredential &&
    String(
      googleCredential.config.email ||
      googleCredential.config.accountEmail ||
      googleCredential.config.userEmail ||
      googleCredential.name
    )

  useEffect(() => {
    if (!node || !nodeType) return

    const nextConfig = mergeConfigDefaults(nodeType, node.data.config)
    setLocalConfig(nextConfig)
    setValidationErrors({})
    setManualRun({ status: 'idle', input: getManualInputForNode(node, workflow, currentExecution, executionHistory[0]) })

    if (configHasMissingDefaults(nodeType, node.data.config)) {
      updateNodeData(node.id, { config: nextConfig })
    }
  }, [node, nodeType, updateNodeData, workflow, currentExecution, executionHistory])

  useEffect(() => {
    if (node?.type !== 'google-sheets') return

    let isMounted = true
    setIsLoadingCredentials(true)
    fetchBackendCredentials()
      .then((items) => {
        if (!isMounted) return
        setCredentials(items)
        if (items.some((credential) => credential.service === 'google') && !node.data.config?.credentialId) {
          updateNodeConfig(node.id, { credentialId: 'service:google' })
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsLoadingCredentials(false)
      })

    return () => {
      isMounted = false
    }
  }, [node, updateNodeConfig])

  const validateField = useCallback((field: ConfigField, value: unknown): string | null => {
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${tt(field.label)} ${t('isRequired')}`
    }
    if (field.type === 'json' && value) {
      try {
        JSON.parse(value as string)
      } catch {
        return t('invalidJson')
      }
    }
    if (field.type === 'number' && value !== undefined && value !== '') {
      if (isNaN(Number(value))) {
        return t('mustBeNumber')
      }
    }
    return null
  }, [t, tt])

  const handleConfigChange = useCallback((key: string, value: unknown, field?: ConfigField) => {
    setLocalConfig((currentConfig) => ({ ...currentConfig, [key]: value }))
    
    if (field) {
      const error = validateField(field, value)
      setValidationErrors(prev => {
        if (error) {
          return { ...prev, [key]: error }
        }
        const { [key]: _, ...rest } = prev
        return rest
      })
    }
    
    updateNodeConfig(selectedNodeId!, { [key]: value })
  }, [selectedNodeId, updateNodeConfig, validateField])

  const insertExpressionIntoField = useCallback((
    field: ConfigField,
    target: HTMLInputElement | HTMLTextAreaElement,
    expression: string
  ) => {
    const currentValue = String(localConfig[field.key] ?? field.defaultValue ?? '')
    const selectionStart = target.selectionStart ?? currentValue.length
    const selectionEnd = target.selectionEnd ?? selectionStart
    const nextValue = `${currentValue.slice(0, selectionStart)}${expression}${currentValue.slice(selectionEnd)}`
    handleConfigChange(field.key, nextValue, field)

    requestAnimationFrame(() => {
      const cursor = selectionStart + expression.length
      target.focus()
      target.setSelectionRange(cursor, cursor)
    })
  }, [handleConfigChange, localConfig])

  const handleExpressionDrop = useCallback((
    event: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: ConfigField
  ) => {
    const expression = event.dataTransfer.getData('text/plain')
    if (!expression.includes('{{')) return

    event.preventDefault()
    setDragTargetField(null)
    insertExpressionIntoField(field, event.currentTarget, expression)
  }, [insertExpressionIntoField])

  const handleExpressionDragOver = useCallback((
    event: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: ConfigField
  ) => {
    if (!event.dataTransfer.types.includes('text/plain')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragTargetField(field.key)

    const scrollContainer = configScrollRef.current
    if (scrollContainer) {
      autoScrollConfigPanel(event.clientY, scrollContainer)
    }
  }, [])

  const handleConfigDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggingExpression) return
    event.preventDefault()
    if (configScrollRef.current) autoScrollConfigPanel(event.clientY, configScrollRef.current)
  }, [isDraggingExpression])

  const clearDragTarget = useCallback(() => {
    setDragTargetField(null)
  }, [])

  const droppableFieldClass = (field: ConfigField, hasError: boolean) =>
    cn(
      'transition-colors',
      hasError && 'border-destructive',
      isDraggingExpression && !hasError && 'border-violet-500/50',
      dragTargetField === field.key && 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/30'
    )

  const dropHint = (field: ConfigField) =>
    dragTargetField === field.key ? (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-violet-500 bg-violet-500/15 text-xs font-medium text-violet-700 backdrop-blur-[1px] dark:text-violet-200">
        Soltar variable aqui
      </div>
    ) : null

  const handleLabelChange = useCallback((label: string) => {
    updateNodeData(selectedNodeId!, { label })
  }, [selectedNodeId, updateNodeData])

  const handleDelete = useCallback(() => {
    deleteNode(selectedNodeId!)
  }, [selectedNodeId, deleteNode])

  const handleClose = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const handleCopyOutput = useCallback(() => {
    if (nodeResult?.output) {
      navigator.clipboard.writeText(JSON.stringify(nodeResult.output, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [nodeResult?.output])

  const handleManualNodeRun = useCallback(async () => {
    if (!node || !workflow) return

    const input = getManualInputForNode(node, workflow, currentExecution, executionHistory[0])
    const startedAt = new Date().toISOString()
    setManualRun({ status: 'running', input, startedAt })

    try {
      const output = await executeNode(node, input, {
        workflow,
        nodes: workflow.nodes,
        edges: workflow.edges,
        outputs: new Map(),
        itemOutputs: new Map(),
      })
      const finishedAt = new Date().toISOString()
      setManualRun({
        status: 'success',
        input,
        output,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      })
    } catch (error) {
      const finishedAt = new Date().toISOString()
      setManualRun({
        status: 'error',
        input,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      })
    }
  }, [currentExecution, executionHistory, node, workflow])

  const handleConnectGoogle = useCallback(() => {
    window.location.href = `/api/oauth/google/start?next=${encodeURIComponent(window.location.pathname)}`
  }, [])

  if (!node || !nodeType) {
    return (
      <aside className={cn('node-config-panel', className)}>
        <div className="node-empty-state">
          <div className="node-empty-icon">
            <Settings className="h-9 w-9" />
          </div>
          <h3>{t('selectNodeTitle')}</h3>
          <p>{t('selectNodeDescription')}</p>
          <div className="node-empty-tip">
            {t('emptyNodeTip')}
          </div>
        </div>
      </aside>
    )
  }

  const styles = categoryStyles[nodeType.category]
  const categoryLabel =
    nodeType.category === 'trigger' ? t('triggers') :
    nodeType.category === 'action' ? t('actions') :
    nodeType.category === 'logic' ? t('logic') :
    nodeType.category === 'transform' ? t('transform') :
    t('utility')

  const renderConfigField = (field: ConfigField) => {
    const value = localConfig[field.key] ?? field.defaultValue ?? ''
    const error = validationErrors[field.key]
    const placeholder = field.placeholder ? tt(field.placeholder) : undefined

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <div className="space-y-1">
            <div className="relative">
              <Input
                id={field.key}
                type={field.type === 'password' ? 'password' : 'text'}
                value={value as string}
                onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
                onDragOver={(e) => handleExpressionDragOver(e, field)}
                onDragLeave={clearDragTarget}
                onDrop={(e) => handleExpressionDrop(e, field)}
                placeholder={placeholder}
                className={cn('border-border bg-input', droppableFieldClass(field, Boolean(error)))}
              />
              {dropHint(field)}
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div className="space-y-1">
            <div className="relative">
              <Textarea
                id={field.key}
                value={value as string}
                onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
                onDragOver={(e) => handleExpressionDragOver(e, field)}
                onDragLeave={clearDragTarget}
                onDrop={(e) => handleExpressionDrop(e, field)}
                placeholder={placeholder}
                className={cn('min-h-[80px] resize-y border-border bg-input', droppableFieldClass(field, Boolean(error)))}
              />
              {dropHint(field)}
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        )

      case 'json':
        return (
          <div className="space-y-1">
            <div className="relative">
              <Textarea
                id={field.key}
                value={value as string}
                onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
                onDragOver={(e) => handleExpressionDragOver(e, field)}
                onDragLeave={clearDragTarget}
                onDrop={(e) => handleExpressionDrop(e, field)}
                placeholder={placeholder}
                className={cn(
                  'min-h-[100px] resize-y border-border bg-input font-mono text-sm',
                  droppableFieldClass(field, Boolean(error))
                )}
              />
              {dropHint(field)}
              <Badge variant="outline" className="absolute top-2 right-2 text-[10px] opacity-60">
                JSON
              </Badge>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        )

      case 'code':
        const defaultCode =
          '// Access input data via `input`\n// Return your result\nreturn input;'
        const displayCode =
          locale === 'es' && value === defaultCode
            ? '// Accede a los datos de entrada con `input`\n// Devuelve el resultado\nreturn input;'
            : value as string
        return (
          <div className="space-y-1">
            <div className="relative">
              <Textarea
                id={field.key}
                value={displayCode}
                onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
                onDragOver={(e) => handleExpressionDragOver(e, field)}
                onDragLeave={clearDragTarget}
                onDrop={(e) => handleExpressionDrop(e, field)}
                placeholder={placeholder || t('codePlaceholder')}
                className={cn(
                  'min-h-[150px] resize-y border-border bg-zinc-900 font-mono text-sm',
                  'text-green-400',
                  droppableFieldClass(field, Boolean(error))
                )}
              />
              {dropHint(field)}
              <Badge variant="outline" className="absolute top-2 right-2 text-[10px] opacity-60 border-amber-500/50 text-amber-400">
                <Code className="w-3 h-3 mr-1" />
                JS
              </Badge>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {t('codeHelp')} <code className="bg-muted px-1 rounded">input</code>. {t('codeHelpReturn')}
            </p>
          </div>
        )

      case 'number':
        return (
          <div className="space-y-1">
            <Input
              id={field.key}
              type="number"
              value={value as number}
              onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value) || 0, field)}
              placeholder={placeholder}
              className={cn('bg-input border-border', error && 'border-destructive')}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        )

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(v) => handleConfigChange(field.key, v, field)}
          >
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder={placeholder || t('selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {tt(opt.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch
              id={field.key}
              checked={value as boolean}
              onCheckedChange={(v) => handleConfigChange(field.key, v, field)}
            />
            <span className="text-sm text-muted-foreground">
              {value ? t('enabled') : t('disabled')}
            </span>
          </div>
        )

      default:
        return null
    }
  }

  const hasConfigFields = nodeType.configSchema.length > 0
  const hasConnectionFields = connectionNodeTypes.has(node.type)
  const allConfigFields = (hasConnectionFields ? [...connectionFields, ...nodeType.configSchema] : nodeType.configSchema)
    .filter((field) => fieldIsVisible(field, localConfig))
    .filter((field) => fieldMatchesNodeMode(node.type, field, localConfig))
  const guide = nodeGuides[node.type] || categoryGuides[nodeType.category]
  const requiredFields = allConfigFields.filter((field) => field.required)
  const missingRequiredFields = requiredFields.filter((field) => {
    const value = localConfig[field.key] ?? field.defaultValue
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  })
  const incomingNodes = workflow?.edges
    .filter((edge) => edge.target === node.id)
    .map((edge) => workflow.nodes.find((workflowNode) => workflowNode.id === edge.source))
    .filter(Boolean) || []
  const outgoingNodes = workflow?.edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => workflow.nodes.find((workflowNode) => workflowNode.id === edge.target))
    .filter(Boolean) || []
  const variableSuggestions: ExpressionSuggestion[] = [
    ...globalVariables.map((variable) => ({
      label: `variables.${variable.name}`,
      expression: `{{variables.${variable.name}}}`,
      value: variable.value,
    })),
    ...Object.entries(workflow?.variables || {})
      .filter(([name]) => !globalVariables.some((variable) => variable.name === name))
      .map(([name, value]) => ({
        label: `variables.${name}`,
        expression: `{{variables.${name}}}`,
        value,
      })),
  ]
  const inputSuggestions = incomingNodes.flatMap((incoming) => {
    if (!incoming) return []
    const executedOutput = currentExecution?.nodeResults[incoming.id]?.output
    const exampleOutput = executedOutput ?? getExampleOutputForNode(incoming)
    return collectExpressionPaths(exampleOutput, 'input')
  })
  const expressionSuggestions = [...variableSuggestions, ...inputSuggestions].slice(0, 16)

  const copyExpression = (expression: string) => {
    void navigator.clipboard.writeText(expression)
  }

  const startExpressionDrag = (event: React.DragEvent, expression: string) => {
    event.dataTransfer.setData('text/plain', expression)
    event.dataTransfer.effectAllowed = 'copy'
    setIsDraggingExpression(true)
  }

  const endExpressionDrag = () => {
    setIsDraggingExpression(false)
    setDragTargetField(null)
  }

  const credentialFields = allConfigFields.filter((field) => connectionFieldKeys.has(field.key))
  const parameterFields = allConfigFields.filter((field) => !connectionFieldKeys.has(field.key))
  const historyForNode = executionHistory
    .map((execution) => execution.nodeResults[node.id])
    .filter(Boolean)
    .slice(0, 8)
  const currentOrManualError = manualRun.error || nodeResult?.error
  const nodeStatus = currentOrManualError
    ? t('error')
    : missingRequiredFields.length > 0
      ? t('unconfigured')
      : t('configured')
  const StatusBadgeClass = currentOrManualError
    ? 'border-red-500/40 bg-red-500/10 text-red-600'
    : missingRequiredFields.length > 0
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
      : 'border-green-500/40 bg-green-500/10 text-green-600'
  const HeaderIcon =
    nodeType.category === 'trigger' ? Play :
    nodeType.category === 'logic' ? ArrowRight :
    nodeType.category === 'transform' ? Code :
    nodeType.category === 'action' ? Settings :
    Info

  const renderFieldList = (fields: ConfigField[]) => (
    fields.length > 0 ? (
      <div className="node-config-section">
        {fields.map((field) => (
          <div key={field.key} className="node-config-field">
            <Label htmlFor={field.key} className="node-config-label">
              {tt(field.label)}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            {renderConfigField(field)}
            {field.helpText && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {tt(field.helpText)}
              </p>
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className={cn('rounded-lg border p-4 text-center', styles.bg, styles.border)}>
        <p className={cn('text-sm', styles.text)}>{t('noConfig')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('passThrough')}</p>
      </div>
    )
  )

  const renderGoogleAccountCard = () => (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-[#202020]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            googleCredential ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
          )}>
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t('connectedAccount')}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {googleCredential ? googleAccountEmail : t('noConnectedAccount')}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px]',
            googleCredential
              ? 'border-green-500/40 bg-green-500/10 text-green-600'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
          )}
        >
          {isLoadingCredentials ? t('loading') : googleCredential ? t('connected') : t('disconnected')}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleConnectGoogle}>
          {t('reconnect')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleConnectGoogle}>
          {t('changeAccount')}
        </Button>
      </div>
    </div>
  )

  return (
    <aside className={cn('node-config-panel', className)}>
      <header className="node-config-header">
        <div className="node-config-title-row">
          <div className={cn('node-config-node-icon', styles.bg, styles.text)}>
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {tt(node.data.label || nodeType.label)}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {tt(nodeType.label)} · {categoryLabel}
            </p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', StatusBadgeClass)}>
            {nodeStatus}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </header>

      <Tabs defaultValue="parameters" className="node-config-tabs-root">
        <TabsList className="node-config-tabs">
          <TabsTrigger value="parameters" className="node-config-tab">
            {t('parameters')}
          </TabsTrigger>
          <TabsTrigger value="credentials" className="node-config-tab">
            {t('credentials')}
          </TabsTrigger>
          <TabsTrigger value="execution" className="node-config-tab">
            {t('execute')}
          </TabsTrigger>
          <TabsTrigger value="history" className="node-config-tab">
            {t('history')}
          </TabsTrigger>
        </TabsList>

        <section ref={configScrollRef} className="node-config-content" onDragOver={handleConfigDragOver}>
          <TabsContent value="parameters" className="m-0 space-y-4 data-[state=inactive]:hidden">
            <div className="rounded-lg border border-black/10 bg-white p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#202020]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t('selectedNodeData')}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{node.id}</p>
                </div>
                <Badge variant="outline" className={cn('shrink-0 text-[10px]', styles.bg, styles.text, styles.border)}>
                  {categoryLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="text-muted-foreground">{t('nodeType')}</p>
                  <p className="mt-1 truncate font-medium text-foreground">{tt(nodeType.label)}</p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="text-muted-foreground">{t('position')}</p>
                  <p className="mt-1 font-mono text-foreground">
                    {Math.round(node.position.x)}, {Math.round(node.position.y)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="text-muted-foreground">{t('incomingConnections')}</p>
                  <p className="mt-1 truncate font-medium text-foreground">
                    {incomingNodes.length > 0
                      ? incomingNodes.map((incoming) => tt(incoming!.data.label)).join(', ')
                      : t('noConnections')}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="text-muted-foreground">{t('outgoingConnections')}</p>
                  <p className="mt-1 truncate font-medium text-foreground">
                    {outgoingNodes.length > 0
                      ? outgoingNodes.map((outgoing) => tt(outgoing!.data.label)).join(', ')
                      : t('noConnections')}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('configurationData')}</Label>
                <pre className="max-h-44 overflow-auto rounded-md border border-border bg-[#111111] p-2 text-[11px] leading-relaxed text-[#d8f5d0]">
                  {formatNodeData({
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: node.data,
                  })}
                </pre>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t('setupGuide')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {tt(guide.purpose)}
                  </p>
                </div>
              </div>

              {requiredFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {requiredFields.map((field) => {
                    const missing = missingRequiredFields.some((missingField) => missingField.key === field.key)
                    return (
                      <Badge
                        key={field.key}
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          missing ? 'border-amber-500/40 text-amber-400' : 'border-green-500/40 text-green-400'
                        )}
                      >
                        {missing ? t('missing') : t('ready')}: {tt(field.label)}
                      </Badge>
                    )
                  })}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">{t('whatToConfigure')}</p>
                <ul className="space-y-1.5">
                  {guide.configure.map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{tt(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-dashed border-border p-2">
                <p className="text-xs font-medium text-foreground">{t('dataAvailable')}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {incomingNodes.length > 0 ? (
                    incomingNodes.map((incoming, index) => (
                      <Badge key={`incoming-${incoming!.id}-${index}`} variant="secondary" className="text-[10px]">
                        {tt(incoming!.data.label)}
                      </Badge>
                    ))
                  ) : (
                    <span>{t('noInputs')}</span>
                  )}
                  {outgoingNodes.length > 0 && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      {outgoingNodes.map((outgoing, index) => (
                        <Badge key={`outgoing-${outgoing!.id}-${index}`} variant="outline" className="text-[10px]">
                          {tt(outgoing!.data.label)}
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
                <ul className="mt-2 space-y-1">
                  {guide.data.map((item) => (
                    <li key={item} className="text-xs leading-relaxed text-muted-foreground">
                      {tt(item)}
                    </li>
                  ))}
                </ul>
              </div>

              {expressionSuggestions.length > 0 && (
                <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Mapper</p>
                    <span className="text-[10px] text-muted-foreground">Drag or click</span>
                  </div>
                  <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-auto pr-1">
                    {expressionSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.expression}`}
                        type="button"
                        draggable
                        className="inline-flex max-w-full cursor-grab items-center gap-1.5 rounded border border-violet-500/30 bg-background px-2 py-1.5 text-left shadow-sm transition-colors hover:border-violet-500/60 hover:bg-violet-500/10 active:cursor-grabbing"
                        onClick={() => copyExpression(suggestion.expression)}
                        onDragStart={(event) => startExpressionDrag(event, suggestion.expression)}
                        onDragEnd={endExpressionDrag}
                        title={suggestion.expression}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                        <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                          {suggestion.label}
                        </span>
                        <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Arrastra un token al campo que quieras mapear, o haz click para copiarlo.
                  </p>
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{t('nextStep')}:</span> {tt(guide.nextStep)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="node-label" className="text-sm text-foreground">
                {t('nodeLabel')}
              </Label>
              <Input
                id="node-label"
                value={node.data.label || nodeType.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            {renderFieldList(parameterFields)}
          </TabsContent>

          <TabsContent value="credentials" className="m-0 space-y-4 data-[state=inactive]:hidden">
            {node.type === 'google-sheets' ? (
              <>
                {renderGoogleAccountCard()}
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('googleSheetsCredentialHelpTitle')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('googleSheetsCredentialHelpText')}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('connection')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('connectionDescription')}</p>
                    </div>
                  </div>
                </div>
                {renderFieldList(credentialFields)}
              </>
            )}
          </TabsContent>

          <TabsContent value="execution" className="m-0 space-y-4 data-[state=inactive]:hidden">
            <div className="rounded-lg border border-black/10 bg-white p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#202020]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('manualRun')}</p>
                  <p className="text-xs text-muted-foreground">{t('executeSelectedNode')}</p>
                </div>
                <Button size="sm" onClick={handleManualNodeRun} disabled={manualRun.status === 'running'} className="h-8">
                  {manualRun.status === 'running' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {t('runNode')}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={cn(
                    manualRun.status === 'success' && 'border-green-500/40 text-green-500',
                    manualRun.status === 'error' && 'border-red-500/40 text-red-500',
                    manualRun.status === 'running' && 'border-amber-500/40 text-amber-500'
                  )}
                >
                  {manualRun.status}
                </Badge>
                {manualRun.durationMs !== undefined && <span className="text-muted-foreground">{manualRun.durationMs}ms</span>}
              </div>

              <div className="mt-3 space-y-2">
                <details open={manualRun.status !== 'idle'}>
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{t('inputs')}</summary>
                  <pre className="mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background/60 p-2 text-[11px]">
                    {JSON.stringify(manualRun.input ?? null, null, 2)}
                  </pre>
                </details>

                {manualRun.output !== undefined && (
                  <details open>
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{t('output')}</summary>
                    <pre className="mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background/60 p-2 text-[11px]">
                      {JSON.stringify(manualRun.output, null, 2)}
                    </pre>
                  </details>
                )}

                {manualRun.error && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2">
                    <p className="text-xs font-medium text-red-400">{t('error')}</p>
                    <pre className="mt-1 max-h-36 overflow-auto text-[11px] text-red-400">{manualRun.error}</pre>
                  </div>
                )}
              </div>
            </div>

            {nodeResult ? (
              <>
                <div className={cn(
                  'p-3 rounded-lg',
                  nodeResult.status === 'success' && 'bg-green-500/10 border border-green-500/30',
                  nodeResult.status === 'error' && 'bg-red-500/10 border border-red-500/30',
                  nodeResult.status === 'running' && 'bg-amber-500/10 border border-amber-500/30'
                )}>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      'font-medium capitalize text-sm',
                      nodeResult.status === 'success' && 'text-green-400',
                      nodeResult.status === 'error' && 'text-red-400',
                      nodeResult.status === 'running' && 'text-amber-400'
                    )}>
                      {nodeResult.status === 'running' && '⏳ '}
                      {nodeResult.status === 'success' && '✓ '}
                      {nodeResult.status === 'error' && '✕ '}
                      {t(nodeResult.status)}
                    </p>
                    {nodeResult.duration && (
                      <Badge variant="outline" className="text-xs">
                        {nodeResult.duration}ms
                      </Badge>
                    )}
                  </div>
                </div>
                
                {nodeResult.output !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{t('outputData')}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleCopyOutput}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            {t('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            {t('copy')}
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="p-3 rounded-lg bg-zinc-900 text-xs font-mono overflow-auto max-h-60 text-green-400">
                      {JSON.stringify(nodeResult.output, null, 2)}
                    </pre>
                  </div>
                )}
                
                {nodeResult.error && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('error')}</Label>
                    <pre className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono overflow-auto">
                      {nodeResult.error}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Play className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t('noExecutionData')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t('runWorkflowOutput')}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="m-0 space-y-4 data-[state=inactive]:hidden">
            {historyForNode.length === 0 ? (
              <div className="rounded-lg border border-border bg-white p-6 text-center text-sm text-muted-foreground dark:bg-[#202020]">
                {t('noNodeHistory')}
              </div>
            ) : (
              <div className="space-y-2">
                {historyForNode.map((result, index) => (
                  <div key={`${result.nodeId}-${result.startTime}-${index}`} className="rounded-lg border border-border bg-white p-3 text-xs dark:bg-[#202020]">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{t(result.status)}</Badge>
                      <span className="text-muted-foreground">{result.durationMs ?? result.duration ?? 0}ms</span>
                    </div>
                    {result.error && <pre className="mt-2 rounded bg-red-500/10 p-2 text-red-500">{result.error}</pre>}
                    {result.output !== undefined && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground">{t('output')}</summary>
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-background/60 p-2">
                          {JSON.stringify(result.output, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">{t('nodeType')}</Label>
                <p className="text-sm font-medium">{tt(nodeType.label)}</p>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">{t('description')}</Label>
                <p className="text-sm text-foreground/80">{tt(nodeType.description)}</p>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">{t('nodeId')}</Label>
                <code className="text-xs bg-muted px-2 py-1 rounded block mt-1 truncate">
                  {node.id}
                </code>
              </div>

              <div className="h-px bg-border" />

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{t('inputs')}</Label>
                {nodeType.inputs.length > 0 ? (
                  <div className="space-y-1">
                    {nodeType.inputs.map((input) => (
                      <div key={input.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span>{tt(input.label)}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {input.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noInputs')}</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{t('outputs')}</Label>
                <div className="space-y-1">
                  {nodeType.outputs.map((output) => (
                    <div key={output.id} className="flex items-center gap-2 text-sm">
                      <div className={cn('w-2 h-2 rounded-full', styles.bg.replace('/10', ''))} />
                      <span>{tt(output.label)}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {output.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </section>
      </Tabs>

      <footer className="node-config-footer">
        <Button variant="outline" size="sm" className="node-config-footer-button" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="node-config-footer-button"
          onClick={() => updateNodeData(node.id, { config: localConfig })}
        >
          {t('saveChanges')}
        </Button>
        <Button
          size="sm"
          className="node-config-footer-button"
          onClick={handleManualNodeRun}
          disabled={manualRun.status === 'running'}
        >
          {manualRun.status === 'running' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          <span className="truncate">{t('runNode')}</span>
        </Button>
      </footer>
    </aside>
  )
}
