'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { NODE_TYPES, CATEGORY_INFO, type NodeCategory, type NodeTypeDefinition } from '@/lib/workflow/types'
import { useI18n } from '@/lib/i18n'
import {
  Play,
  Webhook,
  Clock,
  Globe,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  GitFork,
  Repeat,
  Merge,
  Variable,
  Wand,
  Filter,
  Split,
  Timer,
  Circle,
  Bell,
  BookOpen,
  Brain,
  Braces,
  CalendarDays,
  CreditCard,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Github,
  HardDrive,
  ListFilter,
  MessageCircle,
  OctagonX,
  Phone,
  Presentation,
  Reply,
  Route,
  Search,
  Send,
  Sparkles,
  Table,
  Table2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play,
  Webhook,
  Clock,
  Globe,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  GitFork,
  Repeat,
  Merge,
  Variable,
  Wand,
  Filter,
  Split,
  Timer,
  Circle,
  Bell,
  BookOpen,
  Brain,
  Braces,
  CalendarDays,
  CreditCard,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Github,
  HardDrive,
  ListFilter,
  MessageCircle,
  OctagonX,
  Phone,
  Presentation,
  Reply,
  Route,
  Send,
  Sparkles,
  Table,
  Table2,
}

const categoryStyles: Record<NodeCategory, { bg: string; text: string; border: string }> = {
  trigger: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  action: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  logic: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  transform: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  utility: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
}

interface NodeLibraryProps {
  className?: string
}

export function NodeLibrary({ className }: NodeLibraryProps) {
  const { t, tt } = useI18n()
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(
    new Set(['trigger', 'action', 'logic', 'transform', 'utility'])
  )

  const toggleCategory = (category: NodeCategory) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const onDragStart = (event: React.DragEvent, nodeType: NodeTypeDefinition) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: nodeType.type,
      label: tt(nodeType.label),
      category: nodeType.category,
    }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredNodes = Object.values(NODE_TYPES).filter(
    (node) =>
      tt(node.label).toLowerCase().includes(search.toLowerCase()) ||
      tt(node.description).toLowerCase().includes(search.toLowerCase())
  )

  const groupedNodes = filteredNodes.reduce(
    (acc, node) => {
      if (!acc[node.category]) {
        acc[node.category] = []
      }
      acc[node.category].push(node)
      return acc
    },
    {} as Record<NodeCategory, NodeTypeDefinition[]>
  )

  const categories: NodeCategory[] = ['trigger', 'action', 'logic', 'transform', 'utility']

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar', className)}>
      <div className="shrink-0 border-b border-sidebar-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t('nodes')}</h2>
          <span className="rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {filteredNodes.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchNodes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-sidebar-border bg-sidebar-accent pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2.5">
          {categories.map((category) => {
            const nodes = groupedNodes[category] || []
            if (nodes.length === 0 && search) return null

            const isExpanded = expandedCategories.has(category)
            const categoryInfo = CATEGORY_INFO[category]
            const categoryLabel = t(categoryInfo.label.toLowerCase() as 'triggers' | 'actions' | 'logic' | 'transform' | 'utility')
            const styles = categoryStyles[category]

            return (
              <div key={category} className="mb-2.5">
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-normal text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span
                    className={cn('w-2 h-2 rounded-full', styles.bg)}
                    style={{ backgroundColor: categoryInfo.color }}
                  />
                  <span className="truncate">{categoryLabel}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{nodes.length}</span>
                </button>

                {isExpanded && (
                  <div className="mt-1 space-y-1">
                    {nodes.map((node) => {
                      const Icon = iconMap[node.icon] || Circle
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, node)}
                          className={cn(
                            'flex cursor-grab items-center gap-2 rounded-md border border-sidebar-border bg-card px-2.5 py-2 active:cursor-grabbing',
                            'transition-colors hover:border-primary/40 hover:bg-accent/70 hover:shadow-sm'
                          )}
                        >
                          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded border', styles.bg, styles.border)}>
                            <Icon className={cn('h-3.5 w-3.5', styles.text)} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-tight text-foreground">
                              {tt(node.label)}
                            </p>
                            <p className="truncate text-[11px] leading-tight text-muted-foreground">
                              {tt(node.description)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
