'use client'

import { useState } from 'react'
import { 
  Layout, 
  Mail, 
  MessageSquare, 
  Database, 
  Brain, 
  Clock,
  Webhook,
  FileSpreadsheet,
  Bell,
  Users,
  ShoppingCart,
  BarChart
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkflowStore } from '@/lib/workflow/store'
import type { Workflow } from '@/lib/workflow/types'
import { useI18n } from '@/lib/i18n'

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: React.ElementType
  color: string
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'welcome-email',
    name: 'Welcome Email Sequence',
    description: 'Send automated welcome emails when a new user signs up',
    category: 'Marketing',
    icon: Mail,
    color: '#3b82f6',
    workflow: {
      name: 'Welcome Email Sequence',
      description: 'Automated welcome email workflow',
      nodes: [
        {
          id: 'trigger',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: {
            label: 'New User Signup',
            category: 'trigger',
            config: {
              method: 'POST',
              path: 'new-user-signup',
              samplePayload: '{"user":{"name":"Ada","email":"ada@example.com"},"plan":"starter"}',
            },
          },
        },
        {
          id: 'send-welcome',
          type: 'send-email',
          position: { x: 400, y: 200 },
          data: {
            label: 'Send Welcome Email',
            category: 'action',
            config: {
              from: 'hello@yourcompany.com',
              to: '{{input.data.user.email}}',
              subject: 'Welcome!',
              emailFormat: 'html',
              body: '<h1>Welcome {{input.data.user.name}}</h1><p>Thanks for joining. Your plan is {{input.data.plan}}.</p>',
              attachments: '[]',
            },
          },
        },
        {
          id: 'delay',
          type: 'delay',
          position: { x: 700, y: 200 },
          data: { label: 'Wait 1 Day', category: 'utility', config: { seconds: 86400 } },
        },
        {
          id: 'send-tips',
          type: 'send-email',
          position: { x: 1000, y: 200 },
          data: {
            label: 'Send Tips Email',
            category: 'action',
            config: {
              from: 'hello@yourcompany.com',
              to: '{{input.data.user.email}}',
              subject: 'Quick Tips',
              emailFormat: 'html',
              body: '<p>Hi {{input.data.user.name}}, here are some tips to get started...</p>',
              attachments: '[]',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'send-welcome' },
        { id: 'e2', source: 'send-welcome', target: 'delay' },
        { id: 'e3', source: 'delay', target: 'send-tips' },
      ],
      variables: {},
    },
  },
  {
    id: 'slack-notification',
    name: 'Slack Notification Bot',
    description: 'Send notifications to Slack based on events',
    category: 'Notifications',
    icon: MessageSquare,
    color: '#4a154b',
    workflow: {
      name: 'Slack Notification Bot',
      description: 'Automated Slack notifications',
      nodes: [
        {
          id: 'trigger',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Event Webhook', category: 'trigger', config: { method: 'POST' } },
        },
        {
          id: 'format',
          type: 'transform',
          position: { x: 400, y: 200 },
          data: { label: 'Format Message', category: 'transform', config: { code: 'return { message: `New event: ${input.type}` }' } },
        },
        {
          id: 'send-slack',
          type: 'slack-message',
          position: { x: 700, y: 200 },
          data: { label: 'Send to Slack', category: 'action', config: { channel: '#notifications', message: '{{formatted.message}}' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'format' },
        { id: 'e2', source: 'format', target: 'send-slack' },
      ],
      variables: {},
    },
  },
  {
    id: 'ai-content',
    name: 'AI Content Generator',
    description: 'Generate content using AI and save to database',
    category: 'AI',
    icon: Brain,
    color: '#10a37f',
    workflow: {
      name: 'AI Content Generator',
      description: 'Generate and store AI content',
      nodes: [
        {
          id: 'trigger',
          type: 'manual-trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Start', category: 'trigger', config: {} },
        },
        {
          id: 'set-prompt',
          type: 'set',
          position: { x: 350, y: 200 },
          data: { label: 'Set Prompt', category: 'transform', config: { assignments: '{"prompt": "Write a blog post about AI trends"}' } },
        },
        {
          id: 'generate',
          type: 'openai',
          position: { x: 600, y: 200 },
          data: { label: 'Generate Content', category: 'action', config: { model: 'gpt-4', prompt: '{{input.prompt}}', temperature: 0.7 } },
        },
        {
          id: 'save',
          type: 'postgres-query',
          position: { x: 900, y: 200 },
          data: { label: 'Save to DB', category: 'action', config: { query: 'INSERT INTO content (text) VALUES ($1)', parameters: '[{{output}}]' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'set-prompt' },
        { id: 'e2', source: 'set-prompt', target: 'generate' },
        { id: 'e3', source: 'generate', target: 'save' },
      ],
      variables: {},
    },
  },
  {
    id: 'data-sync',
    name: 'Database Sync',
    description: 'Sync data between databases on a schedule',
    category: 'Data',
    icon: Database,
    color: '#336791',
    workflow: {
      name: 'Database Sync',
      description: 'Scheduled data synchronization',
      nodes: [
        {
          id: 'trigger',
          type: 'schedule-trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Every Hour', category: 'trigger', config: { interval: '1h' } },
        },
        {
          id: 'fetch',
          type: 'postgres-query',
          position: { x: 400, y: 200 },
          data: { label: 'Fetch Source Data', category: 'action', config: { query: 'SELECT * FROM source_table WHERE updated_at > NOW() - INTERVAL 1 HOUR' } },
        },
        {
          id: 'check',
          type: 'if-else',
          position: { x: 700, y: 200 },
          data: { label: 'Has Data?', category: 'logic', config: { condition: 'input.length > 0' } },
        },
        {
          id: 'sync',
          type: 'postgres-query',
          position: { x: 1000, y: 100 },
          data: { label: 'Sync to Target', category: 'action', config: { query: 'INSERT INTO target_table SELECT * FROM $1' } },
        },
        {
          id: 'skip',
          type: 'no-op',
          position: { x: 1000, y: 300 },
          data: { label: 'No Data', category: 'utility', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'fetch' },
        { id: 'e2', source: 'fetch', target: 'check' },
        { id: 'e3', source: 'check', target: 'sync', sourceHandle: 'true' },
        { id: 'e4', source: 'check', target: 'skip', sourceHandle: 'false' },
      ],
      variables: {},
    },
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring',
    description: 'Score and route leads based on criteria',
    category: 'Sales',
    icon: Users,
    color: '#f59e0b',
    workflow: {
      name: 'Lead Scoring',
      description: 'Automated lead scoring and routing',
      nodes: [
        {
          id: 'trigger',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: { label: 'New Lead', category: 'trigger', config: { method: 'POST' } },
        },
        {
          id: 'score',
          type: 'code',
          position: { x: 400, y: 200 },
          data: { label: 'Calculate Score', category: 'action', config: { code: 'let score = 0;\nif (input.company_size > 100) score += 30;\nif (input.budget > 10000) score += 40;\nif (input.industry === "tech") score += 20;\nreturn { ...input, score };' } },
        },
        {
          id: 'route',
          type: 'switch',
          position: { x: 700, y: 200 },
          data: { label: 'Route by Score', category: 'logic', config: { expression: 'input.score >= 70 ? "hot" : input.score >= 40 ? "warm" : "cold"', cases: '["hot", "warm", "cold"]' } },
        },
        {
          id: 'hot-lead',
          type: 'slack-message',
          position: { x: 1000, y: 50 },
          data: { label: 'Alert Sales', category: 'action', config: { channel: '#sales-hot', message: 'Hot lead!' } },
        },
        {
          id: 'warm-lead',
          type: 'send-email',
          position: { x: 1000, y: 200 },
          data: { label: 'Send Nurture', category: 'action', config: { to: '{{input.email}}', subject: 'Learn More', body: '' } },
        },
        {
          id: 'cold-lead',
          type: 'no-op',
          position: { x: 1000, y: 350 },
          data: { label: 'Add to List', category: 'utility', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'score' },
        { id: 'e2', source: 'score', target: 'route' },
        { id: 'e3', source: 'route', target: 'hot-lead', sourceHandle: 'case0' },
        { id: 'e4', source: 'route', target: 'warm-lead', sourceHandle: 'case1' },
        { id: 'e5', source: 'route', target: 'cold-lead', sourceHandle: 'case2' },
      ],
      variables: {},
    },
  },
  {
    id: 'report-generator',
    name: 'Daily Report Generator',
    description: 'Generate and send daily reports',
    category: 'Reporting',
    icon: BarChart,
    color: '#8b5cf6',
    workflow: {
      name: 'Daily Report Generator',
      description: 'Automated daily reporting',
      nodes: [
        {
          id: 'trigger',
          type: 'schedule-trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Daily at 9AM', category: 'trigger', config: { interval: '1d' } },
        },
        {
          id: 'fetch-sales',
          type: 'http-request',
          position: { x: 400, y: 100 },
          data: { label: 'Fetch Sales Data', category: 'action', config: { method: 'GET', url: 'https://api.example.com/sales/daily' } },
        },
        {
          id: 'fetch-users',
          type: 'http-request',
          position: { x: 400, y: 300 },
          data: { label: 'Fetch User Stats', category: 'action', config: { method: 'GET', url: 'https://api.example.com/users/stats' } },
        },
        {
          id: 'merge',
          type: 'merge',
          position: { x: 700, y: 200 },
          data: { label: 'Merge Data', category: 'logic', config: { mode: 'combine' } },
        },
        {
          id: 'format',
          type: 'transform',
          position: { x: 1000, y: 200 },
          data: { label: 'Format Report', category: 'transform', config: { code: 'return { report: `Sales: $${input.sales.total}\\nNew Users: ${input.users.new}` }' } },
        },
        {
          id: 'send',
          type: 'send-email',
          position: { x: 1300, y: 200 },
          data: { label: 'Send Report', category: 'action', config: { to: 'team@company.com', subject: 'Daily Report', body: '{{report}}' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'fetch-sales' },
        { id: 'e2', source: 'trigger', target: 'fetch-users' },
        { id: 'e3', source: 'fetch-sales', target: 'merge' },
        { id: 'e4', source: 'fetch-users', target: 'merge' },
        { id: 'e5', source: 'merge', target: 'format' },
        { id: 'e6', source: 'format', target: 'send' },
      ],
      variables: {},
    },
  },
]

const CATEGORIES = ['All', 'Marketing', 'Notifications', 'AI', 'Data', 'Sales', 'Reporting']
const categoryTranslationKeys: Record<string, 'all' | 'marketing' | 'notifications' | 'ai' | 'data' | 'sales' | 'reporting'> = {
  All: 'all',
  Marketing: 'marketing',
  Notifications: 'notifications',
  AI: 'ai',
  Data: 'data',
  Sales: 'sales',
  Reporting: 'reporting',
}

interface TemplatesGalleryProps {
  onClose?: () => void
}

export function TemplatesGallery({ onClose }: TemplatesGalleryProps) {
  const { t, tt } = useI18n()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const importWorkflow = useWorkflowStore((s) => s.importWorkflow)

  const translateValue = (value: unknown): unknown => {
    if (typeof value === 'string') return tt(value)
    if (Array.isArray(value)) return value.map(translateValue)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, translateValue(item)])
      )
    }
    return value
  }

  const filteredTemplates = selectedCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === selectedCategory)

  const handleUseTemplate = (template: WorkflowTemplate) => {
    const workflow: Workflow = {
      ...template.workflow,
      id: crypto.randomUUID(),
      name: tt(template.workflow.name),
      description: template.workflow.description ? tt(template.workflow.description) : undefined,
      nodes: template.workflow.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          label: tt(node.data.label),
          description: node.data.description ? tt(node.data.description) : undefined,
          config: translateValue(node.data.config) as Record<string, unknown>,
        },
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    importWorkflow(workflow)
    onClose?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {t(categoryTranslationKeys[category])}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${template.color}20` }}
                >
                  <template.icon
                    className="w-5 h-5"
                    style={{ color: template.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{tt(template.name)}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {tt(template.description)}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {t(categoryTranslationKeys[template.category])}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUseTemplate(template)}
                    >
                      {t('useTemplate')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
