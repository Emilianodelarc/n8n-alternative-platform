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
import { NODE_TYPES, type ConfigField, type NodeCategory, type WorkflowNode } from '@/lib/workflow/types'
import { useI18n } from '@/lib/i18n'
import { X, Trash2, Settings, Play, Code, Info, Copy, Check, AlertCircle, KeyRound, ClipboardList, ArrowRight } from 'lucide-react'

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

const connectionNodeTypes = new Set([
  'http-request',
  'google-sheets',
  'google-drive',
  'google-docs',
  'google-slides',
  'gmail',
  'google-calendar',
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
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())

  const node = selectedNodeId ? getNode(selectedNodeId) : null
  const nodeType = node ? NODE_TYPES[node.type] : null
  const nodeResult = selectedNodeId ? currentExecution?.nodeResults[selectedNodeId] : null

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({})
  const [copied, setCopied] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isDraggingExpression, setIsDraggingExpression] = useState(false)
  const [dragTargetField, setDragTargetField] = useState<string | null>(null)
  const configScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (node?.data.config) {
      setLocalConfig(node.data.config)
      setValidationErrors({})
    }
  }, [node?.data.config, selectedNodeId])

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
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    
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
  }, [localConfig, selectedNodeId, updateNodeConfig, validateField])

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

  if (!node || !nodeType) {
    return (
      <div className={cn('flex flex-col h-full bg-sidebar border-l border-sidebar-border', className)}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
          <Settings className="w-8 h-8 mb-2 opacity-50" />
          <p>{t('selectNode')}</p>
          <p className="text-xs mt-1 opacity-70">{t('clickNode')}</p>
        </div>
      </div>
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
  const allConfigFields = hasConnectionFields ? [...connectionFields, ...nodeType.configSchema] : nodeType.configSchema
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

  return (
    <div className={cn('flex flex-col h-full bg-sidebar border-l border-sidebar-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium shrink-0', styles.bg, styles.text)}>
            {categoryLabel}
          </span>
          <span className="text-sm font-medium text-foreground truncate">{tt(nodeType.label)}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mx-3 mt-2 shrink-0" style={{ width: 'calc(100% - 24px)' }}>
          <TabsTrigger value="config" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            {t('config')}
          </TabsTrigger>
          <TabsTrigger value="output" className="text-xs">
            <Play className="w-3 h-3 mr-1" />
            {t('output')}
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs">
            <Info className="w-3 h-3 mr-1" />
            {t('info')}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div ref={configScrollRef} className="h-full overflow-y-auto" onDragOver={handleConfigDragOver}>
            <TabsContent value="config" className="p-3 space-y-4 mt-0 data-[state=inactive]:hidden">
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

            {/* Label */}
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

            {/* Config fields */}
            {hasConnectionFields && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">{t('connection')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('connectionDescription')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {hasConfigFields || hasConnectionFields ? (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-4">
                  {allConfigFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key} className="text-sm text-muted-foreground flex items-center gap-1">
                        {tt(field.label)}
                        {field.required && <span className="text-destructive">*</span>}
                      </Label>
                      {renderConfigField(field)}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={cn('p-4 rounded-lg text-center', styles.bg, styles.border, 'border')}>
                <p className={cn('text-sm', styles.text)}>
                  {t('noConfig')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('passThrough')}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="output" className="p-3 space-y-4 mt-0 data-[state=inactive]:hidden">
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

          <TabsContent value="info" className="p-3 space-y-4 mt-0 data-[state=inactive]:hidden">
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
          </div>
        </div>
      </Tabs>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('deleteNode')}
        </Button>
      </div>
    </div>
  )
}
