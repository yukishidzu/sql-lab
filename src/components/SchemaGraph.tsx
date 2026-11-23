import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, useNodesState, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { EyeOff, LayoutGrid, List, Network } from 'lucide-react'
import type { DbTable, SchemaInfo } from '../types'
import { quoteIdentifier } from '../lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

type TableNode = Node<{ table: DbTable; junction: boolean; onColumnInsert: (text: string) => void }, 'table'>

function TableNodeCard({ data }: NodeProps<TableNode>) {
  const { table, junction, onColumnInsert } = data
  const hasCompositeKeys = table.columns.some((column) => column.primaryKey && column.foreignKey)
  const hasKeys = table.columns.some((column) => column.primaryKey || column.foreignKey)
  const keyWidth = hasCompositeKeys ? 'w-9' : hasKeys ? 'w-5' : 'w-0'
  return (
    <div className="w-56 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/65 px-3 py-2"><Network size={13} className="text-primary" /><span className="truncate font-mono text-xs font-semibold">{table.name}</span>{junction && <Badge className="ml-auto bg-primary/12 text-primary">M:N</Badge>}</div>
      <div className="py-1">{table.columns.map((column) => <div key={column.name} className="relative">
        <Handle id={`${column.name}:target`} type="target" position={Position.Left} className="!pointer-events-none !size-1.5 !border-0 !bg-primary !opacity-0" />
        <button data-column={column.name} onClick={(event) => { event.stopPropagation(); onColumnInsert(`${quoteIdentifier(table.name)}.${quoteIdentifier(column.name)}`) }} className="nodrag flex min-h-6 w-full cursor-pointer items-center gap-1 px-2 py-1 text-left font-mono text-[10px] hover:bg-accent" title="Вставить колонку в SQL">
          <span className={`flex ${keyWidth} shrink-0 items-center justify-center gap-0.5 text-[8px] font-semibold`} data-keys={`${column.primaryKey ? 'PK' : ''}${column.foreignKey ? 'FK' : ''}`}>
            {column.primaryKey && <span className="text-amber-600 dark:text-amber-400">PK</span>}
            {column.foreignKey && <span className="text-primary">FK</span>}
          </span>
          <span className="truncate">{column.name}</span><span className="ml-auto pl-2 text-[9px] text-muted-foreground">{column.dataType.replace('without time zone', '')}</span>
        </button>
        <Handle id={`${column.name}:source`} type="source" position={Position.Right} className="!pointer-events-none !size-1.5 !border-0 !bg-primary !opacity-0" />
      </div>)}</div>
    </div>
  )
}

const nodeTypes = { table: TableNodeCard }

function FitView({ schema, nonce, containerRef }: { schema: SchemaInfo; nonce: number; containerRef: RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    const fit = () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => { void fitView({ padding: 0.12, maxZoom: 1, duration: 150 }) })
      })
    }
    const observer = new ResizeObserver(fit)
    if (containerRef.current) observer.observe(containerRef.current)
    fit()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [schema, nonce, containerRef, fitView])
  return null
}

