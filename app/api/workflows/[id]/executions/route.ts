import { NextResponse } from 'next/server'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { listExecutions } from '@/lib/db/workflows'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    const executions = await listExecutions(id)
    return NextResponse.json({ executions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

