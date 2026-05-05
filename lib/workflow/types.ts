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
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'json' | 'code' | 'password'
  placeholder?: string
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  required?: boolean
  visibleWhen?: Record<string, unknown | unknown[]>
}

const authOptions = [
  { label: 'None', value: 'none' },
  { label: 'Predefined Credential', value: 'predefinedCredential' },
  { label: 'Generic OAuth2', value: 'oauth2' },
  { label: 'Header Auth', value: 'headerAuth' },
  { label: 'API Key', value: 'apiKey' },
  { label: 'Basic Auth', value: 'basicAuth' },
]

const credentialField: ConfigField = {
  key: 'credentialId',
  label: 'Credential',
  type: 'text',
  placeholder: 'Optional; uses connected service credential',
}

const simpleOptionsField: ConfigField = {
  key: 'options',
  label: 'Options (JSON)',
  type: 'json',
  placeholder: '{"returnAll": false, "limit": 50}',
}

// Node type registry
export const NODE_TYPES: Record<string, NodeTypeDefinition> = {
  // Triggers
  'manual-trigger': {
    type: 'manual-trigger',
    label: 'Manual Trigger',
    description: 'Start a workflow manually',
    category: 'trigger',
    icon: 'Play',
    color: '#22c55e',
    defaultConfig: { outputData: '{}' },
    configSchema: [
      { key: 'outputData', label: 'Test Output Data (JSON)', type: 'json', placeholder: '{"example": true}' },
    ],
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
    defaultConfig: { method: 'POST', path: '', samplePayload: '{}', responseMode: 'onReceived', responseCode: 200, responseData: 'firstEntryJson' },
    configSchema: [
      { key: 'path', label: 'Path', type: 'text', placeholder: 'my-webhook' },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
      { key: 'samplePayload', label: 'Example Payload (JSON)', type: 'json', placeholder: '{"user":{"email":"ada@example.com","name":"Ada"}}' },
      {
        key: 'responseMode',
        label: 'Respond',
        type: 'select',
        options: [
          { label: 'Immediately', value: 'onReceived' },
          { label: 'When Last Node Finishes', value: 'lastNode' },
          { label: 'Using Respond to Webhook Node', value: 'responseNode' },
        ],
      },
      { key: 'responseCode', label: 'Response Code', type: 'number', defaultValue: 200 },
      {
        key: 'responseData',
        label: 'Response Data',
        type: 'select',
        options: [
          { label: 'First Entry JSON', value: 'firstEntryJson' },
          { label: 'All Entries JSON', value: 'allEntriesJson' },
          { label: 'No Response Body', value: 'noData' },
        ],
      },
      simpleOptionsField,
    ],
    inputs: [],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'schedule-trigger': {
    type: 'schedule-trigger',
    label: 'Schedule',
    description: 'Run on a schedule',
    category: 'trigger',
    icon: 'Clock',
    color: '#22c55e',
    defaultConfig: { triggerType: 'interval', interval: '1h', cronExpression: '0 * * * *', timezone: 'UTC' },
    configSchema: [
      {
        key: 'triggerType',
        label: 'Trigger Type',
        type: 'select',
        options: [
          { label: 'Interval', value: 'interval' },
          { label: 'Cron Expression', value: 'cron' },
          { label: 'Every Day', value: 'everyDay' },
          { label: 'Every Week', value: 'everyWeek' },
          { label: 'Every Month', value: 'everyMonth' },
        ],
      },
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
      { key: 'cronExpression', label: 'Cron Expression', type: 'text', placeholder: '0 * * * *' },
      { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Buenos_Aires' },
    ],
    inputs: [],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },

  // Actions
  'http-request': {
    type: 'http-request',
    label: 'HTTP Request',
    description: 'Make API calls like n8n HTTP Request',
    category: 'action',
    icon: 'Globe',
    color: '#3b82f6',
    defaultConfig: {
      method: 'GET',
      url: '',
      authentication: 'none',
      sendQuery: false,
      queryParameters: '{}',
      sendHeaders: true,
      headers: '{}',
      sendBody: false,
      bodyContentType: 'json',
      body: '',
      options: '{"timeout": 30000, "redirect": true}',
    },
    configSchema: [
      {
        key: 'authentication',
        label: 'Authentication',
        type: 'select',
        options: authOptions,
      },
      credentialField,
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
      { key: 'sendQuery', label: 'Send Query Parameters', type: 'boolean', defaultValue: false },
      { key: 'queryParameters', label: 'Query Parameters (JSON)', type: 'json', placeholder: '{"limit": 10}' },
      { key: 'sendHeaders', label: 'Send Headers', type: 'boolean', defaultValue: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Content-Type": "application/json"}' },
      { key: 'sendBody', label: 'Send Body', type: 'boolean', defaultValue: false },
      {
        key: 'bodyContentType',
        label: 'Body Content Type',
        type: 'select',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'Form URL Encoded', value: 'formUrlencoded' },
          { label: 'Multipart Form Data', value: 'multipartFormData' },
          { label: 'Raw', value: 'raw' },
          { label: 'Binary File', value: 'binary' },
        ],
      },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Request body' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Response', type: 'any' }],
  },
  'respond-to-webhook': {
    type: 'respond-to-webhook',
    label: 'Respond to Webhook',
    description: 'Return a custom response for Webhook triggers',
    category: 'action',
    icon: 'Reply',
    color: '#3b82f6',
    defaultConfig: { responseCode: 200, responseHeaders: '{}', responseBody: '{{ $json }}' },
    configSchema: [
      { key: 'responseCode', label: 'Response Code', type: 'number', defaultValue: 200 },
      { key: 'responseHeaders', label: 'Response Headers (JSON)', type: 'json', placeholder: '{"Content-Type":"application/json"}' },
      { key: 'responseBody', label: 'Response Body', type: 'textarea', placeholder: '{{ $json }}' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'send-email': {
    type: 'send-email',
    label: 'Email Send',
    description: 'Send email with SMTP-style options',
    category: 'action',
    icon: 'Mail',
    color: '#3b82f6',
    defaultConfig: { credentialId: '', from: '', to: '', cc: '', bcc: '', subject: '', emailFormat: 'html', body: '', attachments: '[]' },
    configSchema: [
      credentialField,
      { key: 'from', label: 'From Email', type: 'text', placeholder: 'from@example.com' },
      { key: 'to', label: 'To', type: 'text', placeholder: 'email@example.com', required: true },
      { key: 'cc', label: 'CC', type: 'text' },
      { key: 'bcc', label: 'BCC', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject', required: true },
      {
        key: 'emailFormat',
        label: 'Email Format',
        type: 'select',
        options: [
          { label: 'HTML', value: 'html' },
          { label: 'Text', value: 'text' },
        ],
      },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email content' },
      { key: 'attachments', label: 'Attachments (JSON)', type: 'json', placeholder: '[{"fieldName":"data"}]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'slack-message': {
    type: 'slack-message',
    label: 'Slack',
    description: 'Slack channel, message, and user operations',
    category: 'action',
    icon: 'MessageSquare',
    color: '#3b82f6',
    defaultConfig: { credentialId: '', resource: 'message', operation: 'post', channel: '', message: '', blocks: '[]', userId: '' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Message', value: 'message' },
          { label: 'Channel', value: 'channel' },
          { label: 'User', value: 'user' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Post Message', value: 'post' },
          { label: 'Update Message', value: 'update' },
          { label: 'Delete Message', value: 'delete' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Invite User', value: 'invite' },
        ],
      },
      { key: 'channel', label: 'Channel', type: 'text', placeholder: '#general', required: true },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Your message', required: true },
      { key: 'blocks', label: 'Blocks (JSON)', type: 'json', placeholder: '[{"type":"section","text":{"type":"mrkdwn","text":"Hello"}}]' },
      { key: 'userId', label: 'User ID', type: 'text' },
      simpleOptionsField,
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
    label: 'If',
    description: 'Split data with n8n-style comparison conditions',
    category: 'logic',
    icon: 'GitBranch',
    color: '#f59e0b',
    defaultConfig: { mode: 'conditions', combinator: 'and', conditions: '[{"left":"input.value","operation":"equals","right":true}]', condition: 'input.value === true' },
    configSchema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Conditions', value: 'conditions' },
          { label: 'Expression', value: 'expression' },
        ],
      },
      {
        key: 'combinator',
        label: 'Combine Conditions',
        type: 'select',
        options: [
          { label: 'All must match (AND)', value: 'and' },
          { label: 'Any can match (OR)', value: 'or' },
        ],
      },
      { key: 'conditions', label: 'Conditions (JSON)', type: 'json', placeholder: '[{"left":"input.status","operation":"equals","right":"active"}]' },
      { key: 'condition', label: 'Expression (JavaScript)', type: 'code', placeholder: 'input.value === true', required: true },
      { key: 'looseTypeValidation', label: 'Less Strict Type Validation', type: 'boolean', defaultValue: true },
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
    defaultConfig: { mode: 'rules', expression: 'input.type', rules: '[{"left":"input.type","operation":"equals","right":"case1","output":0}]', cases: '["case1", "case2"]', fallbackOutput: 'default' },
    configSchema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Rules', value: 'rules' },
          { label: 'Expression', value: 'expression' },
        ],
      },
      { key: 'rules', label: 'Rules (JSON)', type: 'json', placeholder: '[{"left":"input.type","operation":"equals","right":"invoice","output":0}]' },
      { key: 'expression', label: 'Expression', type: 'text', placeholder: 'input.type', required: true },
      { key: 'cases', label: 'Cases (JSON array)', type: 'json', placeholder: '["case1", "case2"]' },
      {
        key: 'fallbackOutput',
        label: 'Fallback Output',
        type: 'select',
        options: [
          { label: 'Default Output', value: 'default' },
          { label: 'None', value: 'none' },
        ],
      },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { id: 'case0', label: 'Case 1', type: 'any' },
      { id: 'case1', label: 'Case 2', type: 'any' },
      { id: 'default', label: 'Default', type: 'any' },
    ],
  },
  'route': {
    type: 'route',
    label: 'Route',
    description: 'Send one input into one of three named routes',
    category: 'logic',
    icon: 'Route',
    color: '#f59e0b',
    defaultConfig: {
      mode: 'rules',
      route1Label: 'Route 1',
      route2Label: 'Route 2',
      route3Label: 'Route 3',
      rules: '[{"route":"route1","condition":"input.type === \\"sales\\""},{"route":"route2","condition":"input.type === \\"support\\""}]',
      fallbackRoute: 'route3',
    },
    configSchema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Rules', value: 'rules' },
          { label: 'Route Field Value', value: 'field' },
        ],
      },
      { key: 'route1Label', label: 'Route 1 Label', type: 'text', placeholder: 'Sales' },
      { key: 'route2Label', label: 'Route 2 Label', type: 'text', placeholder: 'Support' },
      { key: 'route3Label', label: 'Route 3 Label', type: 'text', placeholder: 'Other' },
      { key: 'routeField', label: 'Route Field Expression', type: 'text', placeholder: 'input.route' },
      { key: 'rules', label: 'Rules (JSON)', type: 'json', placeholder: '[{"route":"route1","condition":"input.type === \\"sales\\""}]' },
      {
        key: 'fallbackRoute',
        label: 'Fallback Route',
        type: 'select',
        options: [
          { label: 'Route 1', value: 'route1' },
          { label: 'Route 2', value: 'route2' },
          { label: 'Route 3', value: 'route3' },
          { label: 'None', value: 'none' },
        ],
      },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { id: 'route1', label: 'Route 1', type: 'any' },
      { id: 'route2', label: 'Route 2', type: 'any' },
      { id: 'route3', label: 'Route 3', type: 'any' },
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
    defaultConfig: { mode: 'append', combineBy: 'position', joinMode: 'keepMatches', clashHandling: 'preferInput2' },
    configSchema: [
      {
        key: 'mode',
        label: 'Merge Mode',
        type: 'select',
        options: [
          { label: 'Append', value: 'append' },
          { label: 'Combine', value: 'combine' },
          { label: 'SQL Query', value: 'sqlQuery' },
          { label: 'Choose Branch', value: 'chooseBranch' },
        ],
      },
      {
        key: 'combineBy',
        label: 'Combine By',
        type: 'select',
        options: [
          { label: 'Matching Fields', value: 'matchingFields' },
          { label: 'Position', value: 'position' },
          { label: 'All Possible Combinations', value: 'allCombinations' },
        ],
      },
      {
        key: 'joinMode',
        label: 'Join Mode',
        type: 'select',
        options: [
          { label: 'Keep Matches', value: 'keepMatches' },
          { label: 'Keep Non-Matches', value: 'keepNonMatches' },
          { label: 'Keep Everything', value: 'keepEverything' },
        ],
      },
      { key: 'matchingFields', label: 'Matching Fields (JSON array)', type: 'json', placeholder: '["id"]' },
      {
        key: 'clashHandling',
        label: 'Clash Handling',
        type: 'select',
        options: [
          { label: 'Prefer Input 1', value: 'preferInput1' },
          { label: 'Prefer Input 2', value: 'preferInput2' },
          { label: 'Keep Both', value: 'keepBoth' },
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
    label: 'Edit Fields (Set)',
    description: 'Add, update, include, or remove item fields',
    category: 'transform',
    icon: 'Variable',
    color: '#8b5cf6',
    defaultConfig: { mode: 'manual', assignments: '{}', includeOtherFields: true, fieldsToKeep: '[]', fieldsToRemove: '[]' },
    configSchema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Manual Mapping', value: 'manual' },
          { label: 'JSON Output', value: 'json' },
        ],
      },
      { key: 'assignments', label: 'Fields to Set (JSON)', type: 'json', placeholder: '{"key": "value"}', required: true },
      { key: 'includeOtherFields', label: 'Include Other Input Fields', type: 'boolean', defaultValue: true },
      { key: 'fieldsToKeep', label: 'Fields to Keep (JSON array)', type: 'json', placeholder: '["id","name"]' },
      { key: 'fieldsToRemove', label: 'Fields to Remove (JSON array)', type: 'json', placeholder: '["password"]' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'transform': {
    type: 'transform',
    label: 'Item Lists',
    description: 'Sort, limit, aggregate, split, or summarize items',
    category: 'transform',
    icon: 'ListFilter',
    color: '#8b5cf6',
    defaultConfig: { operation: 'sort', field: '', order: 'ascending', limit: 10, aggregateFields: '[]', code: '// Transform input data\nreturn input;' },
    configSchema: [
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Sort', value: 'sort' },
          { label: 'Limit', value: 'limit' },
          { label: 'Aggregate', value: 'aggregate' },
          { label: 'Split Out Items', value: 'splitOutItems' },
          { label: 'Remove Duplicates', value: 'removeDuplicates' },
          { label: 'Custom Code', value: 'customCode' },
        ],
      },
      { key: 'field', label: 'Field', type: 'text', placeholder: 'id' },
      {
        key: 'order',
        label: 'Order',
        type: 'select',
        options: [
          { label: 'Ascending', value: 'ascending' },
          { label: 'Descending', value: 'descending' },
        ],
      },
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 10 },
      { key: 'aggregateFields', label: 'Aggregate Fields (JSON)', type: 'json', placeholder: '["amount"]' },
      { key: 'code', label: 'Custom Code', type: 'code' },
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
    label: 'Wait',
    description: 'Wait by interval, until date, or for webhook call',
    category: 'utility',
    icon: 'Timer',
    color: '#6b7280',
    defaultConfig: { mode: 'timeInterval', seconds: 1, resumeAt: '', webhookSuffix: '' },
    configSchema: [
      {
        key: 'mode',
        label: 'Resume',
        type: 'select',
        options: [
          { label: 'After Time Interval', value: 'timeInterval' },
          { label: 'At Specified Time', value: 'specificTime' },
          { label: 'On Webhook Call', value: 'webhook' },
        ],
      },
      { key: 'seconds', label: 'Seconds', type: 'number', defaultValue: 1, required: true },
      { key: 'resumeAt', label: 'Resume At', type: 'text', placeholder: '2026-05-02T12:00:00Z' },
      { key: 'webhookSuffix', label: 'Webhook Suffix', type: 'text' },
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
  'stop-and-error': {
    type: 'stop-and-error',
    label: 'Stop and Error',
    description: 'Stop workflow execution with a custom error',
    category: 'utility',
    icon: 'OctagonX',
    color: '#ef4444',
    defaultConfig: { errorMessage: 'Workflow stopped by Stop and Error node' },
    configSchema: [
      { key: 'errorMessage', label: 'Error Message', type: 'textarea', required: true },
    ],
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
  'mysql': {
    type: 'mysql',
    label: 'MySQL',
    description: 'Execute MySQL queries',
    category: 'action',
    icon: 'Database',
    color: '#00758f',
    defaultConfig: { credentialId: '', operation: 'executeQuery', query: '', parameters: '[]' },
    configSchema: [
      credentialField,
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Execute Query', value: 'executeQuery' },
          { label: 'Insert', value: 'insert' },
          { label: 'Update', value: 'update' },
          { label: 'Delete', value: 'delete' },
          { label: 'Select', value: 'select' },
        ],
      },
      { key: 'query', label: 'SQL Query', type: 'code', placeholder: 'SELECT * FROM users' },
      { key: 'parameters', label: 'Parameters (JSON array)', type: 'json', placeholder: '[]' },
      simpleOptionsField,
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
  'gmail': {
    type: 'gmail',
    label: 'Gmail',
    description: 'Send, draft, reply, get, and search Gmail messages',
    category: 'action',
    icon: 'Mail',
    color: '#ea4335',
    defaultConfig: { credentialId: '', resource: 'message', operation: 'send', from: '', to: '', cc: '', bcc: '', subject: '', emailFormat: 'html', message: '', messageId: '', labels: '[]', attachments: '[]', options: '{"limit": 10}' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Message', value: 'message' },
          { label: 'Draft', value: 'draft' },
          { label: 'Label', value: 'label' },
          { label: 'Thread', value: 'thread' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Send', value: 'send' },
          { label: 'Create Draft', value: 'createDraft' },
          { label: 'Get', value: 'get' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Reply', value: 'reply' },
          { label: 'Delete', value: 'delete' },
          { label: 'Add Label', value: 'addLabel' },
        ],
      },
      { key: 'from', label: 'From Email', type: 'text', placeholder: 'from@example.com' },
      { key: 'to', label: 'To', type: 'text', placeholder: 'person@example.com' },
      { key: 'cc', label: 'CC', type: 'text' },
      { key: 'bcc', label: 'BCC', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
      {
        key: 'emailFormat',
        label: 'Email Format',
        type: 'select',
        options: [
          { label: 'HTML', value: 'html' },
          { label: 'Text', value: 'text' },
        ],
      },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Email content' },
      { key: 'messageId', label: 'Message ID', type: 'text' },
      { key: 'labels', label: 'Labels (JSON array)', type: 'json', placeholder: '["INBOX"]' },
      { key: 'attachments', label: 'Attachments (JSON)', type: 'json', placeholder: '[]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'google-calendar': {
    type: 'google-calendar',
    label: 'Google Calendar',
    description: 'Create, update, delete, and list calendar events',
    category: 'action',
    icon: 'CalendarDays',
    color: '#4285f4',
    defaultConfig: { credentialId: '', resource: 'event', operation: 'create', calendarId: 'primary', eventId: '', summary: '', description: '', location: '', start: '', end: '', attendees: '[]', options: '{"timeZone":"America/Argentina/Buenos_Aires"}' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Event', value: 'event' },
          { label: 'Calendar', value: 'calendar' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Delete', value: 'delete' },
          { label: 'Get', value: 'get' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Update', value: 'update' },
          { label: 'Availability', value: 'availability' },
        ],
      },
      { key: 'calendarId', label: 'Calendar', type: 'text', placeholder: 'primary' },
      { key: 'eventId', label: 'Event ID', type: 'text' },
      { key: 'summary', label: 'Summary', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'start', label: 'Start', type: 'text', placeholder: '2026-05-02T10:00:00-03:00' },
      { key: 'end', label: 'End', type: 'text', placeholder: '2026-05-02T11:00:00-03:00' },
      { key: 'attendees', label: 'Attendees (JSON array)', type: 'json', placeholder: '["person@example.com"]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },

  // Google Services
  'google-sheets': {
    type: 'google-sheets',
    label: 'Google Sheets',
    description: 'Create, read, write, and append Google Sheets',
    category: 'action',
    icon: 'Table',
    color: '#34a853',
    defaultConfig: {
      credentialId: '',
      inputSource: 'id',
      spreadsheetId: '',
      fileUrl: '',
      fileId: '',
      title: '',
      sheets: '[]',
      sheetName: '',
      range: '',
      operation: 'read',
      values: '[]',
      columns: '{}',
      options: '{}',
    },
    configSchema: [
      credentialField,
      {
        key: 'inputSource',
        label: 'Read Source',
        type: 'select',
        options: [
          { label: 'Spreadsheet ID', value: 'id' },
          { label: 'Google / Drive Link', value: 'url' },
          { label: 'Incoming Input', value: 'input' },
        ],
        visibleWhen: { operation: 'read' },
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create Spreadsheet', value: 'create' },
          { label: 'Create Sheet Tab', value: 'createSheet' },
          { label: 'Read Sheet / File', value: 'read' },
          { label: 'Add Row(s)', value: 'append' },
          { label: 'Replace Range', value: 'write' },
          { label: 'Update Range', value: 'update' },
        ],
      },
      {
        key: 'spreadsheetId',
        label: 'Spreadsheet ID',
        type: 'text',
        placeholder: 'Required for create tab, add rows, replace range, or update range',
        visibleWhen: { operation: ['createSheet', 'append', 'write', 'update'] },
      },
      {
        key: 'fileUrl',
        label: 'Google Sheet / CSV / XLSX Link',
        type: 'text',
        placeholder: 'https://docs.google.com/spreadsheets/d/... or Drive file link',
        visibleWhen: { operation: 'read', inputSource: 'url' },
      },
      {
        key: 'fileId',
        label: 'Drive File ID',
        type: 'text',
        placeholder: 'Optional alternative to the link',
        visibleWhen: { operation: 'read', inputSource: 'url' },
      },
      {
        key: 'title',
        label: 'New Spreadsheet Title',
        type: 'text',
        placeholder: 'Example: Leads Import Test',
        visibleWhen: { operation: ['create', 'createSheet'] },
      },
      {
        key: 'sheets',
        label: 'Sheet Tabs (JSON array)',
        type: 'json',
        placeholder: '["Sheet1", "Customers"]',
        visibleWhen: { operation: ['create', 'createSheet'] },
      },
      {
        key: 'sheetName',
        label: 'Single Sheet Tab Name',
        type: 'text',
        placeholder: 'Use this if you only want to create one tab',
        visibleWhen: { operation: 'createSheet' },
      },
      {
        key: 'range',
        label: 'Range',
        type: 'text',
        placeholder: 'Examples: Sheet1!A:Z or Customers!A1:D200',
        visibleWhen: { operation: ['read', 'append', 'write', 'update'] },
      },
      {
        key: 'columns',
        label: 'Columns / Mapping (JSON)',
        type: 'json',
        placeholder: '{"Name":"{{$json.name}}","Email":"{{$json.email}}"}',
        visibleWhen: { operation: 'append' },
      },
      {
        key: 'values',
        label: 'Values (JSON array)',
        type: 'json',
        placeholder: '[["Name", "Email"], ["Ada", "ada@example.com"]]',
        visibleWhen: { operation: ['append', 'write', 'update'] },
      },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Data', type: 'any' }],
  },
  'google-drive': {
    type: 'google-drive',
    label: 'Google Drive',
    description: 'Create, upload, download, list, and delete Drive files',
    category: 'action',
    icon: 'HardDrive',
    color: '#4285f4',
    defaultConfig: {
      credentialId: '',
      resource: 'file',
      operation: 'list',
      inputSource: 'fields',
      fileUrl: '',
      folderId: '',
      fileId: '',
      driveId: '',
      fileName: '',
      mimeType: 'application/json',
      outputFormat: 'metadata',
      includeContent: false,
      content: '{}',
      query: '',
    },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'File', value: 'file' },
          { label: 'Folder', value: 'folder' },
          { label: 'File/Folder Search', value: 'fileFolder' },
          { label: 'Shared Drive', value: 'drive' },
        ],
      },
      {
        key: 'inputSource',
        label: 'Input Source',
        type: 'select',
        options: [
          { label: 'Manual Fields', value: 'fields' },
          { label: 'Drive / Docs / Sheets / Slides Link', value: 'url' },
          { label: 'Use Input URL or ID', value: 'input' },
        ],
      },
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select',
        options: [
          { label: 'Copy File', value: 'copy' },
          { label: 'Create File', value: 'create' },
          { label: 'Create From Text', value: 'createFromText' },
          { label: 'Create Folder', value: 'createFolder' },
          { label: 'List Files', value: 'list' },
          { label: 'Read Link / Get Metadata', value: 'readLink' },
          { label: 'Get File Metadata', value: 'get' },
          { label: 'Upload File', value: 'upload' },
          { label: 'Download File', value: 'download' },
          { label: 'Move File', value: 'move' },
          { label: 'Search', value: 'search' },
          { label: 'Share File', value: 'share' },
          { label: 'Delete File', value: 'delete' },
        ],
      },
      { key: 'driveId', label: 'Drive', type: 'text' },
      { key: 'folderId', label: 'Folder ID', type: 'text' },
      { key: 'fileId', label: 'File ID', type: 'text' },
      { key: 'fileUrl', label: 'Drive / Docs / Sheets / Slides Link', type: 'text', placeholder: 'https://docs.google.com/document/d/...' },
      { key: 'fileName', label: 'File Name', type: 'text' },
      { 
        key: 'mimeType', 
        label: 'File Type', 
        type: 'select',
        options: [
          { label: 'JSON', value: 'application/json' },
          { label: 'Google Doc', value: 'application/vnd.google-apps.document' },
          { label: 'Google Sheet', value: 'application/vnd.google-apps.spreadsheet' },
          { label: 'Google Slides / PPT', value: 'application/vnd.google-apps.presentation' },
          { label: 'Text', value: 'text/plain' },
          { label: 'CSV', value: 'text/csv' },
        ],
      },
      {
        key: 'outputFormat',
        label: 'Output Format',
        type: 'select',
        options: [
          { label: 'Metadata Only', value: 'metadata' },
          { label: 'Plain Text', value: 'text' },
          { label: 'CSV', value: 'csv' },
          { label: 'JSON', value: 'json' },
        ],
      },
      { key: 'includeContent', label: 'Include Content When Possible', type: 'boolean', defaultValue: false },
      { key: 'query', label: 'Search Query', type: 'text' },
      { key: 'content', label: 'Content / Metadata (JSON or text)', type: 'textarea', placeholder: '{"rows": []}' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'airtable': {
    type: 'airtable',
    label: 'Airtable',
    description: 'Create, read, update, delete, and search Airtable records',
    category: 'action',
    icon: 'Table2',
    color: '#18bfff',
    defaultConfig: { credentialId: '', resource: 'record', operation: 'search', baseId: '', tableId: '', recordId: '', fields: '{}', filterByFormula: '' },
    configSchema: [
      credentialField,
      { key: 'baseId', label: 'Base', type: 'text', required: true },
      { key: 'tableId', label: 'Table', type: 'text', required: true },
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Record', value: 'record' },
          { label: 'Base', value: 'base' },
          { label: 'Table', value: 'table' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Delete', value: 'delete' },
          { label: 'Get', value: 'get' },
          { label: 'Search', value: 'search' },
          { label: 'Update', value: 'update' },
          { label: 'Upsert', value: 'upsert' },
        ],
      },
      { key: 'recordId', label: 'Record ID', type: 'text' },
      { key: 'fields', label: 'Fields (JSON)', type: 'json', placeholder: '{"Name":"Example"}' },
      { key: 'filterByFormula', label: 'Filter By Formula', type: 'text' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'notion': {
    type: 'notion',
    label: 'Notion',
    description: 'Work with Notion databases, pages, and blocks',
    category: 'action',
    icon: 'BookOpen',
    color: '#ffffff',
    defaultConfig: { credentialId: '', resource: 'page', operation: 'create', databaseId: '', pageId: '', properties: '{}', content: '' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Page', value: 'page' },
          { label: 'Database', value: 'database' },
          { label: 'Block', value: 'block' },
          { label: 'User', value: 'user' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Get', value: 'get' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Search', value: 'search' },
          { label: 'Update', value: 'update' },
          { label: 'Archive', value: 'archive' },
        ],
      },
      { key: 'databaseId', label: 'Database ID', type: 'text' },
      { key: 'pageId', label: 'Page ID', type: 'text' },
      { key: 'properties', label: 'Properties (JSON)', type: 'json', placeholder: '{"Name":{"title":[{"text":{"content":"Task"}}]}}' },
      { key: 'content', label: 'Content', type: 'textarea' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'google-docs': {
    type: 'google-docs',
    label: 'Google Docs',
    description: 'Create and update Google Docs',
    category: 'action',
    icon: 'FileText',
    color: '#4285f4',
    defaultConfig: { credentialId: '', resource: 'document', operation: 'create', documentId: '', title: '', content: '', actionsUi: '[]' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Document', value: 'document' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create Document', value: 'create' },
          { label: 'Get Document', value: 'get' },
          { label: 'Update Document', value: 'update' },
        ],
      },
      { key: 'documentId', label: 'Document ID', type: 'text', placeholder: 'Required for append/replace/export' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'New document title' },
      { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Document body or template text' },
      { key: 'actionsUi', label: 'Update Actions (JSON)', type: 'json', placeholder: '[{"action":"insert","text":"Hello"}]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Document', type: 'any' }],
  },
  'google-slides': {
    type: 'google-slides',
    label: 'Google Slides / PPT',
    description: 'Create and update presentations',
    category: 'action',
    icon: 'Presentation',
    color: '#fbbc04',
    defaultConfig: { credentialId: '', resource: 'presentation', operation: 'create', presentationId: '', title: '', slides: '[]', replaceTextUi: '[]' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Presentation', value: 'presentation' },
          { label: 'Slide', value: 'slide' },
          { label: 'Page Element', value: 'pageElement' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create Presentation', value: 'create' },
          { label: 'Get Presentation', value: 'get' },
          { label: 'Add Slides', value: 'addSlides' },
          { label: 'Replace Text', value: 'replaceText' },
          { label: 'Export PPTX', value: 'exportPptx' },
        ],
      },
      { key: 'presentationId', label: 'Presentation ID', type: 'text', placeholder: 'Required for update/export' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'New presentation title' },
      { key: 'slides', label: 'Slides (JSON array)', type: 'json', placeholder: '[{"title":"Intro","body":"Hello"}]' },
      { key: 'replaceTextUi', label: 'Text Replacements (JSON)', type: 'json', placeholder: '[{"match":"{{name}}","replace":"Ada"}]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Presentation', type: 'any' }],
  },

  // File & Data
  'json-create': {
    type: 'json-create',
    label: 'Create JSON',
    description: 'Build JSON files or objects from workflow data',
    category: 'transform',
    icon: 'Braces',
    color: '#8b5cf6',
    defaultConfig: { fileName: 'data.json', mode: 'object', data: '{}' },
    configSchema: [
      { key: 'fileName', label: 'File Name', type: 'text', placeholder: 'data.json' },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Object', value: 'object' },
          { label: 'Array', value: 'array' },
          { label: 'Merge With Input', value: 'merge' },
        ],
      },
      { key: 'data', label: 'JSON Data', type: 'json', placeholder: '{"key": "value"}' },
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'JSON', type: 'any' }],
  },
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
  'xml': {
    type: 'xml',
    label: 'XML',
    description: 'Convert XML to JSON or JSON to XML',
    category: 'transform',
    icon: 'FileCode2',
    color: '#8b5cf6',
    defaultConfig: { mode: 'xmlToJson', dataPropertyName: 'data', options: '{}' },
    configSchema: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'XML to JSON', value: 'xmlToJson' },
          { label: 'JSON to XML', value: 'jsonToXml' },
        ],
      },
      { key: 'dataPropertyName', label: 'Data Property Name', type: 'text', placeholder: 'data' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  'html': {
    type: 'html',
    label: 'HTML',
    description: 'Extract data from HTML',
    category: 'transform',
    icon: 'FileCode2',
    color: '#8b5cf6',
    defaultConfig: { operation: 'extractHtmlContent', sourceData: 'json', dataPropertyName: 'data', extractionValues: '[]' },
    configSchema: [
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Extract HTML Content', value: 'extractHtmlContent' },
          { label: 'Generate HTML Template', value: 'generateHtmlTemplate' },
        ],
      },
      { key: 'dataPropertyName', label: 'Data Property Name', type: 'text', placeholder: 'data' },
      { key: 'extractionValues', label: 'Extraction Values (JSON)', type: 'json', placeholder: '[{"key":"title","cssSelector":"h1"}]' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
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
  'github': {
    type: 'github',
    label: 'GitHub',
    description: 'Repository, issue, PR, release, and file operations',
    category: 'action',
    icon: 'Github',
    color: '#6b7280',
    defaultConfig: { credentialId: '', resource: 'issue', operation: 'create', owner: '', repository: '', issueNumber: '', title: '', body: '', filePath: '' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Issue', value: 'issue' },
          { label: 'Pull Request', value: 'pullRequest' },
          { label: 'Repository', value: 'repository' },
          { label: 'Release', value: 'release' },
          { label: 'File', value: 'file' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Get', value: 'get' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Update', value: 'update' },
          { label: 'Delete', value: 'delete' },
          { label: 'Merge', value: 'merge' },
        ],
      },
      { key: 'owner', label: 'Owner', type: 'text' },
      { key: 'repository', label: 'Repository', type: 'text' },
      { key: 'issueNumber', label: 'Issue / PR Number', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'filePath', label: 'File Path', type: 'text' },
      simpleOptionsField,
    ],
    inputs: [{ id: 'input', label: 'Input', type: 'any' }],
    outputs: [{ id: 'output', label: 'Result', type: 'any' }],
  },
  'stripe': {
    type: 'stripe',
    label: 'Stripe',
    description: 'Customer, charge, payment, invoice, and subscription operations',
    category: 'action',
    icon: 'CreditCard',
    color: '#635bff',
    defaultConfig: { credentialId: '', resource: 'customer', operation: 'create', customerId: '', amount: 0, currency: 'usd', metadata: '{}' },
    configSchema: [
      credentialField,
      {
        key: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { label: 'Customer', value: 'customer' },
          { label: 'Charge', value: 'charge' },
          { label: 'Payment Intent', value: 'paymentIntent' },
          { label: 'Invoice', value: 'invoice' },
          { label: 'Subscription', value: 'subscription' },
        ],
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Get', value: 'get' },
          { label: 'Get Many', value: 'getMany' },
          { label: 'Update', value: 'update' },
          { label: 'Delete', value: 'delete' },
          { label: 'Cancel', value: 'cancel' },
        ],
      },
      { key: 'customerId', label: 'Customer ID', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'number', defaultValue: 0 },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'usd' },
      { key: 'metadata', label: 'Metadata (JSON)', type: 'json', placeholder: '{}' },
      simpleOptionsField,
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
