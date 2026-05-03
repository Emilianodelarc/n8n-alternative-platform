import type { Workflow, WorkflowNode, WorkflowEdge } from './types'

interface ExecutionCallbacks {
  onNodeStart?: (nodeId: string) => void
  onNodeComplete?: (nodeId: string, result: { output: unknown; duration: number }) => void
  onNodeError?: (nodeId: string, error: Error) => void
}

interface ExecutionContext {
  workflow: Workflow
  outputs: Map<string, unknown>
  callbacks: ExecutionCallbacks
  webhookPayload?: unknown
  credentialResolver?: (credentialId: string) => Promise<Record<string, unknown> | null>
}

interface ExecuteWorkflowOptions {
  webhookPayload?: unknown
  credentialResolver?: (credentialId: string) => Promise<Record<string, unknown> | null>
}

// Get nodes in topological order for execution
function getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacencyList = new Map<string, string[]>()

  // Initialize
  nodes.forEach((node) => {
    inDegree.set(node.id, 0)
    adjacencyList.set(node.id, [])
  })

  // Build graph
  edges.forEach((edge) => {
    adjacencyList.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // Kahn's algorithm
  const queue: string[] = []
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId)
  })

  const result: WorkflowNode[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (node) result.push(node)

    adjacencyList.get(nodeId)?.forEach((targetId) => {
      const newDegree = (inDegree.get(targetId) || 0) - 1
      inDegree.set(targetId, newDegree)
      if (newDegree === 0) queue.push(targetId)
    })
  }

  return result
}

// Get the input data for a node based on connected edges
function getNodeInput(
  nodeId: string,
  edges: WorkflowEdge[],
  outputs: Map<string, unknown>
): unknown {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  
  if (incomingEdges.length === 0) {
    return null
  }
  
  if (incomingEdges.length === 1) {
    const sourceOutput = outputs.get(incomingEdges[0].source)
    if (incomingEdges[0].sourceHandle) {
      const handleOutput = sourceOutput as Record<string, unknown>
      return handleOutput?.[incomingEdges[0].sourceHandle] ?? sourceOutput
    }
    return sourceOutput
  }
  
  // Multiple inputs - combine them
  return incomingEdges.reduce((acc, edge) => {
    const key = edge.sourceHandle || edge.source
    acc[key] = outputs.get(edge.source)
    return acc
  }, {} as Record<string, unknown>)
}

function parseJsonConfig(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback
  }

  return JSON.parse(value)
}

function readPath(source: unknown, path: string): unknown {
  if (path === '' || path === '.') return source

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

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplates(item, input, workflow))
  }

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

async function resolveNodeConfig(
  config: Record<string, unknown>,
  input: unknown,
  ctx: ExecutionContext
): Promise<Record<string, unknown>> {
  const templatedConfig = resolveTemplates(config, input, ctx.workflow) as Record<string, unknown>
  const credentialId = templatedConfig.credentialId

  if (!ctx.credentialResolver || typeof credentialId !== 'string' || !credentialId.trim()) {
    return templatedConfig
  }

  const credentialConfig = await ctx.credentialResolver(credentialId.trim())
  return { ...(credentialConfig || {}), ...templatedConfig }
}

function unsupportedRealNode(type: string): never {
  throw new Error(`${type} does not have a real connector implemented yet. No simulated execution is allowed.`)
}

function parseHeaders(value: unknown): Record<string, string> {
  if (typeof value !== 'string' || value.trim() === '') {
    return {}
  }

  return JSON.parse(value) as Record<string, string>
}

function getCredentialHeaders(config: Record<string, unknown>): Record<string, string> {
  const headers = parseHeaders(config.credentialHeaders)
  const credentialType = config.credentialType as string | undefined

  if (credentialType === 'bearerToken' && config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`
  }

  if (credentialType === 'apiKeyHeader' && config.apiKeyName && config.apiKeyValue) {
    headers[String(config.apiKeyName)] = String(config.apiKeyValue)
  }

  if (credentialType === 'basicAuth' && config.basicUsername && config.basicPassword) {
    headers.Authorization = `Basic ${btoa(`${config.basicUsername}:${config.basicPassword}`)}`
  }

  if (credentialType === 'rawHeaders') {
    return headers
  }

  return headers
}

function requireRealModeCredential(config: Record<string, unknown>, service: string): Record<string, string> {
  const headers = getCredentialHeaders(config)
  if (!headers.Authorization && Object.keys(headers).length === 0) {
    throw new Error(`${service} real mode requires credentials in the node Connection section`)
  }
  return headers
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)
  const contentType = response.headers.get('content-type')
  const data = contentType?.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }

  return data
}

async function requestText(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, init)
  const data = await response.text()

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${data}`)
  }

  return data
}

