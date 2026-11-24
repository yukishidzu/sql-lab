import { lazy, Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { HomePage } from './pages/HomePage'
import { decodeScenario } from './lib/share'
import { createWorkspaceRecord } from './lib/store'
import { Button } from './components/ui/button'
import type { WorkspaceMode } from './types'

const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })))

function ImportPage({ payload }: { payload: string }) {
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void decodeScenario(payload).then(async (scenario) => {
      const workspace = await createWorkspaceRecord(scenario)
      if (active) location.hash = `/w/${workspace.id}`
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false }
  }, [payload])
  return <div className="grid h-full place-items-center p-5"><div className="max-w-md text-center">{error ? <><h1 className="mb-2 text-lg font-semibold">Не удалось открыть сценарий</h1><p className="mb-4 text-sm text-muted-foreground">{error}</p><Button onClick={() => { location.hash = '/' }}>На главную</Button></> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />Распаковываем сценарий…</div>}</div></div>
}

export default function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const update = () => setHash(location.hash)
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  const workspace = hash.match(/^#\/w\/([a-z0-9-]+)/i)
  if (workspace) {
    const requestedMode = new URLSearchParams(hash.split('?')[1]).get('mode')
    const mode = requestedMode === 'edit' || requestedMode === 'learn' ? requestedMode as WorkspaceMode : undefined
    return <Suspense fallback={<div className="grid h-full place-items-center"><Loader2 className="animate-spin text-primary" /></div>}><WorkspacePage id={workspace[1]} requestedMode={mode} /></Suspense>
  }
  if (hash.startsWith('#/import/')) return <ImportPage payload={hash.slice('#/import/'.length)} />
  return <HomePage />
}
