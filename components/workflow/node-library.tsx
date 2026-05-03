'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { NODE_TYPES, CATEGORY_INFO, type NodeCategory, type NodeTypeDefinition } from '@/lib/workflow/types'
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
  Search,
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
      label: nodeType.label,
      category: nodeType.category,
    }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredNodes = Object.values(NODE_TYPES).filter(
    (node) =>
      node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.description.toLowerCase().includes(search.toLowerCase())
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
    <div className={cn('flex flex-col h-full bg-sidebar border-r border-sidebar-border', className)}>
      <div className="p-3 border-b border-sidebar-border">
        <h2 className="text-sm font-semibold text-foreground mb-3">Nodes</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-sidebar-accent border-sidebar-border"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {categories.map((category) => {
            const nodes = groupedNodes[category] || []
            if (nodes.length === 0 && search) return null

            const isExpanded = expandedCategories.has(category)
            const categoryInfo = CATEGORY_INFO[category]
            const styles = categoryStyles[category]

            return (
              <div key={category} className="mb-2">
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-foreground hover:bg-sidebar-accent rounded transition-colors"
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
                  {categoryInfo.label}
                  <span className="ml-auto text-xs text-muted-foreground">{nodes.length}</span>
                </button>

                {isExpanded && (
                  <div className="mt-1 ml-2 space-y-1">
                    {nodes.map((node) => {
                      const Icon = iconMap[node.icon] || Circle
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, node)}
                          className={cn(
                            'flex items-center gap-2 px-2 py-2 rounded-md border cursor-grab active:cursor-grabbing',
                            'hover:bg-accent/50 transition-colors',
                            styles.bg,
                            styles.border
                          )}
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', styles.text)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {node.label}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {node.description}
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
