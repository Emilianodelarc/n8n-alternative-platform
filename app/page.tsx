'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useWorkflowStore } from '@/lib/workflow/store'
import {
  Plus,
  Search,
  Workflow,
  Play,
  Clock,
  GitBranch,
  MoreVertical,
  Copy,
  Trash2,
  Zap,
  LayoutTemplate,
} from 'lucide-react'
import { TemplatesGallery } from '@/components/workflow/templates-gallery'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { useI18n } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function DashboardPage() {
  const { t, tt } = useI18n()
  const workflows = useWorkflowStore((s) => s.workflows)
  const createWorkflow = useWorkflowStore((s) => s.createWorkflow)
  const duplicateWorkflow = useWorkflowStore((s) => s.duplicateWorkflow)
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow)
  const loadWorkflowsFromBackend = useWorkflowStore((s) => s.loadWorkflowsFromBackend)

  const [search, setSearch] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Rehydrate store from localStorage on client
    useWorkflowStore.persist.rehydrate()
    void loadWorkflowsFromBackend()
    setMounted(true)
  }, [loadWorkflowsFromBackend])

  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateWorkflow = () => {
    if (newWorkflowName.trim()) {
      createWorkflow(newWorkflowName.trim(), newWorkflowDescription.trim() || undefined)
      setNewWorkflowName('')
      setNewWorkflowDescription('')
      setIsCreateDialogOpen(false)
    }
  }

  const handleDuplicate = (id: string) => {
    duplicateWorkflow(id)
  }

  const handleDelete = (id: string) => {
    if (confirm(t('deleteWorkflowConfirm'))) {
      deleteWorkflow(id)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'trigger':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'action':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'logic':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'transform':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'trigger':
        return t('triggers')
      case 'action':
        return t('actions')
      case 'logic':
        return t('logic')
      case 'transform':
        return t('transform')
      default:
        return t('utility')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">FlowCraft</h1>
                <p className="text-sm text-muted-foreground">{t('workflowAutomation')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />

              <Dialog open={isTemplatesDialogOpen} onOpenChange={setIsTemplatesDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <LayoutTemplate className="w-4 h-4 mr-2" />
                    {t('templates')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{t('workflowTemplates')}</DialogTitle>
                    <DialogDescription>
                      {t('workflowTemplatesDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <TemplatesGallery onClose={() => setIsTemplatesDialogOpen(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('newWorkflow')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('createNewWorkflow')}</DialogTitle>
                  <DialogDescription>
                    {t('createNewWorkflowDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('name')}</Label>
                    <Input
                      id="name"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      placeholder={t('workflowNamePlaceholder')}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('descriptionOptional')}</Label>
                    <Textarea
                      id="description"
                      value={newWorkflowDescription}
                      onChange={(e) => setNewWorkflowDescription(e.target.value)}
                      placeholder={t('workflowDescriptionPlaceholder')}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleCreateWorkflow} disabled={!newWorkflowName.trim()}>
                    {t('createWorkflow')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchWorkflows')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredWorkflows.length} {filteredWorkflows.length !== 1 ? t('workflows') : t('workflow')}
          </div>
        </div>

        {/* Workflows Grid */}
        {filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Workflow className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">{t('noWorkflowsFound')}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? t('tryDifferentSearch') : t('createFirstWorkflow')}
            </p>
            {!search && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('createWorkflow')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.map((workflow) => {
              const nodeCategories = [...new Set(workflow.nodes.map((n) => n.data.category))]
              return (
                <Card
                  key={workflow.id}
                  className="group relative hover:border-primary/50 transition-colors"
                >
                  <Link href={`/editor/${workflow.id}`} className="absolute inset-0 z-10" />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{tt(workflow.name)}</CardTitle>
                        {workflow.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {tt(workflow.description)}
                          </CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="relative z-20 h-8 w-8 shrink-0"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(workflow.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            {t('duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(workflow.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <GitBranch className="w-4 h-4" />
                        <span>{workflow.nodes.length} {t('nodes').toLowerCase()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span suppressHydrationWarning>
                          {mounted ? new Date(workflow.updatedAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {nodeCategories.slice(0, 3).map((category) => (
                        <Badge
                          key={category}
                          variant="outline"
                          className={getCategoryColor(category)}
                        >
                          {getCategoryLabel(category)}
                        </Badge>
                      ))}
                      {nodeCategories.length > 3 && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          +{nodeCategories.length - 3}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
