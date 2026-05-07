import * as XLSX from 'xlsx'
import type { Workflow, WorkflowNode } from '@/lib/workflow/types'
import { itemJsonOrLegacyInput, toWorkflowItems } from './items'
import type {
  WorkflowEngineContext,
  WorkflowItem,
  WorkflowItemError,
  WorkflowNodeExecutionMode,
} from './types'

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

function resolveTemplateExpression(expression: string, item: WorkflowItem, allItems: WorkflowItem[], workflow: Workflow) {
  const trimmed = expression.trim()
  const legacyInput = itemJsonOrLegacyInput(allItems)

  if (trimmed === 'input') return legacyInput
  if (trimmed.startsWith('input.')) return readPath(legacyInput, trimmed.slice('input.'.length))
  if (trimmed === '$json') return item.json
  if (trimmed.startsWith('$json.')) return readPath(item.json, trimmed.slice('$json.'.length))
  if (trimmed === '$items') return allItems
  if (trimmed === 'variables') return workflow.variables
  if (trimmed.startsWith('variables.')) return readPath(workflow.variables, trimmed.slice('variables.'.length))
  return undefined
}

function resolveTemplates(value: unknown, item: WorkflowItem, allItems: WorkflowItem[], workflow: Workflow): unknown {
  if (typeof value === 'string') {
    const exactMatch = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/)
    if (exactMatch) {
      const resolved = resolveTemplateExpression(exactMatch[1], item, allItems, workflow)
      return resolved === undefined ? value : resolved
    }

    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression: string) => {
      const resolved = resolveTemplateExpression(expression, item, allItems, workflow)
      return resolved === undefined ? `{{${expression}}}` : stringifyTemplateValue(resolved)
    })
  }

  if (Array.isArray(value)) return value.map((entry) => resolveTemplates(entry, item, allItems, workflow))

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        resolveTemplates(entry, item, allItems, workflow),
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

  if (credentialType === 'bearerToken' && config.accessToken) headers.Authorization = `Bearer ${config.accessToken}`
  if (credentialType === 'apiKeyHeader' && config.apiKeyName && config.apiKeyValue) {
    headers[String(config.apiKeyName)] = String(config.apiKeyValue)
  }
  if (credentialType === 'basicAuth' && config.basicUsername && config.basicPassword) {
    const rawValue = `${config.basicUsername}:${config.basicPassword}`
    headers.Authorization = `Basic ${Buffer.from(rawValue).toString('base64')}`
  }

  return headers
}

async function resolveNodeConfig(
  node: WorkflowNode,
  item: WorkflowItem,
  allItems: WorkflowItem[],
  ctx: WorkflowEngineContext
) {
  const templatedConfig = resolveTemplates(node.data.config || {}, item, allItems, ctx.workflow) as Record<string, unknown>
  const credentialId = typeof templatedConfig.credentialId === 'string' ? templatedConfig.credentialId.trim() : ''
  if (!ctx.credentialResolver || !credentialId) return templatedConfig

  const credentialConfig = await ctx.credentialResolver(credentialId)
  return { ...(credentialConfig || {}), ...templatedConfig }
}

function evaluateExpression(expression: string, item: WorkflowItem, allItems: WorkflowItem[]) {
  const fn = new Function('input', 'item', '$json', '$items', `return (${expression})`)
  return fn(itemJsonOrLegacyInput(allItems), item.json, item.json, allItems)
}

function getExecutionMode(node: WorkflowNode): WorkflowNodeExecutionMode {
  const configuredMode = node.data.config?.executionMode
  if (configuredMode === 'once' || configuredMode === 'perItem') return configuredMode
  if (node.type === 'send-email' && node.data.config?.mode === 'oneEmailPerItem') return 'perItem'
  return 'once'
}

async function refreshGoogleAccessToken(config: Record<string, unknown>, service: string) {
  const refreshToken = typeof config.refreshToken === 'string' ? config.refreshToken.trim() : ''
  if (!refreshToken) return null

  const clientId = String(config.clientId || process.env.GOOGLE_CLIENT_ID || '')
  const clientSecret = String(config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '')
  if (!clientId || !clientSecret) {
    throw new Error(`${service} needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to refresh OAuth tokens`)
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok || typeof data.access_token !== 'string') {
    throw new Error(`${service} could not refresh Google OAuth token: ${JSON.stringify(data)}`)
  }

  return data.access_token
}

