'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useWorkflowStore } from '@/lib/workflow/store'
import { cn } from '@/lib/utils'
import {
  Play,
  Save,
  MoreVertical,
  Download,
  Upload,
  Copy,
  Trash2,
  ChevronLeft,
  Pencil,
  Loader2,
} from 'lucide-react'

interface ToolbarProps {
  onExecute: () => void
  isExecuting: boolean
  className?: string
}

export function Toolbar({ onExecute, isExecuting, className }: ToolbarProps) {
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow)
  const duplicateWorkflow = useWorkflowStore((s) => s.duplicateWorkflow)
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow)
  const exportWorkflow = useWorkflowStore((s) => s.exportWorkflow)
  const importWorkflow = useWorkflowStore((s) => s.importWorkflow)
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [importJson, setImportJson] = useState('')

  const handleOpenEditDialog = () => {
    if (workflow) {
      setEditName(workflow.name)
      setEditDescription(workflow.description || '')
      setIsEditDialogOpen(true)
    }
  }

  const handleSaveEdit = () => {
    if (workflow) {
      updateWorkflow(workflow.id, { name: editName, description: editDescription })
      setIsEditDialogOpen(false)
    }
  }

  const handleExport = () => {
    if (!workflow) return
    const data = exportWorkflow(workflow.id)
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson)
      importWorkflow(data)
      setIsImportDialogOpen(false)
      setImportJson('')
    } catch {
      alert('Invalid JSON format')
    }
  }

  const handleDuplicate = () => {
    if (workflow) {
      const newId = duplicateWorkflow(workflow.id)
      setActiveWorkflow(newId)
    }
  }

  const handleDelete = () => {
    if (workflow && confirm('Are you sure you want to delete this workflow?')) {
      deleteWorkflow(workflow.id)
    }
  }

  if (!workflow) return null

  return (
    <>
      <div className={cn('flex items-center justify-between px-4 py-2 border-b border-border bg-card', className)}>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{workflow.name}</h1>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenEditDialog}>
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
          {workflow.description && (
            <span className="text-sm text-muted-foreground hidden md:block">
              {workflow.description}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onExecute}
            disabled={isExecuting || workflow.nodes.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Execute
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenEditDialog}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>Update the name and description of your workflow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Workflow name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Workflow</DialogTitle>
            <DialogDescription>Paste the JSON content of a workflow to import it.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste workflow JSON here..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
