'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Workflow,
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
  const router = useRouter()
  const workflow = useWorkflowStore((s) => s.getActiveWorkflow())
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow)
  const duplicateWorkflow = useWorkflowStore((s) => s.duplicateWorkflow)
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow)
  const exportWorkflow = useWorkflowStore((s) => s.exportWorkflow)
  const importWorkflow = useWorkflowStore((s) => s.importWorkflow)
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
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
    if (!workflow) return
    deleteWorkflow(workflow.id)
    setIsDeleteDialogOpen(false)
    router.replace('/')
  }

  if (!workflow) return null

  return (
    <>
      <div className={cn('flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-[#fbfaf8] px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#1b1b1b] lg:flex-nowrap', className)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="hidden items-center gap-1 rounded-md border border-black/10 bg-[#f1f0ec] p-1 dark:border-white/10 dark:bg-[#242424] lg:flex">
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
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-transparent px-1.5 py-1">
            <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#ff6d5a]/15 text-[#d94d3d] sm:flex">
              <Workflow className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="max-w-[42vw] truncate text-sm font-semibold leading-tight text-foreground sm:max-w-[52vw] lg:max-w-[320px]">
                {tt(workflow.name)}
              </h1>
              {workflow.description && (
                <p className="hidden max-w-[320px] truncate text-xs leading-tight text-muted-foreground lg:block">
                  {tt(workflow.description)}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenEditDialog}>
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
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
              className="h-8 w-8 rounded-md"
              onClick={onUndo}
              disabled={!canUndo}
              title={`${t('undo')} (Ctrl+Z)`}
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
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
            className="h-8 rounded-md bg-[#ff6d5a] px-3 text-white shadow-sm hover:bg-[#eb5946]"
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
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
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

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md overflow-hidden p-0">
          <div className="border-b bg-destructive/5 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogHeader className="gap-1 text-left">
                <AlertDialogTitle>{t('deleteWorkflowTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteWorkflowDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{tt(workflow.name)}</span>
              {workflow.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {tt(workflow.description)}
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter className="border-t bg-muted/20 px-6 py-4">
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