async function getGoogleCredentialHeaders(config: Record<string, unknown>, service: string): Promise<Record<string, string>> {
  const accessToken = typeof config.accessToken === 'string' ? config.accessToken.trim() : ''
  const expiresAt = typeof config.expiresAt === 'string' ? Date.parse(config.expiresAt) : 0
  const shouldRefresh = Boolean(config.refreshToken) && (!accessToken || !expiresAt || expiresAt < Date.now() + 60_000)

  if (accessToken.endsWith('.apps.googleusercontent.com')) {
    throw new Error(`${service} needs an OAuth access token, not the Google OAuth Client ID.`)
  }

  if (shouldRefresh) {
    const refreshedAccessToken = await refreshGoogleAccessToken(config, service)
    if (refreshedAccessToken) return { Authorization: `Bearer ${refreshedAccessToken}` }
  }

  if (!accessToken) throw new Error(`${service} needs a connected Google credential or OAuth access token.`)
  return { Authorization: `Bearer ${accessToken}` }
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
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${data}`)
  return data
}

async function requestArrayBuffer(url: string, init: RequestInit): Promise<ArrayBuffer> {
  const response = await fetch(url, init)
  const data = await response.arrayBuffer()
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${Buffer.from(data).toString('utf8')}`)
  return data
}

function parseDelimitedText(content: string, delimiter: ',' | '\t') {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    const nextCharacter = content[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      currentRow.push(currentValue)
      if (currentRow.some((cell) => cell !== '')) rows.push(currentRow)
      currentRow = []
      currentValue = ''
      continue
    }

    currentValue += character
  }

  currentRow.push(currentValue)
  if (currentRow.some((cell) => cell !== '')) rows.push(currentRow)
  return rows
}

function tableRowsToItems(rows: unknown[][], hasHeaderRow = true): WorkflowItem[] {
  if (!hasHeaderRow) {
    return rows.map((row, rowIndex) => ({
      json: Object.fromEntries(row.map((cell, index) => [`column_${index + 1}`, cell ?? ''])),
      pairedItem: rowIndex,
    }))
  }

  const headers = (rows[0] || []).map((value, index) => String(value || `column_${index + 1}`).trim())
  return rows.slice(1).map((row, rowIndex) => ({
    json: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])),
    pairedItem: rowIndex,
  }))
}

function readSpreadsheetBuffer(data: ArrayBuffer): WorkflowItem[] {
  const workbook = XLSX.read(Buffer.from(data), { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as unknown[][]
  return tableRowsToItems(rows)
}

interface GoogleFileReference {
  id: string
  kind: 'drive-file' | 'drive-folder' | 'google-doc' | 'google-sheet' | 'google-slides' | 'unknown'
  url?: string
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
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return { id: raw, kind: 'unknown' }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const path = url.pathname
  const id = url.searchParams.get('id') ||
    path.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/)?.[1] ||
    path.match(/\/drive\/folders\/([^/]+)/)?.[1] ||
    path.match(/\/folders\/([^/]+)/)?.[1] ||
    ''
  if (!id) return null
  if (path.includes('/spreadsheets/d/')) return { id, kind: 'google-sheet', url: raw }
  if (path.includes('/document/d/')) return { id, kind: 'google-doc', url: raw }
  if (path.includes('/presentation/d/')) return { id, kind: 'google-slides', url: raw }
  if (path.includes('/folders/') || path.includes('/drive/folders/')) return { id, kind: 'drive-folder', url: raw }
  return { id, kind: 'drive-file', url: raw }
}

function getGoogleReferenceFromConfig(config: Record<string, unknown>, input: unknown): GoogleFileReference | null {
  if (config.inputSource === 'input') return parseGoogleFileReference(input)
  if (config.inputSource === 'url' || config.fileUrl) return parseGoogleFileReference(config.fileUrl)
  return parseGoogleFileReference(config.fileId)
}

function isDelimitedTextFile(metadata: Record<string, unknown>) {
  const mimeType = String(metadata.mimeType || '')
  const name = String(metadata.name || '').toLowerCase()
  return mimeType === 'text/csv' || mimeType === 'text/tab-separated-values' || name.endsWith('.csv') || name.endsWith('.tsv')
}

function isSpreadsheetBinaryFile(metadata: Record<string, unknown>) {
  const mimeType = String(metadata.mimeType || '')
  const name = String(metadata.name || '').toLowerCase()
  return (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  )
}

function normalizeSheetRange(range: unknown) {
  return String(range || 'A:ZZ').trim() || 'A:ZZ'
}

function buildSheetRange(config: Record<string, unknown>) {
  const range = normalizeSheetRange(config.range)
  const sheetName = String(config.sheetName || '').trim()
  if (!sheetName || range.includes('!')) return range
  return `${sheetName}!${range}`
}

function splitSheetRange(range: string) {
  const [sheetName, cells = range] = range.includes('!') ? range.split('!') : ['', range]
  const startCell = cells.split(':')[0] || 'A1'
  return { sheetName, cells, startCell }
}

function columnToNumber(column: string) {
  return column.toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0)
}

