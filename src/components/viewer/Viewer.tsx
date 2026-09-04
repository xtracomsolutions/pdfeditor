import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../state/store'
import type { OpenDoc } from '../../state/types'
import { PageCanvas } from './PageCanvas'

const GAP = 28

export function Viewer({ doc }: { doc: OpenDoc }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { zoom, fitMode, spread } = useApp((s) => s.ui)
  const setZoom = useApp((s) => s.setZoom)
  const setCurrentPage = useApp((s) => s.setCurrentPage)
  const [{ containerW, containerH }, setSize] = useState({
    containerW: 0,
    containerH: 0,
  })

  // widest page drives fit-to-width so every page aligns
  const maxW = Math.max(...doc.pages.map((p) => (p.userRotation % 180 === 0 ? p.width : p.height)))
  const maxH = Math.max(...doc.pages.map((p) => (p.userRotation % 180 === 0 ? p.height : p.width)))

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () =>
      setSize({ containerW: el.clientWidth, containerH: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // resolve fit modes to a concrete scale
  const pad = 48
  const cols = spread ? 2 : 1
  let scale = zoom
  if (fitMode === 'width' && containerW)
    scale = (containerW - pad - (cols - 1) * GAP) / (maxW * cols)
  else if (fitMode === 'page' && containerW && containerH) {
    scale = Math.min(
      (containerW - pad - (cols - 1) * GAP) / (maxW * cols),
      (containerH - pad) / maxH,
    )
  } else if (fitMode === 'actual') scale = 1

  useEffect(() => {
    if (fitMode !== 'custom' && scale > 0 && Math.abs(scale - zoom) > 0.001)
      setZoom(scale, fitMode)
  }, [scale, fitMode, zoom, setZoom])

  // track the page nearest the viewport centre
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = el.scrollTop + el.clientHeight / 2
        const nodes = el.querySelectorAll<HTMLElement>('[data-page]')
        let best = 1
        let bestD = Infinity
        nodes.forEach((n) => {
          const c = n.offsetTop + n.offsetHeight / 2
          const d = Math.abs(c - mid)
          if (d < bestD) {
            bestD = d
            best = Number(n.dataset.page)
          }
        })
        setCurrentPage(best)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [setCurrentPage])

  const effScale = fitMode === 'custom' ? zoom : scale

  return (
    <div
      ref={scrollRef}
      className="chrome-scroll relative h-full overflow-auto bg-ink-2"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div
        className={`mx-auto flex flex-wrap content-start justify-center gap-x-7 gap-y-10 px-6 py-8 ${
          spread ? '' : 'flex-col items-center'
        }`}
        style={{
          width: spread
            ? Math.max(containerW, maxW * 2 * effScale + GAP + 48)
            : '100%',
          minHeight: '100%',
        }}
      >
        {doc.pages.map((p, i) => (
          <PageCanvas
            key={p.id}
            docId={doc.id}
            page={p}
            pageNumber={i + 1}
            scale={effScale > 0 ? effScale : 1}
          />
        ))}
      </div>
    </div>
  )
}
