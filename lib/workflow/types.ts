// Core workflow types for the automation platform

export type NodeCategory = 'trigger' | 'action' | 'logic' | 'transform' | 'utility'

// Global variables
export interface GlobalVariable {
  id: string
  name: string
  value: unknown
  type: 'string' | 'number' | 'boolean' | 'json'
  description?: string
}

export interface NodePosition {
  x: number
  y: number
}

export interface NodeData {
  label: string
  description?: string
  category: NodeCategory
  icon?: string
  config: Record<string, unknown>
  inputs?: NodeInput[]
  outputs?: NodeOutput[]
}

export interface NodeInput {
  id: string
  label: string
  type: 'any' | 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
}

export interface NodeOutput {
  id: string
  label: string
  type: 'any' | 'string' | 'number' | 'boolean' | 'array' | 'object'
}

export interface WorkflowNode {
  id: string
  type: string
  position: NodePosition
  data: NodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Execution types
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface NodeExecutionResult {
  nodeId: string
  status: ExecutionStatus
  input: unknown
  output: unknown
  error?: string
  startTime: string
  endTime?: string
  duration?: number
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  nodeResults: Record<string, NodeExecutionResult>
  error?: string
}

// Node type definitions
export interface NodeTypeDefinition {
  type: string
  label: string
  description: string
  category: NodeCategory
  icon: string
  color: string
  defaultConfig: Record<string, unknown>
  configSchema: ConfigField[]
  inputs: NodeInput[]
  outputs: NodeOutput[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'json' | 'code'
  placeholder?: string
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  required?: boolean
}

// Node type registry
export const NODE_TYPES: Record<string, NodeTypeDefinition> = {
  // Triggers
  'manual-trigger': {
    type: 'manual-trigger',
    label: 'Manual Trigger',
    description: 'Start workflow manually',
    category: 'trigger',
    icon: 'Play',
    color: '#22c55e',
    defaultConfig: {},
    configSchema: [],
    inputs: [],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'webhook-trigger': {
    type: 'webhook-trigger',
    label: 'Webhook',
    description: 'Trigger via HTTP webhook',
    category: 'trigger',
    icon: 'Webhook',
    color: '#22c55e',
    defaultConfig: { method: 'POST' },
    configSchema: [
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
    ],
    inputs: [],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'schedule-trigger': {
    type: 'schedule-trigger',
    label: 'Schedule',
    description: 'Run on a schedule (simulated)',
    category: 'trigger',
    icon: 'Clock',
    color: '#22c55e',
    defaultConfig: { interval: '1h' },
    configSchema: [
      {
        key: 'interval',
        label: 'Interval',
        type: 'select',
        options: [
          { label: 'Every minute', value: '1m' },
          { label: 'Every 5 minutes', value: '5m' },
          { label: 'Every hour', value: '1h' },
          { label: 'Every day', value: '1d' },
        ],
      },
    ],
    inputs: [],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },

  // Actions
  'http-request': {
    type: 'http-request',
    label: 'HTTP Request',
    description: 'Make HTTP requests',
    category: 'action',
    icon: 'Globe',
    color: '#3b82f6',
    defaultConfig: { method: 'GET', url: '', headers: '{}', body: '' },
    configSchema: [
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Content-Type": "application/json"}' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Request body' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Response', type: 'any' }],
  },
  'send-email': {
    type: 'send-email',
    label: 'Send Email',
    description: 'Send an email (simulated)',
    category: 'action',
    icon: 'Mail',
    color: '#3b82f6',
    defaultConfig: { to: '', subject: '', body: '' },
    configSchema: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'email@example.com', required: true },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject', required: true },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email content' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'slack-message': {
    type: 'slack-message',
    label: 'Slack Message',
    description: 'Send a Slack message (simulated)',
    category: 'action',
    icon: 'MessageSquare',
    color: '#3b82f6',
    defaultConfig: { channel: '', message: '' },
    configSchema: [
      { key: 'channel', label: 'Channel', type: 'text', placeholder: '#general', required: true },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Your message', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'code': {
    type: 'code',
    label: 'Code',
    description: 'Run custom JavaScript',
    category: 'action',
    icon: 'Code',
    color: '#3b82f6',
    defaultConfig: { code: '// Access input data via `input`\n// Return your result\nreturn input;' },
    configSchema: [
      { key: 'code', label: 'JavaScript Code', type: 'code', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },

  // Logic
  'if-else': {
    type: 'if-else',
    label: 'If/Else',
    description: 'Conditional branching',
    category: 'logic',
    icon: 'GitBranch',
    color: '#f59e0b',
    defaultConfig: { condition: 'input.value === true' },
    configSchema: [
      { key: 'condition', label: 'Condition (JavaScript)', type: 'code', placeholder: 'input.value === true', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { id: 'true', label: 'True', type: 'any' },
      { id: 'false', label: 'False', type: 'any' },
    ],
  },
  'switch': {
    type: 'switch',
    label: 'Switch',
    description: 'Multiple condition paths',
    category: 'logic',
    icon: 'GitFork',
    color: '#f59e0b',
    defaultConfig: { expression: 'input.type', cases: '["case1", "case2"]' },
    configSchema: [
      { key: 'expression', label: 'Expression', type: 'text', placeholder: 'input.type', required: true },
      { key: 'cases', label: 'Cases (JSON array)', type: 'json', placeholder: '["case1", "case2"]' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { id: 'case0', label: 'Case 1', type: 'any' },
      { id: 'case1', label: 'Case 2', type: 'any' },
      { id: 'default', label: 'Default', type: 'any' },
    ],
  },
  'loop': {
    type: 'loop',
    label: 'Loop',
    description: 'Iterate over array',
    category: 'logic',
    icon: 'Repeat',
    color: '#f59e0b',
    defaultConfig: { arrayPath: 'input' },
    configSchema: [
      { key: 'arrayPath', label: 'Array Path', type: 'text', placeholder: 'input.items', required: true },
    ],
    inputs: [{ id: 'input', label: 'Array', type: 'array' }],
    outputs: [
      { id: 'item', label: 'Item', type: 'any' },
      { id: 'done', label: 'Done', type: 'array' },
    ],
  },
  'merge': {
    type: 'merge',
    label: 'Merge',
    description: 'Merge multiple inputs',
    category: 'logic',
    icon: 'Merge',
    color: '#f59e0b',
    defaultConfig: { mode: 'combine' },
    configSchema: [
      {
        key: 'mode',
        label: 'Merge Mode',
        type: 'select',
        options: [
          { label: 'Combine', value: 'combine' },
          { label: 'Wait All', value: 'waitAll' },
        ],
      },
    ],
    inputs: [
      { id: 'input1', label: 'Input 1', type: 'any' },
      { id: 'input2', label: 'Input 2', type: 'any' },
    ],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },

  // Transform
  'set': {
    type: 'set',
    label: 'Set',
    description: 'Set variables or values',
    category: 'transform',
    icon: 'Variable',
    color: '#8b5cf6',
    defaultConfig: { assignments: '{}' },
    configSchema: [
      { key: 'assignments', label: 'Assignments (JSON)', type: 'json', placeholder: '{"key": "value"}', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'transform': {
    type: 'transform',
    label: 'Transform',
    description: 'Transform data with code',
    category: 'transform',
    icon: 'Wand',
    color: '#8b5cf6',
    defaultConfig: { code: '// Transform input data\nreturn input.map(item => item);' },
    configSchema: [
      { key: 'code', label: 'Transform Code', type: 'code', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'filter': {
    type: 'filter',
    label: 'Filter',
    description: 'Filter array items',
    category: 'transform',
    icon: 'Filter',
    color: '#8b5cf6',
    defaultConfig: { condition: 'item => item.active === true' },
    configSchema: [
      { key: 'condition', label: 'Filter Condition', type: 'code', placeholder: 'item => item.active', required: true },
    ],
    inputs: [{ id: 'input', label: 'Array', type: 'array' }],
    outputs: [{ id: 'output', label: 'Filtered', type: 'array' }],
  },
  'split': {
    type: 'split',
    label: 'Split',
    description: 'Split array into items',
    category: 'transform',
    icon: 'Split',
    color: '#8b5cf6',
    defaultConfig: {},
    configSchema: [],
    inputs: [{ id: 'input', label: 'Array', type: 'array' }],
    outputs: [{ id: 'output', label: 'Items', type: 'any' }],
  },

  // Utility
  'delay': {
    type: 'delay',
    label: 'Delay',
    description: 'Wait for a duration',
    category: 'utility',
    icon: 'Timer',
    color: '#6b7280',
    defaultConfig: { seconds: 1 },
    configSchema: [
      { key: 'seconds', label: 'Seconds', type: 'number', defaultValue: 1, required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'no-op': {
    type: 'no-op',
    label: 'No-Op',
    description: 'Pass through (debugging)',
    category: 'utility',
    icon: 'Circle',
    color: '#6b7280',
    defaultConfig: {},
    configSchema: [],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },

  // AI Nodes
  'openai': {
    type: 'openai',
    label: 'OpenAI',
    description: 'Generate text with OpenAI GPT',
    category: 'action',
    icon: 'Brain',
    color: '#10a37f',
    defaultConfig: { 
      model: 'gpt-4', 
      prompt: '', 
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      maxTokens: 1000
    },
    configSchema: [
      { 
        key: 'model', 
        label: 'Model', 
        type: 'select',
        options: [
          { label: 'GPT-4', value: 'gpt-4' },
          { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        ],
      },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant.' },
      { key: 'prompt', label: 'User Prompt', type: 'textarea', placeholder: 'Enter your prompt...', required: true },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 1000 },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Response', type: 'string' }],
  },
  'anthropic': {
    type: 'anthropic',
    label: 'Claude AI',
    description: 'Generate text with Anthropic Claude',
    category: 'action',
    icon: 'Sparkles',
    color: '#d97706',
    defaultConfig: { 
      model: 'claude-3-opus', 
      prompt: '',
      systemPrompt: '',
      maxTokens: 1000
    },
    configSchema: [
      { 
        key: 'model', 
        label: 'Model', 
        type: 'select',
        options: [
          { label: 'Claude 3 Opus', value: 'claude-3-opus' },
          { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
          { label: 'Claude 3 Haiku', value: 'claude-3-haiku' },
        ],
      },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
      { key: 'prompt', label: 'User Prompt', type: 'textarea', required: true },
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 1000 },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Response', type: 'string' }],
  },

  // Database Nodes
  'postgres-query': {
    type: 'postgres-query',
    label: 'PostgreSQL',
    description: 'Execute PostgreSQL queries',
    category: 'action',
    icon: 'Database',
    color: '#336791',
    defaultConfig: { connectionString: '', query: '', parameters: '[]' },
    configSchema: [
      { key: 'connectionString', label: 'Connection String', type: 'text', placeholder: 'postgresql://user:pass@host:5432/db', required: true },
      { key: 'query', label: 'SQL Query', type: 'code', placeholder: 'SELECT * FROM users WHERE id = $1', required: true },
      { key: 'parameters', label: 'Parameters (JSON array)', type: 'json', placeholder: '[1, "value"]' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Rows', type: 'array' }],
  },
  'mongodb': {
    type: 'mongodb',
    label: 'MongoDB',
    description: 'Query MongoDB collections',
    category: 'action',
    icon: 'Database',
    color: '#47a248',
    defaultConfig: { connectionString: '', collection: '', operation: 'find', query: '{}' },
    configSchema: [
      { key: 'connectionString', label: 'Connection String', type: 'text', required: true },
      { key: 'collection', label: 'Collection', type: 'text', required: true },
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select',
        options: [
          { label: 'Find', value: 'find' },
          { label: 'Find One', value: 'findOne' },
          { label: 'Insert', value: 'insert' },
          { label: 'Update', value: 'update' },
          { label: 'Delete', value: 'delete' },
        ],
      },
      { key: 'query', label: 'Query (JSON)', type: 'json', placeholder: '{"field": "value"}' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'redis': {
    type: 'redis',
    label: 'Redis',
    description: 'Redis operations',
    category: 'action',
    icon: 'Database',
    color: '#dc382d',
    defaultConfig: { connectionString: '', operation: 'get', key: '', value: '' },
    configSchema: [
      { key: 'connectionString', label: 'Connection String', type: 'text', required: true },
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select',
        options: [
          { label: 'GET', value: 'get' },
          { label: 'SET', value: 'set' },
          { label: 'DEL', value: 'del' },
          { label: 'HGET', value: 'hget' },
          { label: 'HSET', value: 'hset' },
        ],
      },
      { key: 'key', label: 'Key', type: 'text', required: true },
      { key: 'value', label: 'Value', type: 'textarea' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },

  // Messaging Nodes
  'discord': {
    type: 'discord',
    label: 'Discord',
    description: 'Send Discord messages',
    category: 'action',
    icon: 'MessageCircle',
    color: '#5865f2',
    defaultConfig: { webhookUrl: '', content: '', username: '', avatarUrl: '' },
    configSchema: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true },
      { key: 'content', label: 'Message Content', type: 'textarea', required: true },
      { key: 'username', label: 'Username (optional)', type: 'text' },
      { key: 'avatarUrl', label: 'Avatar URL (optional)', type: 'text' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'telegram': {
    type: 'telegram',
    label: 'Telegram',
    description: 'Send Telegram messages',
    category: 'action',
    icon: 'Send',
    color: '#0088cc',
    defaultConfig: { botToken: '', chatId: '', message: '', parseMode: 'HTML' },
    configSchema: [
      { key: 'botToken', label: 'Bot Token', type: 'text', required: true },
      { key: 'chatId', label: 'Chat ID', type: 'text', required: true },
      { key: 'message', label: 'Message', type: 'textarea', required: true },
      { 
        key: 'parseMode', 
        label: 'Parse Mode', 
        type: 'select',
        options: [
          { label: 'HTML', value: 'HTML' },
          { label: 'Markdown', value: 'Markdown' },
          { label: 'Plain Text', value: '' },
        ],
      },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'whatsapp': {
    type: 'whatsapp',
    label: 'WhatsApp',
    description: 'Send WhatsApp messages (via API)',
    category: 'action',
    icon: 'Phone',
    color: '#25d366',
    defaultConfig: { apiKey: '', phoneNumber: '', message: '' },
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+1234567890', required: true },
      { key: 'message', label: 'Message', type: 'textarea', required: true },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },

  // Google Services
  'google-sheets': {
    type: 'google-sheets',
    label: 'Google Sheets',
    description: 'Read/write Google Sheets',
    category: 'action',
    icon: 'Table',
    color: '#34a853',
    defaultConfig: { spreadsheetId: '', range: '', operation: 'read', values: '[]' },
    configSchema: [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
      { key: 'range', label: 'Range (e.g., Sheet1!A1:D10)', type: 'text', required: true },
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select',
        options: [
          { label: 'Read', value: 'read' },
          { label: 'Write', value: 'write' },
          { label: 'Append', value: 'append' },
        ],
      },
      { key: 'values', label: 'Values (JSON, for write)', type: 'json', placeholder: '[["A", "B"], ["C", "D"]]' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Data', type: 'any' }],
  },
  'google-drive': {
    type: 'google-drive',
    label: 'Google Drive',
    description: 'Interact with Google Drive',
    category: 'action',
    icon: 'HardDrive',
    color: '#4285f4',
    defaultConfig: { operation: 'list', folderId: '', fileName: '' },
    configSchema: [
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select',
        options: [
          { label: 'List Files', value: 'list' },
          { label: 'Upload File', value: 'upload' },
          { label: 'Download File', value: 'download' },
          { label: 'Delete File', value: 'delete' },
        ],
      },
      { key: 'folderId', label: 'Folder ID', type: 'text' },
      { key: 'fileName', label: 'File Name', type: 'text' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },

  // File & Data
  'csv-parse': {
    type: 'csv-parse',
    label: 'Parse CSV',
    description: 'Parse CSV data',
    category: 'transform',
    icon: 'FileSpreadsheet',
    color: '#8b5cf6',
    defaultConfig: { delimiter: ',', hasHeaders: true },
    configSchema: [
      { key: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',' },
      { key: 'hasHeaders', label: 'Has Headers', type: 'boolean', defaultValue: true },
    ],
    inputs: [{ id: 'input', label: 'CSV String', type: 'string' }],
    outputs: [{ id: 'output', label: 'Data', type: 'array' }],
  },
  'json-parse': {
    type: 'json-parse',
    label: 'Parse JSON',
    description: 'Parse JSON string',
    category: 'transform',
    icon: 'Braces',
    color: '#8b5cf6',
    defaultConfig: { path: '' },
    configSchema: [
      { key: 'path', label: 'JSON Path (optional)', type: 'text', placeholder: 'data.items' },
    ],
    inputs: [{ id: 'input', label: 'JSON String', type: 'string' }],
    outputs: [{ id: 'output', label: 'Object', type: 'any' }],
  },

  // Notification
  'push-notification': {
    type: 'push-notification',
    label: 'Push Notification',
    description: 'Send push notifications',
    category: 'action',
    icon: 'Bell',
    color: '#f97316',
    defaultConfig: { title: '', body: '', url: '' },
    configSchema: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea', required: true },
      { key: 'url', label: 'Click URL (optional)', type: 'text' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
}

// Helper to get nodes by category
export function getNodesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return Object.values(NODE_TYPES).filter((node) => node.category === category)
}

// Category metadata
export const CATEGORY_INFO: Record<NodeCategory, { label: string; color: string }> = {
  trigger: { label: 'Triggers', color: '#22c55e' },
  action: { label: 'Actions', color: '#3b82f6' },
  logic: { label: 'Logic', color: '#f59e0b' },
  transform: { label: 'Transform', color: '#8b5cf6' },
  utility: { label: 'Utility', color: '#6b7280' },
}