function numberToColumn(value: number) {
  let column = ''
  let current = value
  while (current > 0) {
    const remainder = (current - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    current = Math.floor((current - 1) / 26)
  }
  return column
}

function getStartColumn(range: string) {
  const { startCell } = splitSheetRange(range)
  return columnToNumber(startCell.match(/[A-Za-z]+/)?.[0] || 'A')
}

function getStartRow(range: string) {
  const { startCell } = splitSheetRange(range)
  return Number(startCell.match(/\d+/)?.[0] || 1)
}

function a1CellRange(range: string, row: number, column: number) {
  const { sheetName } = splitSheetRange(range)
  const cell = `${numberToColumn(column)}${row}`
  return sheetName ? `${sheetName}!${cell}` : cell
}

function normalizeSheetValuesFromItems(config: Record<string, unknown>, items: WorkflowItem[], workflow: Workflow) {
  if (typeof config.values === 'string' && config.values.trim() !== '') {
    return parseJsonConfig(config.values, []) as unknown[][]
  }

  const parsedColumns = typeof config.columns === 'string' && config.columns.trim()
    ? parseJsonConfig(config.columns, {}) as Record<string, unknown>
    : {}
  const headers = Object.keys(parsedColumns).length > 0
    ? Object.keys(parsedColumns)
    : Array.from(new Set(items.flatMap((item) => Object.keys(item.json))))

  return items.map((item) =>
    headers.map((header) => {
      const mappedValue = parsedColumns[header]
      if (mappedValue !== undefined) return resolveTemplates(mappedValue, item, items, workflow)
      return item.json[header] ?? ''
    })
  )
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function normalizeEmailList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean)
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    const parsed = parseJsonConfig(trimmed, null)
    if (Array.isArray(parsed)) return normalizeEmailList(parsed)
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean)
}

function validateEmailHeader(name: string, addresses: string[]) {
  const invalid = addresses.filter((address) =>
    address.includes('{{') ||
    address.includes('}}') ||
    address.startsWith('{') ||
    address.startsWith('[') ||
    !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(address)
  )
  if (invalid.length > 0) {
    throw new Error(`${name} must contain valid email addresses separated by commas. Invalid value: ${invalid.join(', ')}`)
  }
}

