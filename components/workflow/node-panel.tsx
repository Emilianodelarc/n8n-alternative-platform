'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { NODE_TYPES, type ConfigField, type NodeCategory } from '@/lib/workflow/types'
import { X, Trash2, Settings, Play, Code, Info, Copy, Check, AlertCircle } from 'lucide-react'

const categoryStyles: Record<NodeCategory, { bg: string; text: string; border: string }> = {
  trigger: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  action: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  logic: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  transform: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  utility: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
}

interface NodePanelProps {
  className?: string
}

export function NodePanel({ className }: NodePanelProps) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const getNode = useWorkflowStore((s) => s.getNode)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig)
  const deleteNode = useWorkflowStore((s) => s.deleteNode)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const currentExecution = useWorkflowStore((s) => s.currentExecution)

  const node = selectedNodeId ? getNode(selectedNodeId) : null
  const nodeType = node ? NODE_TYPES[node.type] : null
  const nodeResult = selectedNodeId ? currentExecution?.nodeResults[selectedNodeId] : null

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({})
  const [copied, setCopied] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (node?.data.config) {
      setLocalConfig(node.data.config)
      setValidationErrors({})
    }
  }, [node?.data.config, selectedNodeId])

  const validateField = useCallback((field: ConfigField, value: unknown): string | null => {
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.label} is required`
    }
    if (field.type === 'json' && value) {
      try {
        JSON.parse(value as string)
      } catch {
        return 'Invalid JSON format'
      }
    }
    if (field.type === 'number' && value !== undefined && value !== '') {
      if (isNaN(Number(value))) {
        return 'Must be a valid number'
      }
    }
    return null
  }, [])

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
          <p>Select a node to configure</p>
          <p className="text-xs mt-1 opacity-70">Click on any node in the canvas</p>
        </div>
      </div>
    )
  }

  const styles = categoryStyles[nodeType.category]

  const renderConfigField = (field: ConfigField) => {
    const value = localConfig[field.key] ?? field.defaultValue ?? ''
    const error = validationErrors[field.key]

    switch (field.type) {
      case 'text':
        return (
          <div className="space-y-1">
            <Input
              id={field.key}
              value={value as string}
              onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
              placeholder={field.placeholder}
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

      case 'textarea':
        return (
          <div className="space-y-1">
            <Textarea
              id={field.key}
              value={value as string}
              onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
              placeholder={field.placeholder}
              className={cn('min-h-[80px] bg-input border-border resize-y', error && 'border-destructive')}
            />
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
                placeholder={field.placeholder}
                className={cn(
                  'min-h-[100px] font-mono text-sm bg-input border-border resize-y',
                  error && 'border-destructive'
                )}
              />
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
        return (
          <div className="space-y-1">
            <div className="relative">
              <Textarea
                id={field.key}
                value={value as string}
                onChange={(e) => handleConfigChange(field.key, e.target.value, field)}
                placeholder={field.placeholder || '// Write your code here'}
                className={cn(
                  'min-h-[150px] font-mono text-sm bg-zinc-900 border-border resize-y',
                  'text-green-400',
                  error && 'border-destructive'
                )}
              />
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
              Access input data via <code className="bg-muted px-1 rounded">input</code>. Return your result.
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
              placeholder={field.placeholder}
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
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
              {value ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )

      default:
        return null
    }
  }

  const hasConfigFields = nodeType.configSchema.length > 0

  return (
    <div className={cn('flex flex-col h-full bg-sidebar border-l border-sidebar-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium shrink-0', styles.bg, styles.text)}>
            {nodeType.category}
          </span>
          <span className="text-sm font-medium text-foreground truncate">{nodeType.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mx-3 mt-2 shrink-0" style={{ width: 'calc(100% - 24px)' }}>
          <TabsTrigger value="config" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            Config
          </TabsTrigger>
          <TabsTrigger value="output" className="text-xs">
            <Play className="w-3 h-3 mr-1" />
            Output
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs">
            <Info className="w-3 h-3 mr-1" />
            Info
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <TabsContent value="config" className="p-3 space-y-4 mt-0 data-[state=inactive]:hidden">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="node-label" className="text-sm text-foreground">
                Node Label
              </Label>
              <Input
                id="node-label"
                value={node.data.label || nodeType.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            {/* Config fields */}
            {hasConfigFields ? (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-4">
                  {nodeType.configSchema.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key} className="text-sm text-muted-foreground flex items-center gap-1">
                        {field.label}
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
                  This node has no configuration options.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  It will pass data through as-is.
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
                      {nodeResult.status}
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
                      <Label className="text-xs text-muted-foreground">Output Data</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleCopyOutput}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
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
                    <Label className="text-xs text-muted-foreground">Error</Label>
                    <pre className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono overflow-auto">
                      {nodeResult.error}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Play className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No execution data</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Run the workflow to see output
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="p-3 space-y-4 mt-0 data-[state=inactive]:hidden">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Node Type</Label>
                <p className="text-sm font-medium">{nodeType.label}</p>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm text-foreground/80">{nodeType.description}</p>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Node ID</Label>
                <code className="text-xs bg-muted px-2 py-1 rounded block mt-1 truncate">
                  {node.id}
                </code>
              </div>

              <div className="h-px bg-border" />

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Inputs</Label>
                {nodeType.inputs.length > 0 ? (
                  <div className="space-y-1">
                    {nodeType.inputs.map((input) => (
                      <div key={input.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span>{input.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {input.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No inputs (trigger node)</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Outputs</Label>
                <div className="space-y-1">
                  {nodeType.outputs.map((output) => (
                    <div key={output.id} className="flex items-center gap-2 text-sm">
                      <div className={cn('w-2 h-2 rounded-full', styles.bg.replace('/10', ''))} />
                      <span>{output.label}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {output.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          </ScrollArea>
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
          Delete Node
        </Button>
      </div>
    </div>
  )
}
