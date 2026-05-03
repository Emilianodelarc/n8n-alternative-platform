'use client'

import { useEffect, useCallback } from 'react'
import { useWorkflowStore } from '@/lib/workflow/store'

export function useKeyboardShortcuts() {
  const deleteNode = useWorkflowStore((s) => s.deleteNode)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const copyNodes = useWorkflowStore((s) => s.copyNodes)
  const pasteNodes = useWorkflowStore((s) => s.pasteNodes)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const canUndo = useWorkflowStore((s) => s.canUndo)
  const canRedo = useWorkflowStore((s) => s.canRedo)
  const pushUndoState = useWorkflowStore((s) => s.pushUndoState)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey

      // Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault()
        pushUndoState()
        deleteNode(selectedNodeId)
      }

      // Undo: Ctrl/Cmd + Z
      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) {
          undo()
        }
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((ctrlKey && e.shiftKey && e.key === 'z') || (ctrlKey && e.key === 'y')) {
        e.preventDefault()
        if (canRedo()) {
          redo()
        }
      }

      // Copy: Ctrl/Cmd + C
      if (ctrlKey && e.key === 'c' && selectedNodeId) {
        e.preventDefault()
        copyNodes([selectedNodeId])
      }

      // Paste: Ctrl/Cmd + V
      if (ctrlKey && e.key === 'v') {
        e.preventDefault()
        pushUndoState()
        pasteNodes({ x: 200, y: 200 })
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedNode(null)
      }
    },
    [selectedNodeId, deleteNode, undo, redo, canUndo, canRedo, copyNodes, pasteNodes, setSelectedNode, pushUndoState]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    canUndo: canUndo(),
    canRedo: canRedo(),
    undo,
    redo,
  }
}