function buildEmailRaw(config: Record<string, unknown>) {
  const from = String(config.from || '').trim()
  const to = normalizeEmailList(config.to)
  const cc = normalizeEmailList(config.cc)
  const bcc = normalizeEmailList(config.bcc)
  const subject = String(config.subject || '').trim()
  const body = String(config.body || config.message || '')
  const emailFormat = String(config.emailFormat || 'html')

  if (to.length === 0) throw new Error('Email recipient is required')
  if (!subject) throw new Error('Email subject is required')
  validateEmailHeader('To', to)
  validateEmailHeader('CC', cc)
  validateEmailHeader('BCC', bcc)
  if (from) validateEmailHeader('From Email', [from])

  const headers = [
    from ? `From: ${from}` : '',
    `To: ${to.join(', ')}`,
    cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: ${emailFormat === 'text' ? 'text/plain' : 'text/html'}; charset=UTF-8`,
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean)

  return toBase64Url(`${headers.join('\r\n')}\r\n\r\n${body}`)
}

async function executeGoogleSheets(config: Record<string, unknown>, inputItems: WorkflowItem[], workflow: Workflow): Promise<WorkflowItem[]> {
  const operation = String(config.operation || 'readRows')
  const range = buildSheetRange(config)
  const hasHeaderRow = config.hasHeaderRow !== false
  const googleReference = getGoogleReferenceFromConfig(config, itemJsonOrLegacyInput(inputItems))
  const spreadsheetReference = parseGoogleFileReference(config.spreadsheetId)
  const headers = {
    ...await getGoogleCredentialHeaders(config, 'Google Sheets'),
    'Content-Type': 'application/json',
  }
  const resolvedSpreadsheetId = String(spreadsheetReference?.id || config.spreadsheetId || googleReference?.id || '')

  if (operation === 'create') {
    const response = await requestJson('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ properties: { title: config.title || 'Untitled spreadsheet' } }),
    })
    return [{ json: response as Record<string, unknown> }]
  }

  if (operation === 'createSheet') {
    if (!resolvedSpreadsheetId) throw new Error('Spreadsheet ID is required to create a sheet tab')
    const sheetTitles = (parseJsonConfig(config.sheets, []) as string[]).filter(Boolean)
    if (typeof config.sheetName === 'string' && config.sheetName) sheetTitles.push(config.sheetName)
    if (sheetTitles.length === 0) throw new Error('At least one sheet tab name is required')
    const response = await requestJson(`https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: sheetTitles.map((title) => ({ addSheet: { properties: { title } } })) }),
    })
    return [{ json: response as Record<string, unknown> }]
  }

  if ((operation === 'readRows' || operation === 'read') && googleReference && googleReference.kind !== 'google-sheet' && !config.spreadsheetId) {
    const metadata = await requestJson(
      `https://www.googleapis.com/drive/v3/files/${googleReference.id}?fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime`,
      { headers }
    ) as Record<string, unknown>

    if (String(metadata.mimeType || '') === 'application/vnd.google-apps.spreadsheet') {
      const response = await requestJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${googleReference.id}/values/${encodeURIComponent(range)}`,
        { headers }
      ) as { values?: unknown[][] }
      const items = tableRowsToItems(response.values || [], hasHeaderRow)
      return config.returnMode === 'table' ? [{ json: { rows: items.map((item) => item.json) } }] : items
    }

    if (isDelimitedTextFile(metadata)) {
      const text = await requestText(`https://www.googleapis.com/drive/v3/files/${googleReference.id}?alt=media`, { headers })
      const delimiter = String(metadata.name || '').toLowerCase().endsWith('.tsv') || String(metadata.mimeType || '') === 'text/tab-separated-values' ? '\t' : ','
      const items = tableRowsToItems(parseDelimitedText(text, delimiter), hasHeaderRow)
      return config.returnMode === 'table' ? [{ json: { rows: items.map((item) => item.json) } }] : items
    }

    if (isSpreadsheetBinaryFile(metadata)) {
      const buffer = await requestArrayBuffer(`https://www.googleapis.com/drive/v3/files/${googleReference.id}?alt=media`, { headers })
      const items = readSpreadsheetBuffer(buffer)
      return config.returnMode === 'table' ? [{ json: { rows: items.map((item) => item.json) } }] : items
    }

    throw new Error('This file type is not supported in Google Sheets. Use a Google Sheet, CSV, TSV, XLS, or XLSX file.')
  }

  if (!resolvedSpreadsheetId) throw new Error('Spreadsheet ID, Google Sheets link, or file is required for this operation')

  if (operation === 'getSheets') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}?fields=sheets.properties`,
      { headers }
    ) as { sheets?: Array<{ properties?: Record<string, unknown> }> }
    return (response.sheets || []).map((sheet, index) => ({
      json: sheet.properties || {},
      pairedItem: index,
    }))
  }

  if (operation === 'readRows' || operation === 'read') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers }
    ) as { values?: unknown[][] }
    const items = tableRowsToItems(response.values || [], hasHeaderRow)
    return config.returnMode === 'table' ? [{ json: { rows: items.map((item) => item.json) } }] : items
  }

  if (operation === 'appendRows' || operation === 'append') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ values: normalizeSheetValuesFromItems(config, inputItems, workflow) }),
      }
    )
    return inputItems.map((item, index) => ({ json: { ...item.json, googleSheetsAppend: response, appended: true }, pairedItem: index }))
  }

  if (operation === 'updateRows' || operation === 'updateRow') {
    const keyColumn = String(config.keyColumn || '').trim()
    if (!keyColumn) throw new Error('Key Column is required to update rows')
    const updateValues = parseJsonConfig(config.updateValues, {}) as Record<string, unknown>
    const existing = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers }
    ) as { values?: unknown[][] }
    const rows = existing.values || []
    const headersRow = (rows[0] || []).map(String)
    const keyIndex = headersRow.findIndex((header) => header === keyColumn)
    if (keyIndex < 0) throw new Error(`Key column "${keyColumn}" was not found in the sheet`)

    const startColumn = getStartColumn(range)
    const startRow = getStartRow(range)
    const requests: Array<{ range: string; values: unknown[][] }> = []
    const updatedItems: WorkflowItem[] = []

    for (const [itemIndex, item] of inputItems.entries()) {
      const itemConfig = resolveTemplates({ keyValue: config.keyValue, updateValues }, item, inputItems, workflow) as {
        keyValue?: unknown
        updateValues: Record<string, unknown> | string
      }
      const resolvedUpdateValues = typeof itemConfig.updateValues === 'string'
        ? parseJsonConfig(itemConfig.updateValues, {}) as Record<string, unknown>
        : itemConfig.updateValues
      const keyValue = itemConfig.keyValue ?? item.json[keyColumn]
      const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[keyIndex] ?? '') === String(keyValue ?? ''))
      if (rowIndex < 0) throw new Error(`No row found where ${keyColumn} equals ${String(keyValue)}`)

      for (const [columnName, value] of Object.entries(resolvedUpdateValues || {})) {
        const columnIndex = headersRow.findIndex((header) => header === columnName)
        if (columnIndex < 0) throw new Error(`Update column "${columnName}" was not found in the sheet`)
        requests.push({
          range: a1CellRange(range, startRow + rowIndex, startColumn + columnIndex),
          values: [[value]],
        })
      }
      updatedItems.push({ json: { ...item.json, ...resolvedUpdateValues, googleSheetsUpdated: true }, pairedItem: itemIndex })
    }

    if (requests.length > 0) {
      await requestJson(`https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: requests }),
      })
    }
    return updatedItems
  }

  if (operation === 'addColumns' || operation === 'addColumn') {
    const columns = config.columnName ? [config.columnName] : parseJsonConfig(config.columnsToAdd || config.columns, []) as unknown[]
    const columnNames = columns.map(String).filter(Boolean)
    if (columnNames.length === 0) throw new Error('Columns to add are required')
    const existing = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers }
    ) as { values?: unknown[][] }
    const headersRow = (existing.values?.[0] || []).map(String)
    const newColumns = columnNames.filter((column) => !headersRow.includes(column))
    if (newColumns.length === 0) return [{ json: { addedColumns: [], skipped: true } }]
    const startColumn = getStartColumn(range)
    const targetColumn = startColumn + headersRow.length
    const values = [
      newColumns,
      ...(config.initialValue ? (existing.values || []).slice(1).map(() => newColumns.map(() => config.initialValue)) : []),
    ]
    await requestJson(`https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(a1CellRange(range, getStartRow(range), targetColumn))}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values }),
    })
    return [{ json: { addedColumns: newColumns } }]
  }

  if (operation === 'searchRows') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers }
    ) as { values?: unknown[][] }
    const column = String(config.searchColumn || '').trim()
    const operator = String(config.searchOperator || 'equals')
    const value = String(config.searchValue || '')
    if (!column) throw new Error('Search column is required')
    return tableRowsToItems(response.values || [], true).filter((item) => {
      const cellValue = String(item.json[column] ?? '')
      if (operator === 'notEquals') return cellValue !== value
      if (operator === 'contains') return cellValue.includes(value)
      if (operator === 'empty') return cellValue.trim() === ''
      if (operator === 'notEmpty') return cellValue.trim() !== ''
      return cellValue === value
    })
  }

  if (operation === 'clearRange') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      { method: 'POST', headers, body: JSON.stringify({}) }
    )
    return [{ json: response as Record<string, unknown> }]
  }

  if (operation === 'write' || operation === 'update') {
    const response = await requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ values: normalizeSheetValuesFromItems(config, inputItems, workflow) }),
      }
    )
    return [{ json: response as Record<string, unknown> }]
  }

  throw new Error(`Unsupported Google Sheets operation: ${operation}`)
}

async function executeSendEmail(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const headers = {
    ...await getGoogleCredentialHeaders(config, 'Email Send'),
    'Content-Type': 'application/json',
  }
  const attachments = parseJsonConfig(config.attachments, []) as unknown[]
  if (attachments.length > 0) throw new Error('Email attachments are not implemented yet for Gmail API sending')

  const response = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ raw: buildEmailRaw(config) }),
  })
  return response as Record<string, unknown>
}

export async function executeNodeOnce(
  node: WorkflowNode,
  inputItems: WorkflowItem[],
  ctx: WorkflowEngineContext
): Promise<WorkflowItem[] | Record<string, WorkflowItem[]>> {
  const firstItem = inputItems[0] || { json: {} }
  const config = await resolveNodeConfig(node, firstItem, inputItems, ctx)
  const legacyInput = itemJsonOrLegacyInput(inputItems)

  switch (node.type) {
    case 'manual-trigger':
      return [{
        json: {
          triggered: true,
          data: parseJsonConfig(config.outputData, {}),
          timestamp: new Date().toISOString(),
        },
      }]

    case 'webhook-trigger':
      return [{
        json: {
          method: config.method,
          path: config.path,
          responseMode: config.responseMode,
          data: ctx.webhookPayload ?? parseJsonConfig(config.samplePayload, {}),
          triggered: true,
          timestamp: new Date().toISOString(),
        },
      }]

    case 'schedule-trigger':
      return [{
        json: {
          triggerType: config.triggerType,
          interval: config.interval,
          cronExpression: config.cronExpression,
          timezone: config.timezone,
          triggered: true,
          timestamp: new Date().toISOString(),
        },
      }]

    case 'google-sheets':
      return executeGoogleSheets(
        {
          ...config,
          columns: node.data.config?.columns ?? config.columns,
          columnsToAdd: node.data.config?.columnsToAdd ?? config.columnsToAdd,
          keyValue: node.data.config?.keyValue ?? config.keyValue,
          updateValues: node.data.config?.updateValues ?? config.updateValues,
          values: node.data.config?.values ?? config.values,
        },
        inputItems,
        ctx.workflow
      )

    case 'send-email': {
      const response = await executeSendEmail(config)
      return inputItems.length > 0
        ? inputItems.map((item) => ({ ...item, json: { ...item.json, email: response, emailSent: true } }))
        : [{ json: { email: response, emailSent: true } }]
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
      const fetchOptions: RequestInit = { method, headers: { ...headers, ...getCredentialHeaders(config) } }
      if ((config.sendBody || config.body) && config.body && method !== 'GET') fetchOptions.body = String(config.body)
      const response = await fetch(finalUrl, fetchOptions)
      const contentType = response.headers.get('content-type')
      const data = contentType?.includes('application/json') ? await response.json() : await response.text()
      if (!response.ok) throw new Error(`HTTP Request failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      return [{ json: { status: response.status, statusText: response.statusText, data } }]
    }

    case 'code': {
      const fn = new Function('input', 'items', '$json', String(config.code || 'return input;'))
      return toWorkflowItems(fn(legacyInput, inputItems, firstItem.json))
    }

    case 'if-else': {
      const condition = String(config.condition || 'false')
      const trueItems: WorkflowItem[] = []
      const falseItems: WorkflowItem[] = []
      for (const item of inputItems) {
        const result = Boolean(evaluateExpression(condition, item, inputItems))
        ;(result ? trueItems : falseItems).push(item)
      }
      return { true: trueItems, false: falseItems }
    }

    case 'switch': {
      const cases = parseJsonConfig(config.cases, []) as string[]
      const branches: Record<string, WorkflowItem[]> = {}
      for (const item of inputItems) {
        const value = evaluateExpression(String(config.expression || 'undefined'), item, inputItems)
        const selectedIndex = cases.findIndex((entry) => entry === value)
        const key = selectedIndex >= 0 ? `case${selectedIndex}` : 'default'
        branches[key] = [...(branches[key] || []), item]
      }
      return branches
    }

    case 'set': {
      const assignments = parseJsonConfig(config.assignments, {}) as Record<string, unknown>
      return inputItems.map((item) => ({
        ...item,
        json: config.includeOtherFields === false ? assignments : { ...item.json, ...assignments },
      }))
    }

    case 'transform': {
      if (config.operation === 'limit') return inputItems.slice(0, Number(config.limit || 10))
      if (config.operation === 'customCode') {
        const fn = new Function('input', 'items', String(config.code || 'return items;'))
        return toWorkflowItems(fn(legacyInput, inputItems))
      }
      return inputItems
    }

    case 'filter': {
      const condition = String(config.condition || 'item => true')
      const fn = condition.includes('=>')
        ? new Function('item', '$json', `return (${condition})(item)`)
        : new Function('item', '$json', `return (${condition})`)
      return inputItems.filter((item) => Boolean(fn(item.json, item.json)))
    }

    case 'delay':
      await new Promise((resolve) => setTimeout(resolve, Number(config.seconds || 1) * 1000))
      return inputItems

    case 'stop-and-error':
      throw new Error(String(config.errorMessage || 'Workflow stopped by Stop and Error node'))

    case 'no-op':
    case 'respond-to-webhook':
    case 'merge':
    case 'split':
      return inputItems

    default:
      return inputItems
  }
}

