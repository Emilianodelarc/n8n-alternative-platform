import { NextResponse } from 'next/server'
import type { Workflow } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { listWorkflows, upsertWorkflow } from '@/lib/db/workflows'

export async function GET() {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const workflows = await listWorkflows()
    return NextResponse.json({ workflows })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const body = await request.json()
    const now = new Date().toISOString()
    const workflow: Workflow = {
      id: body.id || crypto.randomUUID(),
      name: body.name || 'Untitled workflow',
      description: body.description || undefined,
      nodes: body.nodes || [],
      edges: body.edges || [],
      variables: body.variables || {},
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    }

    const saved = await upsertWorkflow(workflow)
    return NextResponse.json({ workflow: saved }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

