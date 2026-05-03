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
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { useWorkflowStore } from '@/lib/workflow/store'
import { useI18n } from '@/lib/i18n'
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
  Undo2,
  Redo2,
  PanelLeft,
  PanelRight,
} from 'lucide-react'

interface ToolbarProps {
  onExecute: () => void
  isExecuting: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  isLibraryOpen?: boolean
  isInspectorOpen?: boolean
  onToggleLibrary?: () => void
  onToggleInspector?: () => void
  onOpenMobileLibrary?: () => void
  onOpenMobileInspector?: () => void
  className?: string
}

export function Toolbar({ 
  onExecute, 
  isExecuting, 
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isLibraryOpen = true,
  isInspectorOpen = true,
  onToggleLibrary,
  onToggleInspector,
  onOpenMobileLibrary,
  onOpenMobileInspector,
  className 
}: ToolbarProps) {
  const { t, tt } = useI18n()
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
      alert(t('invalidJson'))
    }
  }

  const handleDuplicate = () => {
    if (workflow) {
      const newId = duplicateWorkflow(workflow.id)
      setActiveWorkflow(newId)
    }
  }

  const handleDelete = () => {
    if (workflow && confirm(t('deleteWorkflowConfirm'))) {
      deleteWorkflow(workflow.id)
    }
  }

  if (!workflow) return null

  return (
    <>
      <div className={cn('flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 lg:flex-nowrap', className)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="hidden items-center gap-1 rounded-md border border-border bg-background p-1 lg:flex">
            <Button
              variant={isLibraryOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={onToggleLibrary}
              title={t('nodes')}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isInspectorOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={onToggleInspector}
              title={t('config')}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="max-w-[42vw] truncate text-base font-semibold text-foreground sm:max-w-[52vw] lg:max-w-[320px]">
              {tt(workflow.name)}
            </h1>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenEditDialog}>
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
          {workflow.description && (
            <span className="hidden max-w-[260px] truncate text-sm text-muted-foreground xl:block">
              {tt(workflow.description)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-1 lg:hidden">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onOpenMobileLibrary} title={t('nodes')}>
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onOpenMobileInspector} title={t('config')}>
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Undo/Redo buttons */}
          <div className="hidden items-center border-r border-border pr-2 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
              title={`${t('undo')} (Ctrl+Z)`}
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!canRedo}
              title={`${t('redo')} (Ctrl+Shift+Z)`}
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={onExecute}
            disabled={isExecuting || workflow.nodes.length === 0}
            className="h-8 bg-green-600 px-3 text-white hover:bg-green-700"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-0 h-4 w-4 animate-spin sm:mr-2" />
                <span className="hidden sm:inline">{t('running')}</span>
              </>
            ) : (
              <>
                <Play className="mr-0 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('execute')}</span>
              </>
            )}
          </Button>

          <div className="hidden items-center gap-1 md:flex">
            <LanguageToggle />
            <ThemeToggle />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenEditDialog}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('editDetails')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                {t('duplicate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                {t('exportJson')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                {t('importJson')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="md:hidden" />
              <div className="flex items-center gap-2 px-2 py-1.5 md:hidden">
                <LanguageToggle />
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('deleteWorkflow')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editWorkflow')}</DialogTitle>
            <DialogDescription>{t('editWorkflowDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('workflowName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('optionalDescription')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('importWorkflow')}</DialogTitle>
            <DialogDescription>{t('importWorkflowDescription')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={t('pasteWorkflowJson')}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleImport}>{t('import')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