export function SchemaGraph({ schema, layout, dark, onLayoutChange, onTableOpen, onColumnInsert, onHide }: {
  schema: SchemaInfo
  layout: Record<string, { x: number; y: number }>
  dark: boolean
  onLayoutChange: (layout: Record<string, { x: number; y: number }>) => void
  onTableOpen: (table: string) => void
  onColumnInsert: (text: string) => void
  onHide?: () => void
}) {
  const [tree, setTree] = useState(false)
  const [fitNonce, setFitNonce] = useState(0)
  const flowContainerRef = useRef<HTMLDivElement>(null)
  const initialNodes = useMemo<TableNode[]>(() => {
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({ rankdir: 'LR', nodesep: 45, ranksep: 80, marginx: 20, marginy: 20 })
    graph.setDefaultEdgeLabel(() => ({}))
    schema.tables.forEach((table) => graph.setNode(table.name, { width: 224, height: 52 + table.columns.length * 25 }))
    schema.relationships.forEach((relation) => graph.setEdge(relation.sourceTable, relation.targetTable))
    dagre.layout(graph)
    return schema.tables.map((table) => ({
      id: table.name,
      type: 'table',
      position: layout[table.name] ?? (() => { const node = graph.node(table.name); return { x: node.x - 112, y: node.y - (52 + table.columns.length * 25) / 2 } })(),
      data: { table, junction: schema.relationships.some((relation) => relation.sourceTable === table.name && relation.junction), onColumnInsert },
    }))
  }, [schema, layout, onColumnInsert])
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>(initialNodes)
  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  const edges = useMemo<Edge[]>(() => schema.relationships.map((relation) => ({
    id: relation.id,
    source: relation.sourceTable,
    target: relation.targetTable,
    sourceHandle: `${relation.sourceColumns[0]}:source`,
    targetHandle: `${relation.targetColumns[0]}:target`,
    ariaLabel: `${relation.sourceTable}.${relation.sourceColumns.join(', ')} — ${relation.cardinality} — ${relation.targetTable}.${relation.targetColumns.join(', ')}`,
    type: relation.sourceTable === relation.targetTable ? 'smoothstep' : 'default',
    animated: false,
    className: 'erd-edge',
    style: { strokeWidth: 1.25 },
    markerStart: relation.cardinality === '1:N' ? 'url(#crowfoot)' : 'url(#one-cardinality)',
    markerEnd: 'url(#one-cardinality)',
  })), [schema])

  const savePositions = useCallback(() => {
    setNodes((current) => {
      onLayoutChange(Object.fromEntries(current.map((node) => [node.id, node.position])))
      return current
    })
  }, [onLayoutChange, setNodes])

  const resetLayout = () => {
    onLayoutChange({})
    setFitNonce((value) => value + 1)
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-background" aria-label="ERD-схема базы данных">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3"><h2 className="text-sm font-semibold">Схема</h2><Badge>PostgreSQL</Badge><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon" className="size-8" onClick={() => setTree(!tree)} aria-label={tree ? 'Показать ERD' : 'Показать список'}>{tree ? <Network size={15} /> : <List size={15} />}</Button><Button variant="ghost" size="icon" className="size-8" onClick={resetLayout} aria-label="Автоматическая раскладка"><LayoutGrid size={15} /></Button>{onHide && <Button variant="ghost" size="icon" className="size-8" onClick={onHide} aria-label="Скрыть схему" title="Скрыть схему"><EyeOff size={15} /></Button>}</div></div>
      {tree ? <div className="min-h-0 flex-1 overflow-auto p-3">{schema.tables.map((table) => <div key={table.name} className="mb-2 rounded-lg border border-border"><button className="w-full cursor-pointer px-3 py-2 text-left font-mono text-xs font-semibold hover:bg-accent" onClick={() => onTableOpen(table.name)}>{table.name}</button><div className="border-t border-border p-1">{table.columns.map((column) => <button key={column.name} className="block w-full cursor-pointer rounded px-2 py-1 text-left font-mono text-[11px] text-muted-foreground hover:bg-accent" onClick={() => onColumnInsert(`${quoteIdentifier(table.name)}.${quoteIdentifier(column.name)}`)}>{column.name} · {column.dataType}</button>)}</div></div>)}</div> : <div ref={flowContainerRef} className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          className={dark ? 'dark' : 'light'}
          onNodesChange={onNodesChange}
          onNodeDragStop={savePositions}
          onNodeClick={(_, node) => onTableOpen(node.id)}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.8}
          nodesConnectable={false}
          elementsSelectable
          deleteKeyCode={null}
          proOptions={{ hideAttribution: false }}
        >
          <FitView schema={schema} nonce={fitNonce} containerRef={flowContainerRef} />
          <svg width="0" height="0" className="absolute"><defs>
            <marker id="crowfoot" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M12 1 L3 5 L12 9 M3 1 L3 9" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.25" /></marker>
            <marker id="one-cardinality" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M7 2 L7 8 M3 2 L3 8" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.25" /></marker>
          </defs></svg>
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" style={{ width: 112, height: 76 }} nodeColor="var(--secondary)" maskColor="color-mix(in srgb, var(--background) 65%, transparent)" />
        </ReactFlow>
      </div>}
      {!schema.tables.length && <div className="absolute inset-11 grid place-items-center text-center text-sm text-muted-foreground"><div>Таблиц пока нет.<br />Создайте первую через редактор сценария.</div></div>}
    </section>
  )
}
