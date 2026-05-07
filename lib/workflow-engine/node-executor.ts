import type { Workflow, WorkflowNode } from '@/lib/workflow/types'
import type { WorkflowEngineContext } from './types'

function parseJsonConfig(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  return JSON.parse(value)
}

function readPath(source: unknown, path: string): unknown {
  if (!path || path === '.') return source
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)]
    if (typeof current === 'object') return (current as Record<string, unknown>)[key]
    return undefined
  }, source)
}

function stringifyTemplateValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function resolveTemplateExpression(expression: string, input: unknown, workflow: Workflow) {
  const trimmed = expression.trim()
  if (trimmed === 'input') return input
  if (trimmed.startsWith('input.')) return readPath(input, trimmed.slice('input.'.length))
  if (trimmed === '$json') return input
  if (trimmed.startsWith('$json.')) return readPath(input, trimmed.slice('$json.'.length))
  if (trimmed === 'variables') return workflow.variables
  if (trimmed.startsWith('variables.')) return readPath(workflow.variables, trimmed.slice('variables.'.length))
  return undefined
}

function resolveTemplates(value: unknown, input: unknown, workflow: Workflow): unknown {
  if (typeof value === 'string') {
    const exactMatch = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/)
    if (exactMatch) {
      const resolved = resolveTemplateExpression(exactMatch[1], input, workflow)
      return resolved === undefined ? value : resolved
    }

    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression: string) => {
      const resolved = resolveTemplateExpression(expression, input, workflow)
      return resolved === undefined ? `{{${expression}}}` : stringifyTemplateValue(resolved)
    })
  }

  if (Array.isArray(value)) return value.map((item) => resolveTemplates(item, input, workflow))

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveTemplates(item, input, workflow),
      ])
    )
  }

  return value
}

function parseHeaders(value: unknown): Record<string, string> {
  if (typeof value !== 'string' || value.trim() === '') return {}
  return JSON.parse(value) as Record<string, string>
}

function getCredentialHeaders(config: Record<string, unknown>) {
  const headers = parseHeaders(config.credentialHeaders)
  const credentialType = config.credentialType as string | undefined

  if (credentialType === 'bearerToken' && config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`
  }
  if (credentialType === 'apiKeyHeader' && config.apiKeyName && config.apiKeyValue) {
    headers[String(config.apiKeyName)] = String(config.apiKeyValue)
  }
  if (credentialType === 'basicAuth' && config.basicUsername && config.basicPassword) {
    const rawValue = `${config.basicUsername}:${config.basicPassword}`
    const encodedValue =
      typeof btoa === 'function'
        ? btoa(rawValue)
        : Buffer.from(rawValue).toString('base64')
    headers.Authorization = `Basic ${encodedValue}`
  }

  return headers
}

async function resolveNodeConfig(node: WorkflowNode, input: unknown, ctx: WorkflowEngineContext) {
  const templatedConfig = resolveTemplates(node.data.config || {}, input, ctx.workflow) as Record<string, unknown>
  const credentialId = typeof templatedConfig.credentialId === 'string' ? templatedConfig.credentialId.trim() : ''
  if (!ctx.credentialResolver || !credentialId) return templatedConfig

  const credentialConfig = await ctx.credentialResolver(credentialId)
  return { ...(credentialConfig || {}), ...templatedConfig }
}

function evaluateExpression(expression: string, input: unknown) {
  const fn = new Function('input', `return (${expression})`)
  return fn(input)
}

export async function executeNode(
  node: WorkflowNode,
  input: unknown,
  ctx: WorkflowEngineContext
): Promise<unknown> {
  const config = await resolveNodeConfig(node, input, ctx)

  switch (node.type) {
    case 'manual-trigger':
      return {
        triggered: true,
        data: parseJsonConfig(config.outputData, {}),
        timestamp: new Date().toISOString(),
      }

    case 'webhook-trigger':
      return {
        method: config.method,
        path: config.path,
        responseMode: config.responseMode,
        data: ctx.webhookPayload ?? parseJsonConfig(config.samplePayload, {}),
        triggered: true,
        timestamp: new Date().toISOString(),
      }

    case 'schedule-trigger':
      return {
        triggerType: config.triggerType,
        interval: config.interval,
        cronExpression: config.cronExpression,
        timezone: config.timezone,
        triggered: true,
        timestamp: new Date().toISOString(),
      }

    case 'http-request': {
      const method = String(config.method || 'GET')
      const url = String(config.url || '')
      if (!url) throw new Error('URL is required')

      const finalUrl = new URL(url)
      if (config.sendQuery && config.queryParameters) {
        const parsedQuery = parseJsonConfig(config.queryParameters, {}) as Record<string, unknown>
        Object.entries(parsedQuery).forEach(([key, value]) => finalUrl.searchParams.set(key, String(value)))
      }

      const headers = config.sendHeaders === false ? {} : parseHeaders(config.headers)
      const fetchOptions: RequestInit = {
        method,
        headers: { ...headers, ...getCredentialHeaders(config) },
      }

      if ((config.sendBody || config.body) && config.body && method !== 'GET') {
        fetchOptions.body = String(config.body)
      }

      const response = await fetch(finalUrl, fetchOptions)
      const contentType = response.headers.get('content-type')
      const data = contentType?.includes('application/json') ? await response.json() : await response.text()
      if (!response.ok) throw new Error(`HTTP Request failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`)

      return {
        status: response.status,
        statusText: response.statusText,
        data,
      }
    }

    case 'code': {
      const fn = new Function('input', String(config.code || 'return input;'))
      return fn(input)
    }

    case 'if-else': {
      const condition = String(config.condition || 'false')
      const result = Boolean(evaluateExpression(condition, input))
      return {
        true: result ? input : undefined,
        false: result ? undefined : input,
      }
    }

    case 'switch': {
      const value = evaluateExpression(String(config.expression || 'undefined'), input)
      const cases = parseJsonConfig(config.cases, []) as string[]
      const selectedIndex = cases.findIndex((item) => item === value)
      return selectedIndex >= 0
        ? { [`case${selectedIndex}`]: input }
        : { default: input }
    }

    case 'set': {
      const assignments = parseJsonConfig(config.assignments, {}) as Record<string, unknown>
      return config.includeOtherFields === false
        ? assignments
        : { ...((input && typeof input === 'object') ? input as Record<string, unknown> : {}), ...assignments }
    }

    case 'transform': {
      if (config.operation === 'limit' && Array.isArray(input)) return input.slice(0, Number(config.limit || 10))
      if (config.operation === 'customCode') {
        const fn = new Function('input', String(config.code || 'return input;'))
        return fn(input)
      }
      return input
    }

    case 'filter': {
      if (!Array.isArray(input)) throw new Error('Filter input must be an array')
      const fn = new Function('item', `return (${String(config.condition || '() => true')})(item)`)
      return input.filter((item) => fn(item))
    }

    case 'delay':
      await new Promise((resolve) => setTimeout(resolve, Number(config.seconds || 1) * 1000))
      return input

    case 'stop-and-error':
      throw new Error(String(config.errorMessage || 'Workflow stopped by Stop and Error node'))

    case 'no-op':
    case 'respond-to-webhook':
    case 'merge':
    case 'split':
      return input

    default:
      return input
  }
}
