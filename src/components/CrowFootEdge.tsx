import { BaseEdge, getBezierPath, Position, type Edge, type EdgeProps } from '@xyflow/react'

type Cardinality = '1' | 'N'

function Glyph({ x, y, kind, otherX, otherY, position }: { x: number; y: number; kind: Cardinality; otherX: number; otherY: number; position: Position }) {
  const length = Math.hypot(otherX - x, otherY - y) || 1
  const dx = length === 1 ? (position === Position.Right ? 1 : position === Position.Left ? -1 : 0) : (otherX - x) / length
  const dy = length === 1 ? (position === Position.Bottom ? 1 : position === Position.Top ? -1 : 0) : (otherY - y) / length
  const px = -dy
  const py = dx
  const paths: string[] = []
  if (kind === '1') {
    for (const offset of [2, 7]) {
      paths.push(`M ${x + dx * offset + px * 5} ${y + dy * offset + py * 5} L ${x + dx * offset - px * 5} ${y + dy * offset - py * 5}`)
    }
  } else {
    const ox = x + dx * 9
    const oy = y + dy * 9
    paths.push(
      `M ${ox} ${oy} L ${x} ${y}`,
      `M ${ox} ${oy} L ${x + px * 9} ${y + py * 9}`,
      `M ${ox} ${oy} L ${x - px * 9} ${y - py * 9}`,
    )
  }
  return <path d={paths.join(' ')} fill="none" stroke="var(--erd-edge)" strokeWidth={1.45} strokeLinecap="round" data-cardinality={kind} />
}

export function CrowFootEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps<Edge<{ cardinality: '1:1' | '1:N' }>>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: 'var(--erd-edge)', strokeWidth: 1.5 }} />
      <Glyph x={sourceX} y={sourceY} kind={data?.cardinality === '1:N' ? 'N' : '1'} otherX={targetX} otherY={targetY} position={sourcePosition} />
      <Glyph x={targetX} y={targetY} kind="1" otherX={sourceX} otherY={sourceY} position={targetPosition} />
    </>
  )
}