export async function executeNodeForEachItem(
  node: WorkflowNode,
  inputItems: WorkflowItem[],
  ctx: WorkflowEngineContext
): Promise<{ items: WorkflowItem[]; itemErrors: WorkflowItemError[] }> {
  const outputItems: WorkflowItem[] = []
  const itemErrors: WorkflowItemError[] = []
  const continueOnItemError = node.data.config?.continueOnItemError !== false

  for (const [itemIndex, item] of inputItems.entries()) {
    try {
      const result = await executeNodeOnce(node, [item], ctx)
      if (!Array.isArray(result)) throw new Error('Per-item nodes must return WorkflowItem[]')
      outputItems.push(...result.map((output) => ({ ...output, pairedItem: item.pairedItem ?? itemIndex })))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      itemErrors.push({ itemIndex, message, input: item })
      if (!continueOnItemError) throw error
    }
  }

  if (outputItems.length === 0 && itemErrors.length > 0) {
    throw new Error(`${itemErrors.length} item(s) failed. First error: ${itemErrors[0].message}`)
  }

  return { items: outputItems, itemErrors }
}

export async function executeNode(
  node: WorkflowNode,
  input: unknown,
  ctx: WorkflowEngineContext
): Promise<WorkflowItem[] | Record<string, WorkflowItem[]>> {
  const inputItems = toWorkflowItems(input)
  if (getExecutionMode(node) === 'perItem') {
    const result = await executeNodeForEachItem(node, inputItems, ctx)
    return result.items
  }
  return executeNodeOnce(node, inputItems, ctx)
}

export { getExecutionMode }