interface GoogleFileReference {
  id: string
  kind: 'drive-file' | 'drive-folder' | 'google-doc' | 'google-sheet' | 'google-slides' | 'unknown'
  url?: string
  mimeType?: string
}

function getNestedString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object') return ''

  for (const key of keys) {
    const candidate = (value as Record<string, unknown>)[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return ''
}

function parseGoogleFileReference(rawValue: unknown): GoogleFileReference | null {
  const raw =
    typeof rawValue === 'string'
      ? rawValue.trim()
      : getNestedString(rawValue, ['fileUrl', 'url', 'webViewLink', 'webContentLink', 'fileId', 'id'])

  if (!raw) return null

  const directId = /^[a-zA-Z0-9_-]{20,}$/.test(raw) ? raw : ''
  if (directId) {
    return { id: directId, kind: 'unknown' }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const path = url.pathname
  const idFromQuery = url.searchParams.get('id')
  const idFromPath =
    path.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/)?.[1] ||
    path.match(/\/drive\/folders\/([^/]+)/)?.[1] ||
    path.match(/\/folders\/([^/]+)/)?.[1] ||
    ''

  const id = idFromQuery || idFromPath
  if (!id) return null

  if (path.includes('/document/d/')) {
    return { id, kind: 'google-doc', url: raw, mimeType: 'application/vnd.google-apps.document' }
  }
  if (path.includes('/spreadsheets/d/')) {
    return { id, kind: 'google-sheet', url: raw, mimeType: 'application/vnd.google-apps.spreadsheet' }
  }
  if (path.includes('/presentation/d/')) {
    return { id, kind: 'google-slides', url: raw, mimeType: 'application/vnd.google-apps.presentation' }
  }
  if (path.includes('/folders/') || path.includes('/drive/folders/')) {
    return { id, kind: 'drive-folder', url: raw, mimeType: 'application/vnd.google-apps.folder' }
  }

  return { id, kind: 'drive-file', url: raw }
}

function getGoogleReferenceFromConfig(config: Record<string, unknown>, input: unknown): GoogleFileReference | null {
  const inputSource = config.inputSource as string | undefined
  if (inputSource === 'input') {
    return parseGoogleFileReference(input)
  }

  if (inputSource === 'url' || config.fileUrl) {
    return parseGoogleFileReference(config.fileUrl)
  }

  return parseGoogleFileReference(config.fileId)
}

function getGoogleExportMime(reference: GoogleFileReference, outputFormat: string): string | null {
  if (reference.kind === 'google-doc') {
    return outputFormat === 'json' ? null : 'text/plain'
  }
  if (reference.kind === 'google-sheet') {
    return outputFormat === 'json' ? null : 'text/csv'
  }
  if (reference.kind === 'google-slides') {
    return outputFormat === 'text' ? 'text/plain' : null
  }
  return null
}

// Execute a single node
async function executeNode(
  node: WorkflowNode,
  input: unknown,
  ctx: ExecutionContext
): Promise<unknown> {
  const { type, data } = node
  const config = await resolveNodeConfig(data.config || {}, input, ctx)

  switch (type) {
    // Triggers - just pass through or provide initial data
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

    // HTTP Request
    case 'http-request': {
      const { method, url, headers, body, sendBody, sendHeaders, sendQuery, queryParameters } = config as {
        method: string
        url: string
        headers: string
        body: string
        sendBody?: boolean
        sendHeaders?: boolean
        sendQuery?: boolean
        queryParameters?: string
      }
      
      if (!url) {
        throw new Error('URL is required')
      }

      const finalUrl = new URL(url)
      if (sendQuery && queryParameters) {
        const parsedQuery = parseJsonConfig(queryParameters, {}) as Record<string, unknown>
        Object.entries(parsedQuery).forEach(([key, value]) => finalUrl.searchParams.set(key, String(value)))
      }

      const parsedHeaders = sendHeaders === false ? {} : parseHeaders(headers)
      const credentialHeaders = getCredentialHeaders(config)
      const fetchOptions: RequestInit = {
        method: method || 'GET',
        headers: { ...parsedHeaders, ...credentialHeaders },
      }

      if ((sendBody || body) && body && method !== 'GET') {
        fetchOptions.body = body
      }

      const response = await fetch(finalUrl, fetchOptions)
      const contentType = response.headers.get('content-type')
      
      let responseData: unknown
      if (contentType?.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      }
    }

    case 'send-email': {
      return unsupportedRealNode(type)
    }

    case 'slack-message': {
      const { channel, message, blocks, operation } = config as {
        channel?: string
        message?: string
        blocks?: string
        operation?: string
      }
      const headers = {
        ...requireRealModeCredential(config, 'Slack'),
        'Content-Type': 'application/json',
      }

      if ((operation || 'post') !== 'post') {
        return unsupportedRealNode(`${type}:${operation}`)
      }

      if (!channel) throw new Error('Slack channel is required')
      if (!message && !blocks) throw new Error('Slack message or blocks are required')

      const response = await requestJson('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel,
          text: message || undefined,
          blocks: blocks ? parseJsonConfig(blocks, []) : undefined,
        }),
      })

      if (response && typeof response === 'object' && (response as Record<string, unknown>).ok === false) {
        throw new Error(`Slack API error: ${(response as Record<string, unknown>).error || 'unknown_error'}`)
      }

      return response
    }

    case 'respond-to-webhook':
      return input

    // Code execution
    case 'code': {
      const { code } = config as { code: string }
      const fn = new Function('input', code)
      return fn(input)
    }

    // Logic nodes
    case 'if-else': {
      const { condition } = config as { condition: string }
      const fn = new Function('input', `return ${condition}`)
      const result = fn(input)
      return { true: result ? input : undefined, false: !result ? input : undefined }
    }

    case 'switch': {
      const { expression, cases } = config as { expression: string; cases: string }
      const fn = new Function('input', `return ${expression}`)
      const value = fn(input)
      const casesList = JSON.parse(cases) as string[]
      
      const result: Record<string, unknown> = { default: input }
      casesList.forEach((c, i) => {
        result[`case${i}`] = value === c ? input : undefined
      })
      
      return result
    }

    case 'route': {
      const { mode, routeField, rules, fallbackRoute } = config as {
        mode?: string
        routeField?: string
        rules?: string
        fallbackRoute?: string
      }
      const result: Record<string, unknown> = {}
      const routeIds = new Set(['route1', 'route2', 'route3'])
      let selectedRoute = ''

      if (mode === 'field' && routeField) {
        const fn = new Function('input', `return ${routeField}`)
        const value = String(fn(input))
        selectedRoute = routeIds.has(value) ? value : ''
      } else {
        const parsedRules = parseJsonConfig(rules, []) as Array<{ route: string; condition: string }>
        const matchedRule = parsedRules.find((rule) => {
          if (!routeIds.has(rule.route) || !rule.condition) return false
          const fn = new Function('input', `return ${rule.condition}`)
          return Boolean(fn(input))
        })
        selectedRoute = matchedRule?.route || ''
      }

      if (!selectedRoute && fallbackRoute && routeIds.has(fallbackRoute)) {
        selectedRoute = fallbackRoute
      }

      if (selectedRoute) {
        result[selectedRoute] = input
      }

      return result
    }

    case 'loop': {
      const { arrayPath } = config as { arrayPath: string }
      const fn = new Function('input', `return ${arrayPath}`)
      const array = fn(input)
      
      if (!Array.isArray(array)) {
        throw new Error('Loop input must be an array')
      }
      
      // Return items for processing
      return { items: array, done: array }
    }

    case 'merge': {
      // Just combine inputs
      return input
    }

    // Transform nodes
    case 'set': {
      const { assignments, includeOtherFields } = config as { assignments: string; includeOtherFields?: boolean }
      const parsed = JSON.parse(assignments)
      return includeOtherFields === false ? parsed : { ...((input as object) || {}), ...parsed }
    }

    case 'transform': {
      const { operation, code, limit } = config as { operation: string; code: string; limit?: number }
      if (operation === 'limit' && Array.isArray(input)) {
        return input.slice(0, limit || 10)
      }
      if (operation !== 'customCode') return input
      const fn = new Function('input', code)
      return fn(input)
    }

    case 'filter': {
      const { condition } = config as { condition: string }
      const fn = new Function('item', `return (${condition})(item)`)
      if (!Array.isArray(input)) {
        throw new Error('Filter input must be an array')
      }
      return input.filter((item) => fn(item))
    }

    case 'split': {
      if (!Array.isArray(input)) {
        throw new Error('Split input must be an array')
      }
      return input
    }

    case 'json-parse': {
      const parsed = typeof input === 'string' ? JSON.parse(input) : input
      const { path } = config as { path: string }
      if (!path) return parsed

      return path.split('.').reduce<unknown>((value, key) => {
        if (value && typeof value === 'object') {
          return (value as Record<string, unknown>)[key]
        }
        return undefined
      }, parsed)
    }

    case 'csv-parse':
    case 'xml':
    case 'html':
      return unsupportedRealNode(type)

    case 'json-create': {
      const { fileName, mode, data } = config as { fileName: string; mode: string; data: string }
      const parsedData = parseJsonConfig(data, mode === 'array' ? [] : {})
      const json =
        mode === 'merge'
          ? { ...((input as object) || {}), ...((parsedData as object) || {}) }
          : parsedData

      return {
        fileName: fileName || 'data.json',
        mimeType: 'application/json',
        json,
        content: JSON.stringify(json, null, 2),
        created: true,
        timestamp: new Date().toISOString(),
      }
    }

    case 'google-sheets': {
      const { operation, spreadsheetId, title, range, values, sheets } = config as {
        operation: string
        spreadsheetId: string
        title: string
        range: string
        values: string
        sheets?: string
      }

      const headers = {
        ...requireRealModeCredential(config, 'Google Sheets'),
        'Content-Type': 'application/json',
      }

      if (operation === 'create') {
        return requestJson('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            properties: { title: title || 'Untitled spreadsheet' },
            sheets: (parseJsonConfig(sheets, []) as string[]).map((sheetTitle) => ({
              properties: { title: sheetTitle },
            })),
          }),
        })
      }

      if (!spreadsheetId) throw new Error('Spreadsheet ID is required for this operation')

      if (operation === 'append') {
        return requestJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ values: parseJsonConfig(values, []) }),
          }
        )
      }

      if (operation === 'write' || operation === 'update') {
        return requestJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ values: parseJsonConfig(values, []) }),
          }
        )
      }

      return requestJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers }
      )
    }

    case 'google-drive': {
      const { operation, folderId, fileName, mimeType, content, fileId, outputFormat, includeContent } = config as {
        operation: string
        folderId: string
        fileName: string
        mimeType: string
        content: string
        fileId?: string
        outputFormat?: string
        includeContent?: boolean
      }
      const fileReference = getGoogleReferenceFromConfig(config, input)
      const resolvedFileId = fileReference?.id || fileId

      const headers = {
        ...requireRealModeCredential(config, 'Google Drive'),
        'Content-Type': 'application/json',
      }

      if (operation === 'create' || operation === 'createFromText') {
        return requestJson('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: fileName || 'Untitled file',
            mimeType,
            parents: folderId ? [folderId] : undefined,
            description: content,
          }),
        })
      }

      if (operation === 'readLink' || operation === 'get' || operation === 'download') {
        if (!resolvedFileId) {
          throw new Error('A Drive/Docs/Sheets/Slides link or File ID is required')
        }

        const metadata = await requestJson(
          `https://www.googleapis.com/drive/v3/files/${resolvedFileId}?fields=id,name,mimeType,webViewLink,webContentLink,parents,size,createdTime,modifiedTime,owners(displayName,emailAddress)`,
          { headers }
        )
        const metadataObject = metadata as Record<string, unknown>
        const detectedReference: GoogleFileReference = {
          id: resolvedFileId,
          kind: fileReference?.kind || 'unknown',
          url: fileReference?.url,
          mimeType: (metadataObject.mimeType as string | undefined) || fileReference?.mimeType,
        }

        if (!includeContent && operation !== 'download') {
          return { reference: detectedReference, metadata }
        }

        const exportMime = getGoogleExportMime(detectedReference, outputFormat || 'metadata')
        if (exportMime) {
          const exportedContent = await requestText(
            `https://www.googleapis.com/drive/v3/files/${resolvedFileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
            { headers }
          )

          return { reference: detectedReference, metadata, content: exportedContent, contentMimeType: exportMime }
        }

        if (detectedReference.mimeType && !detectedReference.mimeType.startsWith('application/vnd.google-apps.')) {
          const downloadedContent = await requestText(
            `https://www.googleapis.com/drive/v3/files/${resolvedFileId}?alt=media`,
            { headers }
          )

          return {
            reference: detectedReference,
            metadata,
            content: downloadedContent,
            contentMimeType: detectedReference.mimeType,
          }
        }

        return {
          reference: detectedReference,
          metadata,
          content: null,
          warning: 'Content export is not available for this Google file type/output format yet.',
        }
      }

      if (operation === 'delete') {
        if (!resolvedFileId) throw new Error('File ID is required to delete a Drive file')
        return requestJson(`https://www.googleapis.com/drive/v3/files/${resolvedFileId}`, {
          method: 'DELETE',
          headers,
        })
      }

      return requestJson('https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name,mimeType,webViewLink)', {
        headers,
      })
    }

    case 'google-docs': {
      const { operation, documentId, title, content } = config as {
        operation: string
        documentId: string
        title: string
        content: string
      }

      const headers = {
        ...requireRealModeCredential(config, 'Google Docs'),
        'Content-Type': 'application/json',
      }

      if (operation === 'create') {
        return requestJson('https://docs.googleapis.com/v1/documents', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: title || 'Untitled document' }),
        })
      }

      if (!documentId) throw new Error('Document ID is required for this operation')

      if (operation === 'get') {
        return requestJson(`https://docs.googleapis.com/v1/documents/${documentId}`, { headers })
      }

      return requestJson(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: content
            ? [{ insertText: { location: { index: 1 }, text: content } }]
            : (parseJsonConfig(config.actionsUi, []) as unknown[]),
        }),
      })
    }

    case 'google-slides': {
      const { operation, presentationId, title, slides } = config as {
        operation: string
        presentationId: string
        title: string
        slides: string
      }

      const headers = {
        ...requireRealModeCredential(config, 'Google Slides'),
        'Content-Type': 'application/json',
      }

      if (operation === 'create') {
        return requestJson('https://slides.googleapis.com/v1/presentations', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: title || 'Untitled presentation' }),
        })
      }

      if (!presentationId) throw new Error('Presentation ID is required for this operation')

      if (operation === 'get') {
        return requestJson(`https://slides.googleapis.com/v1/presentations/${presentationId}`, { headers })
      }

      return requestJson(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ requests: parseJsonConfig(config.replaceTextUi, parseJsonConfig(slides, [])) }),
      })
    }

    case 'gmail':
    case 'google-calendar':
    case 'airtable':
    case 'notion':
    case 'mysql':
    case 'github':
    case 'stripe':
    case 'discord':
    case 'telegram':
    case 'whatsapp':
    case 'mongodb':
    case 'redis':
    case 'openai':
    case 'anthropic':
    case 'push-notification':
      return unsupportedRealNode(type)

    case 'postgres-query': {
      const { connectionString, query, parameters } = config as {
        connectionString?: string
        query?: string
        parameters?: string
      }

      if (!query) throw new Error('SQL Query is required')
      const { neon } = await import('@neondatabase/serverless')
      const sql = neon(connectionString || process.env.DATABASE_URL || '')
      if (!connectionString && !process.env.DATABASE_URL) {
        throw new Error('PostgreSQL requires a Connection String or DATABASE_URL')
      }

      return sql.query(query, parseJsonConfig(parameters, []) as unknown[])
    }

    // Utility nodes
    case 'delay': {
      const { seconds } = config as { seconds: number }
      await new Promise((resolve) => setTimeout(resolve, (seconds || 1) * 1000))
      return input
    }

    case 'no-op':
      return input

    case 'stop-and-error': {
      const { errorMessage } = config as { errorMessage: string }
      throw new Error(errorMessage || 'Workflow stopped by Stop and Error node')
    }

    default:
      return input
  }
}

export async function executeWorkflow(
  workflow: Workflow,
  callbacks: ExecutionCallbacks = {},
  options: ExecuteWorkflowOptions = {}
): Promise<Map<string, unknown>> {
  const ctx: ExecutionContext = {
    workflow,
    outputs: new Map(),
    callbacks,
    webhookPayload: options.webhookPayload,
    credentialResolver: options.credentialResolver,
  }

  const executionOrder = getExecutionOrder(workflow.nodes, workflow.edges)

  for (const node of executionOrder) {
    const startTime = performance.now()
    callbacks.onNodeStart?.(node.id)

    try {
      const input = getNodeInput(node.id, workflow.edges, ctx.outputs)
      const output = await executeNode(node, input, ctx)
      const duration = Math.round(performance.now() - startTime)

      ctx.outputs.set(node.id, output)
      callbacks.onNodeComplete?.(node.id, { output, duration })
    } catch (error) {
      callbacks.onNodeError?.(node.id, error as Error)
      throw error
    }
  }

  return ctx.outputs
}
