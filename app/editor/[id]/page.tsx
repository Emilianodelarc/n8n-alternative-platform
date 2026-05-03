'use client'

import { use } from 'react'
import { WorkflowEditor } from '@/components/workflow/editor'

interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default function EditorPage({ params }: EditorPageProps) {
  const { id } = use(params)
  return <WorkflowEditor workflowId={id} />
}
