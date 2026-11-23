import { BaseEdge, getSmoothStepPath, Position, type Edge, type EdgeProps } from '@xyflow/react'

type Cardinality = '1' | 'N'

function Glyph({ x, y, kind, position }: { x: number; y: number; kind: Cardinality; position: Position }) {
  const direction = position === Position.Right ? 1 : -1
  const edgeX = x + direction * 3
  const paths: string[] = []
  if (kind === '1') {
    for (const offset of [0, 4]) {
      const lineX = edgeX + direction * offset
      paths.push(`M ${lineX} ${y - 5} L ${lineX} ${y + 5}`)
    }
  } else {
    const originX = edgeX + direction * 9
    paths.push(
      `M ${originX} ${y - 7} L ${edgeX} ${y}`,
      `M ${originX} ${y} L ${edgeX} ${y}`,
      `M ${originX} ${y + 7} L ${edgeX} ${y}`,
    )
  }
  return <path d={paths.join(' ')} fill="none" stroke="var(--erd-edge)" strokeWidth={1.45} strokeLinecap="round" data-cardinality={kind} />
}

export function CrowFootEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps<Edge<{ cardinality: '1:1' | '1:N' }>>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12 })
  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: 'var(--erd-edge)', strokeWidth: 1.5 }} />
      <Glyph x={sourceX} y={sourceY} kind={data?.cardinality === '1:N' ? 'N' : '1'} position={sourcePosition} />
      <Glyph x={targetX} y={targetY} kind="1" position={targetPosition} />
    </>
  )
}
