import { NextResponse } from 'next/server'
import type { Workflow } from '@/lib/workflow/types'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { deleteWorkflowById, getWorkflow, upsertWorkflow } from '@/lib/db/workflows'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    const workflow = await getWorkflow(id)
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    return NextResponse.json({ workflow })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    const existing = await getWorkflow(id)
    const body = await request.json()
    const now = new Date().toISOString()
    const workflow: Workflow = {
      id,
      name: body.name || existing?.name || 'Untitled workflow',
      description: body.description ?? existing?.description,
      nodes: body.nodes || existing?.nodes || [],
      edges: body.edges || existing?.edges || [],
      variables: body.variables || existing?.variables || {},
      createdAt: body.createdAt || existing?.createdAt || now,
      updatedAt: body.updatedAt || now,
    }

    const saved = await upsertWorkflow(workflow)
    return NextResponse.json({ workflow: saved })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    await deleteWorkflowById(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

