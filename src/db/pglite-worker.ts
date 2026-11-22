import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'

worker({
  async init(options) {
    const db = new PGlite({
      dataDir: options.dataDir,
      loadDataDir: options.loadDataDir,
      relaxedDurability: false,
    })
    const tools = new BroadcastChannel(`sql-lab-tools:${options.id}`)
    tools.onmessage = async (event) => {
      if (event.data?.type !== 'dump') return
      try {
        const { pgDump } = await import('@electric-sql/pglite-tools/pg_dump')
        const snapshot = await db.dumpDataDir()
        const copy = new PGlite({ loadDataDir: snapshot })
        try {
          const file = await pgDump({ pg: copy })
          tools.postMessage({ type: 'dump-result', requestId: event.data.requestId, dump: await file.text() })
        } finally {
          await copy.close()
        }
      } catch (error) {
        tools.postMessage({ type: 'dump-result', requestId: event.data.requestId, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return db
  },
})
