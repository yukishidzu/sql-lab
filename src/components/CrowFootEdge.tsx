import { BaseEdge, getSmoothStepPath, Position, type Edge, type EdgeProps } from '@xyflow/react'

type Cardinality = '1' | 'N'

function Glyph({ x, y, kind, position, active, dimmed }: { x: number; y: number; kind: Cardinality; position: Position; active: boolean; dimmed: boolean }) {
  const direction = position === Position.Right ? 1 : -1
  const edgeX = x
  const paths: string[] = []
  if (kind === '1') {
    for (const offset of [0, 4]) {
      const lineX = edgeX + direction * offset
      paths.push(`M ${lineX} ${y - 5} L ${lineX} ${y + 5}`)
    }
  } else {
    const originX = x + direction * 10
    paths.push(
      `M ${originX} ${y} L ${edgeX} ${y - 5}`,
      `M ${originX} ${y} L ${edgeX} ${y}`,
      `M ${originX} ${y} L ${edgeX} ${y + 5}`,
    )
  }
  return <path d={paths.join(' ')} fill="none" stroke={active ? 'var(--primary)' : 'var(--erd-edge)'} strokeWidth={1.45} strokeLinecap="round" data-cardinality={kind} opacity={dimmed ? 0.35 : 1} />
}

export function CrowFootEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps<Edge<{ id: string; cardinality: '1:1' | '1:N'; stepPosition?: number; onHover: (id: string | null) => void; active: boolean; dimmed: boolean }>>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 6, offset: 12, stepPosition: data?.stepPosition })
  const active = data?.active ?? false
  const dimmed = data?.dimmed ?? false
  return (
    <g onMouseEnter={() => data?.onHover(data?.id ?? null)} onMouseLeave={() => data?.onHover(null)} style={{ cursor: 'pointer' }}>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: active ? 'var(--primary)' : 'var(--erd-edge)', strokeWidth: active ? 1.8 : 1.5, opacity: dimmed ? 0.35 : 1 }} />
      <Glyph x={sourceX} y={sourceY} kind={data?.cardinality === '1:N' ? 'N' : '1'} position={sourcePosition} active={active} dimmed={dimmed} />
      <Glyph x={targetX} y={targetY} kind="1" position={targetPosition} active={active} dimmed={dimmed} />
    </g>
  )
}
