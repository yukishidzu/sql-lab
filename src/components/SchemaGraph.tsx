import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, useNodesState, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { EyeOff, LayoutGrid, List, Network } from 'lucide-react'
import type { DbTable, SchemaInfo } from '../types'
import { quoteIdentifier } from '../lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { CrowFootEdge } from './CrowFootEdge'

const edgeTypes = { crowfoot: CrowFootEdge }

type TableNode = Node<{ table: DbTable; junction: boolean; onColumnInsert: (text: string) => void }, 'table'>

function shortType(type: string) {
  return type.replace('without time zone', '')
}

function keyWidthForTable(table: DbTable) {
  if (table.columns.some((column) => column.primaryKey && column.foreignKey)) return 'w-9'
  if (table.columns.some((column) => column.primaryKey || column.foreignKey)) return 'w-5'
  return 'w-0'
}

function TableNodeCard({ data }: NodeProps<TableNode>) {
  const { table, junction, onColumnInsert } = data
  const keyWidth = keyWidthForTable(table)
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
          <span className="truncate">{column.name}</span><span className="ml-auto pl-2 text-[9px] text-muted-foreground">{shortType(column.dataType)}</span>
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
        secondFrame = requestAnimationFrame(() => { void fitView({ padding: 0.18, maxZoom: 1, duration: 150 }) })
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
  const automaticLayout = useMemo(() => {
    if (!schema.tables.some((table) => !layout[table.name])) return null
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({ rankdir: 'LR', nodesep: 45, ranksep: 80, marginx: 20, marginy: 20 })
    graph.setDefaultEdgeLabel(() => ({}))
    schema.tables.forEach((table) => graph.setNode(table.name, { width: 224, height: 52 + table.columns.length * 25 }))
    schema.relationships.forEach((relation) => graph.setEdge(relation.sourceTable, relation.targetTable))
    dagre.layout(graph)
    return Object.fromEntries(schema.tables.map((table) => {
      const node = graph.node(table.name)
      return [table.name, { x: node.x - 112, y: node.y - (52 + table.columns.length * 25) / 2 }]
    }))
  }, [schema, layout])
  useEffect(() => {
    if (automaticLayout) onLayoutChange(automaticLayout)
  }, [automaticLayout, onLayoutChange])
  const initialNodes = useMemo<TableNode[]>(() => schema.tables.map((table) => ({
    id: table.name,
    type: 'table',
    position: automaticLayout?.[table.name] ?? layout[table.name] ?? { x: 0, y: 0 },
    data: { table, junction: schema.relationships.some((relation) => relation.sourceTable === table.name && relation.junction), onColumnInsert },
  })), [schema, automaticLayout, layout, onColumnInsert])
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>(initialNodes)
  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  const edges = useMemo<Edge[]>(() => schema.relationships.map((relation) => ({
    id: relation.id,
    source: relation.sourceTable,
    target: relation.targetTable,
    sourceHandle: `${relation.sourceColumns[0]}:source`,
    targetHandle: `${relation.targetColumns[0]}:target`,
    ariaLabel: `${relation.sourceTable}.${relation.sourceColumns.join(', ')} — ${relation.cardinality} — ${relation.targetTable}.${relation.targetColumns.join(', ')}`,
    type: 'crowfoot',
    data: { cardinality: relation.cardinality },
    animated: false,
    className: 'erd-edge',
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
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3"><h2 className="text-sm font-semibold">Схема</h2><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon" className="size-8" onClick={() => setTree(!tree)} aria-label={tree ? 'Показать ERD' : 'Показать список'}>{tree ? <Network size={15} /> : <List size={15} />}</Button><Button variant="ghost" size="icon" className="size-8" onClick={resetLayout} aria-label="Автоматическая раскладка"><LayoutGrid size={15} /></Button>{onHide && <Button variant="ghost" size="icon" className="size-8" onClick={onHide} aria-label="Скрыть схему" title="Скрыть схему"><EyeOff size={15} /></Button>}</div></div>
      {tree ? <div className="min-h-0 flex-1 overflow-auto p-3">{schema.tables.map((table) => <div key={table.name} className="mb-2 rounded-lg border border-border"><button className="w-full cursor-pointer px-3 py-2 text-left font-mono text-xs font-semibold hover:bg-accent" onClick={() => onTableOpen(table.name)}>{table.name}</button><div className="border-t border-border p-1">{table.columns.map((column) => <button key={column.name} className="block w-full cursor-pointer rounded px-2 py-1 text-left font-mono text-[11px] text-muted-foreground hover:bg-accent" onClick={() => onColumnInsert(`${quoteIdentifier(table.name)}.${quoteIdentifier(column.name)}`)}><span className="flex items-center gap-1.5"><span className={`flex ${keyWidthForTable(table)} justify-center gap-0.5 text-[9px] font-semibold`}>{column.primaryKey && <span className="text-amber-600 dark:text-amber-400">PK</span>}{column.foreignKey && <span className="text-primary">FK</span>}</span><span>{column.name}</span><span className="ml-auto text-muted-foreground">{shortType(column.dataType)}</span></span></button>)}</div></div>)}</div> : <div ref={flowContainerRef} className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          className={dark ? 'dark' : 'light'}
          onNodesChange={onNodesChange}
          onNodeDragStop={savePositions}
          onNodeClick={(_, node) => onTableOpen(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.8}
          nodesConnectable={false}
          elementsSelectable
          deleteKeyCode={null}
          proOptions={{ hideAttribution: false }}
        >
          <FitView schema={schema} nonce={fitNonce} containerRef={flowContainerRef} />
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" style={{ width: 112, height: 76 }} nodeColor={dark ? '#4b5565' : '#a4adbb'} maskColor={dark ? '#14161acc' : '#dce2e8aa'} />
        </ReactFlow>
      </div>}
      {!schema.tables.length && <div className="absolute inset-11 grid place-items-center text-center text-sm text-muted-foreground"><div>Таблиц пока нет.<br />Создайте первую через редактор сценария.</div></div>}
    </section>
  )
}
