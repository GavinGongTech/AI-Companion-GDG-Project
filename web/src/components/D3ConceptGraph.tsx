import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import type { ConceptNode } from '../types/api'
import { accuracyColor } from '../lib/colors'
import { formatConceptLabel } from '../lib/format'
import styles from './D3ConceptGraph.module.css'

interface Props {
  nodes: ConceptNode[]
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  accuracy: number
  interactions: number
}

function nodeRadius(interactions: number): number {
  return Math.max(8, Math.min(28, interactions * 4 + 6))
}

export function D3ConceptGraph({ nodes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const simNodes = useMemo<SimNode[]>(() =>
    nodes.map((n) => ({
      id: n.conceptNode,
      label: formatConceptLabel(n.conceptNode),
      accuracy: n.accuracyRate,
      interactions: n.interactionCount,
    })),
    [nodes]
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || simNodes.length === 0) return

    const W = svg.clientWidth || 600
    const H = svg.clientHeight || 380

    // Preserve the user's current pan/zoom position across data refetches.
    const prevTransform = d3.zoomTransform(svg)
    d3.select(svg).selectAll('*').remove()

    const g = d3.select(svg).append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (e) => g.attr('transform', e.transform))
    d3.select(svg).call(zoom).call(zoom.transform, prevTransform)

    const nodesCopy = simNodes.map((n) => ({ ...n }))

    const simulation = d3.forceSimulation(nodesCopy)
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<SimNode>((n) => nodeRadius(n.interactions) + 12))

    const nodeG = g.selectAll<SVGGElement, SimNode>('g.node')
      .data(nodesCopy)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')

    nodeG.append('circle')
      .attr('r', (d) => nodeRadius(d.interactions))
      .style('fill', (d) => accuracyColor(d.accuracy))
      .attr('fill-opacity', 0.85)
      .style('stroke', (d) => accuracyColor(d.accuracy))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)

    nodeG.append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeRadius(d.interactions) + 14)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--text-muted)')
      .style('pointer-events', 'none')

    nodeG.append('title')
      .text((d) => `${d.label}\nAccuracy: ${Math.round(d.accuracy * 100)}%\nInteractions: ${d.interactions}`)

    simulation.on('tick', () => {
      nodeG.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [simNodes])

  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No concepts yet — start studying to build your graph.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}
