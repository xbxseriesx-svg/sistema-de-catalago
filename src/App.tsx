import React, { useEffect } from 'react'
import { AdminGate } from './admin/AdminGate'
import { EditorShell } from './editor/EditorShell'
import { DocumentPreview } from './editor/DocumentPreview'
import { useEditorStore } from './editor/store'

function applyFavicon(src: string) {
  if (!src) return
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = src
}

function PublicPortal() {
  const published = useEditorStore(s => s.published)
  useEffect(() => {
    document.title = `${published.identity.companyName} · Catálogo Digital`
    applyFavicon(published.identity.favicon)
  }, [published.identity.companyName, published.identity.favicon])
  return <DocumentPreview document={published} device="desktop" visitorMode />
}

export default function App() {
  const path = window.location.pathname
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminGate><EditorShell /></AdminGate>
  return <PublicPortal />
}
