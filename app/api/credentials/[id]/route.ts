import { NextResponse } from 'next/server'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { getSql } from '@/lib/db/neon'
import { initializeDatabase } from '@/lib/db/workflows'

interface RouteContext {
  params: Promise<{ id: string }>
}

type CredentialRow = {
  id: string
  name: string
  service: string
  config: Record<string, unknown>
  created_at: Date | string
  updated_at: Date | string
}

function mapCredential(row: CredentialRow) {
  return {
    id: row.id,
    name: row.name,
    service: row.service,
    config: row.config || {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    const body = await request.json()
    await initializeDatabase()
    const sql = getSql()
    const rows = await sql`
      UPDATE credentials
      SET
        name = COALESCE(${body.name || null}, name),
        service = COALESCE(${body.service || null}, service),
        config = COALESCE(${body.config ? JSON.stringify(body.config) : null}::jsonb, config),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, service, config, created_at, updated_at
    ` as CredentialRow[]

    if (rows.length === 0) return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    return NextResponse.json({ credential: mapCredential(rows[0]) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const { id } = await context.params
    await initializeDatabase()
    const sql = getSql()
    await sql`DELETE FROM credentials WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
