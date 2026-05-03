'use client'

import { useState } from 'react'
import { Plus, Trash2, Variable, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkflowStore } from '@/lib/workflow/store'
import type { GlobalVariable } from '@/lib/workflow/types'

export function VariablesPanel() {
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const addGlobalVariable = useWorkflowStore((s) => s.addGlobalVariable)
  const updateGlobalVariable = useWorkflowStore((s) => s.updateGlobalVariable)
  const deleteGlobalVariable = useWorkflowStore((s) => s.deleteGlobalVariable)

  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newVar, setNewVar] = useState({
    name: '',
    value: '',
    type: 'string' as GlobalVariable['type'],
    description: '',
  })

  const handleAdd = () => {
    if (!newVar.name.trim()) return
    
    let parsedValue: unknown = newVar.value
    if (newVar.type === 'number') {
      parsedValue = parseFloat(newVar.value) || 0
    } else if (newVar.type === 'boolean') {
      parsedValue = newVar.value === 'true'
    } else if (newVar.type === 'json') {
      try {
        parsedValue = JSON.parse(newVar.value)
      } catch {
        parsedValue = {}
      }
    }

    addGlobalVariable({
      name: newVar.name,
      value: parsedValue,
      type: newVar.type,
      description: newVar.description,
    })

    setNewVar({ name: '', value: '', type: 'string', description: '' })
    setIsOpen(false)
  }

  const formatValue = (variable: GlobalVariable) => {
    if (variable.type === 'json') {
      return JSON.stringify(variable.value, null, 2)
    }
    return String(variable.value)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Variable className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Global Variables</h3>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Global Variable</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="myVariable"
                  value={newVar.name}
                  onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newVar.type}
                  onValueChange={(v) => setNewVar({ ...newVar, type: v as GlobalVariable['type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                {newVar.type === 'boolean' ? (
                  <Select
                    value={newVar.value}
                    onValueChange={(v) => setNewVar({ ...newVar, value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : newVar.type === 'json' ? (
                  <Textarea
                    placeholder='{"key": "value"}'
                    value={newVar.value}
                    onChange={(e) => setNewVar({ ...newVar, value: e.target.value })}
                    rows={4}
                    className="font-mono text-sm"
                  />
                ) : (
                  <Input
                    placeholder="Value"
                    type={newVar.type === 'number' ? 'number' : 'text'}
                    value={newVar.value}
                    onChange={(e) => setNewVar({ ...newVar, value: e.target.value })}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Description..."
                  value={newVar.description}
                  onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                />
              </div>
              <Button onClick={handleAdd} className="w-full">
                Add Variable
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[300px]">
        {globalVariables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No global variables defined</p>
            <p className="text-xs">Variables can be accessed in any node</p>
          </div>
        ) : (
          <div className="space-y-2">
            {globalVariables.map((variable) => (
              <div
                key={variable.id}
                className="p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold text-primary">
                        ${'{'}
                        {variable.name}
                        {'}'}
                      </code>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {variable.type}
                      </span>
                    </div>
                    {variable.description && (
                      <p className="text-xs text-muted-foreground">
                        {variable.description}
                      </p>
                    )}
                    <pre className="text-xs mt-1 p-2 rounded bg-background overflow-x-auto">
                      {formatValue(variable)}
                    </pre>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteGlobalVariable(variable.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p className="font-medium">Usage in nodes:</p>
        <code className="block p-2 bg-muted rounded text-xs">
          {'${{variableName}}'} or variables.variableName
        </code>
      </div>
    </div>
  )
}
