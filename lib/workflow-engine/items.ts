import type { WorkflowItem } from './types'

export function isWorkflowItem(value: unknown): value is WorkflowItem {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'json' in value &&
      (value as { json?: unknown }).json &&
      typeof (value as { json?: unknown }).json === 'object' &&
      !Array.isArray((value as { json?: unknown }).json)
  )
}

export function toWorkflowItems(value: unknown): WorkflowItem[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) {
    if (value.every(isWorkflowItem)) return value
    return value.map((item, index) => ({
      json: normalizeJsonObject(item),
      pairedItem: index,
    }))
  }
  if (isWorkflowItem(value)) return [value]
  return [{ json: normalizeJsonObject(value) }]
}

export function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return { value }
}

export function firstJson(items: WorkflowItem[]): unknown {
  return items[0]?.json
}

export function itemJsonOrLegacyInput(items: WorkflowItem[]): unknown {
  if (items.length === 0) return undefined
  if (items.length === 1) return items[0].json
  return items.map((item) => item.json)
}
