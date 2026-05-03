'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/workflow/store'
import { NODE_TYPES, type ConfigField, type NodeCategory } from '@/lib/workflow/types'
import { X, Trash2 } from 'lucide-react'

const categoryStyles: Record<NodeCategory, { bg: string; text: string }> = {
  trigger: { bg: 'bg-green-500/10', text: 'text-green-400' },
  action: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  logic: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  transform: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  utility: { bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
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

  useEffect(() => {
    if (node?.data.config) {
      setLocalConfig(node.data.config)
    }
  }, [node?.data.config])

  if (!node || !nodeType) {
    return (
      <div className={cn('flex flex-col h-full bg-sidebar border-l border-sidebar-border', className)}>
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Select a node to configure
        </div>
      </div>
    )
  }

  const styles = categoryStyles[nodeType.category]

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    updateNodeConfig(selectedNodeId!, { [key]: value })
  }

  const handleLabelChange = (label: string) => {
    updateNodeData(selectedNodeId!, { label })
  }

  const handleDelete = () => {
    deleteNode(selectedNodeId!)
  }

  const handleClose = () => {
    setSelectedNode(null)
  }

  const renderConfigField = (field: ConfigField) => {
    const value = localConfig[field.key] ?? field.defaultValue ?? ''

    switch (field.type) {
      case 'text':
        return (
          <Input
            id={field.key}
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="bg-input border-border"
          />
        )

      case 'textarea':
      case 'json':
      case 'code':
        return (
          <Textarea
            id={field.key}
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              'min-h-[100px] bg-input border-border',
              field.type === 'code' && 'font-mono text-sm'
            )}
          />
        )

      case 'number':
        return (
          <Input
            id={field.key}
            type="number"
            value={value as number}
            onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="bg-input border-border"
          />
        )

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(v) => handleConfigChange(field.key, v)}
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
          <Switch
            id={field.key}
            checked={value as boolean}
            onCheckedChange={(v) => handleConfigChange(field.key, v)}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={cn('flex flex-col h-full bg-sidebar border-l border-sidebar-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', styles.bg, styles.text)}>
            {nodeType.category}
          </span>
          <span className="text-sm font-medium text-foreground">{nodeType.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="node-label" className="text-sm text-foreground">
              Label
            </Label>
            <Input
              id="node-label"
              value={node.data.label || nodeType.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="bg-input border-border"
            />
          </div>

          {/* Config fields */}
          {nodeType.configSchema.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Configuration</h3>
                {nodeType.configSchema.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm text-muted-foreground">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {renderConfigField(field)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Execution result */}
          {nodeResult && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Last Execution</h3>
                <div className={cn(
                  'p-2 rounded text-sm',
                  nodeResult.status === 'success' && 'bg-green-500/10 text-green-400',
                  nodeResult.status === 'error' && 'bg-red-500/10 text-red-400',
                  nodeResult.status === 'running' && 'bg-amber-500/10 text-amber-400'
                )}>
                  <p className="font-medium capitalize">{nodeResult.status}</p>
                  {nodeResult.duration && (
                    <p className="text-xs opacity-80">Duration: {nodeResult.duration}ms</p>
                  )}
                </div>
                
                {nodeResult.output !== undefined && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Output</Label>
                    <pre className="p-2 rounded bg-muted text-xs font-mono overflow-auto max-h-40">
                      {JSON.stringify(nodeResult.output, null, 2)}
                    </pre>
                  </div>
                )}
                
                {nodeResult.error && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Error</Label>
                    <pre className="p-2 rounded bg-red-500/10 text-red-400 text-xs font-mono overflow-auto">
                      {nodeResult.error}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

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
