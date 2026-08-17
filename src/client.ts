import mermaid from 'mermaid'

interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
}

interface RenderRecord {
  readonly block: HTMLElement
  readonly originalChildren: readonly HTMLElement[]
  readonly addition: HTMLElement
  readonly disposeWorkspace: () => void
}

const BLOCK_SELECTOR = '.md-code-block'
const OWNED_ATTRIBUTE = 'data-dsh-mermaid-state'
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const WORKSPACE_MIN_ZOOM = 0.05
const WORKSPACE_MAX_ZOOM = 8
const WORKSPACE_ZOOM_FACTOR = 1.25

const styles = `
.dsh-mermaid-render {
  margin: 0.75rem 0;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.25));
  border-radius: 0.75rem;
  background: var(--dsw-alias-surface-primary, transparent);
}
.dsh-mermaid-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.25));
}
.dsh-mermaid-toolbar-spacer {
  flex: 1;
}
.dsh-mermaid-toolbar button {
  min-width: 2rem;
  height: 1.75rem;
  padding: 0 0.5rem;
  border: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.3));
  border-radius: 0.4rem;
  color: inherit;
  background: var(--dsw-alias-surface-secondary, rgba(127, 127, 127, 0.08));
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.dsh-mermaid-toolbar button:hover:not(:disabled) {
  background: var(--dsw-alias-surface-tertiary, rgba(127, 127, 127, 0.16));
}
.dsh-mermaid-toolbar button:focus-visible {
  outline: 2px solid var(--dsw-alias-interactive-primary, currentColor);
  outline-offset: 1px;
}
.dsh-mermaid-toolbar button:disabled {
  cursor: default;
  opacity: 0.4;
}
.dsh-mermaid-toolbar .dsh-mermaid-zoom-reset {
  min-width: 3.75rem;
  font-variant-numeric: tabular-nums;
}
.dsh-mermaid-toolbar .dsh-mermaid-expand {
  min-width: 4.5rem;
}
.dsh-mermaid-canvas {
  display: block;
  overflow-x: auto;
  padding: 1rem;
}
.dsh-mermaid-stage {
  position: relative;
  margin: 0 auto;
}
.dsh-mermaid-stage svg {
  display: block;
  transform-origin: top left;
}
.dsh-mermaid-source {
  border-top: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.25));
  color: var(--dsw-alias-text-secondary, inherit);
  font-size: 0.8rem;
}
.dsh-mermaid-source summary {
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  user-select: none;
}
.dsh-mermaid-source pre {
  margin: 0;
  overflow-x: auto;
  padding: 0 0.75rem 0.75rem;
  white-space: pre;
}
.dsh-mermaid-error {
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid #c44;
  color: var(--dsw-alias-text-secondary, inherit);
  font-size: 0.8rem;
}
.dsh-mermaid-workspace {
  inset: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--dsw-alias-text-primary, inherit);
  background: var(--dsw-alias-surface-primary, #fff);
}
.dsh-mermaid-workspace::backdrop {
  background: rgba(0, 0, 0, 0.55);
}
.dsh-mermaid-workspace-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  height: 100%;
}
.dsh-mermaid-workspace-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.25));
}
.dsh-mermaid-workspace-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.dsh-mermaid-workspace-hint {
  color: var(--dsw-alias-text-secondary, inherit);
  font-size: 0.75rem;
}
.dsh-mermaid-workspace-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}
.dsh-mermaid-workspace-controls button {
  min-width: 2.25rem;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.3));
  border-radius: 0.4rem;
  color: inherit;
  background: var(--dsw-alias-surface-secondary, rgba(127, 127, 127, 0.08));
  font: inherit;
  cursor: pointer;
}
.dsh-mermaid-workspace-controls button:hover:not(:disabled) {
  background: var(--dsw-alias-surface-tertiary, rgba(127, 127, 127, 0.16));
}
.dsh-mermaid-workspace-controls button:focus-visible,
.dsh-mermaid-workspace-viewport:focus-visible {
  outline: 2px solid var(--dsw-alias-interactive-primary, currentColor);
  outline-offset: -2px;
}
.dsh-mermaid-workspace-controls .dsh-mermaid-workspace-zoom {
  min-width: 3.75rem;
  font-variant-numeric: tabular-nums;
}
.dsh-mermaid-workspace-controls .dsh-mermaid-workspace-fit {
  min-width: 3.25rem;
}
.dsh-mermaid-workspace-controls .dsh-mermaid-workspace-close {
  min-width: 4rem;
}
.dsh-mermaid-workspace-viewport {
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  cursor: grab;
  touch-action: none;
  background-color: var(--dsw-alias-surface-secondary, rgba(127, 127, 127, 0.04));
  background-image: radial-gradient(rgba(127, 127, 127, 0.22) 0.75px, transparent 0.75px);
  background-size: 16px 16px;
}
.dsh-mermaid-workspace-viewport[data-dragging] {
  cursor: grabbing;
}
.dsh-mermaid-workspace-stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  will-change: transform;
}
.dsh-mermaid-workspace-stage svg {
  display: block;
  transform: none;
}
.dsh-mermaid-workspace-source {
  max-height: 30dvh;
  overflow: auto;
  border-top: 1px solid var(--dsw-alias-border-subtle, rgba(127, 127, 127, 0.25));
}
.dsh-mermaid-workspace-source summary {
  cursor: pointer;
  padding: 0.55rem 0.75rem;
  color: var(--dsw-alias-text-secondary, inherit);
  font-size: 0.8rem;
}
.dsh-mermaid-workspace-source pre {
  margin: 0;
  overflow: auto;
  padding: 0 0.75rem 0.75rem;
  white-space: pre;
}
@media (max-width: 720px) {
  .dsh-mermaid-workspace-hint {
    display: none;
  }
  .dsh-mermaid-workspace-header {
    gap: 0.35rem;
    padding: 0.45rem;
  }
  .dsh-mermaid-workspace-controls button {
    padding: 0 0.45rem;
  }
}
`

function blockLanguage(block: HTMLElement): string | undefined {
  const bannerWrap = block.children.item(0)
  const banner = bannerWrap?.children.item(0)
  const info = banner?.children.item(0)
  const language = info?.textContent?.trim().toLowerCase()
  return language === '' ? undefined : language
}

function blockSource(block: HTMLElement): string | undefined {
  const body = block.children.item(1)
  const pre = body instanceof HTMLPreElement ? body : body?.querySelector('pre')
  const source = pre?.textContent
  return source === null || source === undefined ? undefined : source
}

function sourceDetails(source: string): HTMLDetailsElement {
  const details = document.createElement('details')
  details.className = 'dsh-mermaid-source'
  const summary = document.createElement('summary')
  summary.textContent = 'Mermaid source'
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = source
  pre.append(code)
  details.append(summary, pre)
  return details
}

interface DiagramSize {
  readonly width: number
  readonly height: number
}

interface InlineZoomControls {
  readonly element: HTMLElement
  get(): number
  set(value: number): void
}

interface WorkspaceManager {
  open(): void
  dispose(): void
}

function diagramSize(svg: SVGSVGElement): DiagramSize {
  const rect = svg.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height }
  const viewBox = svg.viewBox.baseVal
  if (viewBox.width > 0 && viewBox.height > 0) return { width: viewBox.width, height: viewBox.height }
  throw new Error('Mermaid returned an SVG with no measurable dimensions')
}

function naturalDiagramSize(svg: SVGSVGElement, fallback: DiagramSize): DiagramSize {
  const viewBox = svg.viewBox.baseVal
  return viewBox.width > 0 && viewBox.height > 0
    ? { width: viewBox.width, height: viewBox.height }
    : fallback
}

function button(label: string, ariaLabel: string, className?: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.title = ariaLabel
  element.setAttribute('aria-label', ariaLabel)
  if (className !== undefined) element.className = className
  return element
}

function zoomToolbar(svg: SVGSVGElement, stage: HTMLElement, base: DiagramSize): InlineZoomControls {
  let zoom = 1
  const toolbar = document.createElement('div')
  toolbar.className = 'dsh-mermaid-toolbar'
  toolbar.setAttribute('role', 'group')
  toolbar.setAttribute('aria-label', 'Mermaid diagram zoom controls')

  const zoomOut = button('−', 'Zoom out')
  const reset = button('', 'Reset zoom', 'dsh-mermaid-zoom-reset')
  const zoomIn = button('+', 'Zoom in')

  const update = (next: number): void => {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    const width = base.width * zoom
    const height = base.height * zoom
    stage.style.width = `${width}px`
    stage.style.height = `${height}px`
    stage.dataset.zoom = String(zoom)
    svg.style.transform = `scale(${zoom})`
    reset.textContent = `${Math.round(zoom * 100)}%`
    zoomOut.disabled = zoom <= MIN_ZOOM
    zoomIn.disabled = zoom >= MAX_ZOOM
  }

  zoomOut.addEventListener('click', () => { update(zoom - ZOOM_STEP) })
  reset.addEventListener('click', () => { update(1) })
  zoomIn.addEventListener('click', () => { update(zoom + ZOOM_STEP) })
  update(1)
  toolbar.append(zoomOut, reset, zoomIn)
  return {
    element: toolbar,
    get: () => zoom,
    set: update,
  }
}

function workspaceManager(
  svg: SVGSVGElement,
  inlineStage: HTMLElement,
  inlineZoom: InlineZoomControls,
  inlineBase: DiagramSize,
  workspaceBase: DiagramSize,
  source: string,
  titleId: string,
): WorkspaceManager {
  let active: { dialog: HTMLDialogElement; finish: () => void } | undefined

  const open = (): void => {
    if (active !== undefined) return
    const savedInlineZoom = inlineZoom.get()
    const dialog = document.createElement('dialog')
    dialog.className = 'dsh-mermaid-workspace'
    dialog.setAttribute('aria-labelledby', titleId)

    const shell = document.createElement('div')
    shell.className = 'dsh-mermaid-workspace-shell'
    const header = document.createElement('header')
    header.className = 'dsh-mermaid-workspace-header'
    const title = document.createElement('h2')
    title.id = titleId
    title.className = 'dsh-mermaid-workspace-title'
    title.textContent = 'Mermaid diagram'
    const hint = document.createElement('span')
    hint.className = 'dsh-mermaid-workspace-hint'
    hint.textContent = 'Drag to pan · Ctrl/⌘ + wheel to zoom · F to fit · 0 to reset'
    const controls = document.createElement('div')
    controls.className = 'dsh-mermaid-workspace-controls'
    controls.setAttribute('role', 'group')
    controls.setAttribute('aria-label', 'Fullscreen diagram controls')
    const fitButton = button('Fit', 'Fit diagram', 'dsh-mermaid-workspace-fit')
    const zoomOut = button('−', 'Zoom out fullscreen diagram')
    const reset = button('', 'Reset fullscreen zoom', 'dsh-mermaid-workspace-zoom')
    const zoomIn = button('+', 'Zoom in fullscreen diagram')
    const closeButton = button('Close', 'Close fullscreen diagram', 'dsh-mermaid-workspace-close')
    controls.append(fitButton, zoomOut, reset, zoomIn, closeButton)
    header.append(title, hint, controls)

    const viewport = document.createElement('div')
    viewport.className = 'dsh-mermaid-workspace-viewport'
    viewport.tabIndex = 0
    viewport.setAttribute('aria-label', 'Interactive Mermaid diagram canvas')
    const workspaceStage = document.createElement('div')
    workspaceStage.className = 'dsh-mermaid-workspace-stage'
    workspaceStage.style.width = `${workspaceBase.width}px`
    workspaceStage.style.height = `${workspaceBase.height}px`
    viewport.append(workspaceStage)

    const details = sourceDetails(source)
    details.className = 'dsh-mermaid-workspace-source'
    shell.append(header, viewport, details)
    dialog.append(shell)

    let zoom = 1
    let panX = 0
    let panY = 0
    let dragging: { pointerId: number; clientX: number; clientY: number; panX: number; panY: number } | undefined

    const applyTransform = (): void => {
      workspaceStage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`
      workspaceStage.dataset.zoom = String(zoom)
      reset.textContent = `${Math.round(zoom * 100)}%`
      zoomOut.disabled = zoom <= WORKSPACE_MIN_ZOOM
      zoomIn.disabled = zoom >= WORKSPACE_MAX_ZOOM
    }

    const setZoom = (next: number, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2): void => {
      const clamped = Math.min(WORKSPACE_MAX_ZOOM, Math.max(WORKSPACE_MIN_ZOOM, next))
      const contentX = (anchorX - panX) / zoom
      const contentY = (anchorY - panY) / zoom
      panX = anchorX - contentX * clamped
      panY = anchorY - contentY * clamped
      zoom = clamped
      applyTransform()
    }

    const centerAt = (next: number): void => {
      zoom = Math.min(WORKSPACE_MAX_ZOOM, Math.max(WORKSPACE_MIN_ZOOM, next))
      panX = (viewport.clientWidth - workspaceBase.width * zoom) / 2
      panY = (viewport.clientHeight - workspaceBase.height * zoom) / 2
      applyTransform()
    }

    const fit = (): void => {
      const availableWidth = Math.max(1, viewport.clientWidth - 64)
      const availableHeight = Math.max(1, viewport.clientHeight - 64)
      centerAt(Math.min(availableWidth / workspaceBase.width, availableHeight / workspaceBase.height, 1))
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      dragging = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX, panY }
      viewport.setPointerCapture(event.pointerId)
      viewport.toggleAttribute('data-dragging', true)
      event.preventDefault()
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (dragging === undefined || event.pointerId !== dragging.pointerId) return
      panX = dragging.panX + event.clientX - dragging.clientX
      panY = dragging.panY + event.clientY - dragging.clientY
      applyTransform()
    }
    const endPointer = (event: PointerEvent): void => {
      if (dragging === undefined || event.pointerId !== dragging.pointerId) return
      dragging = undefined
      viewport.toggleAttribute('data-dragging', false)
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = viewport.getBoundingClientRect()
        const factor = Math.exp(-event.deltaY * 0.002)
        setZoom(zoom * factor, event.clientX - rect.left, event.clientY - rect.top)
        return
      }
      panX -= event.deltaX
      panY -= event.deltaY
      applyTransform()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'f' || event.key === 'F') {
        fit()
        event.preventDefault()
      } else if (event.key === '0') {
        centerAt(1)
        event.preventDefault()
      } else if (event.key === '+' || event.key === '=') {
        setZoom(zoom * WORKSPACE_ZOOM_FACTOR)
        event.preventDefault()
      } else if (event.key === '-') {
        setZoom(zoom / WORKSPACE_ZOOM_FACTOR)
        event.preventDefault()
      }
    }

    fitButton.addEventListener('click', fit)
    zoomOut.addEventListener('click', () => { setZoom(zoom / WORKSPACE_ZOOM_FACTOR) })
    reset.addEventListener('click', () => { centerAt(1) })
    zoomIn.addEventListener('click', () => { setZoom(zoom * WORKSPACE_ZOOM_FACTOR) })
    closeButton.addEventListener('click', () => { dialog.close() })
    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endPointer)
    viewport.addEventListener('pointercancel', endPointer)
    viewport.addEventListener('wheel', onWheel, { passive: false })
    dialog.addEventListener('keydown', onKeyDown)

    inlineStage.removeChild(svg)
    svg.style.transform = 'none'
    svg.style.width = `${workspaceBase.width}px`
    svg.style.height = `${workspaceBase.height}px`
    workspaceStage.append(svg)
    document.body.append(dialog)

    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      active = undefined
      workspaceStage.removeChild(svg)
      inlineStage.append(svg)
      svg.style.width = `${inlineBase.width}px`
      svg.style.height = `${inlineBase.height}px`
      inlineZoom.set(savedInlineZoom)
      dialog.remove()
    }
    active = { dialog, finish }
    dialog.addEventListener('close', finish, { once: true })
    dialog.showModal()
    requestAnimationFrame(() => {
      if (active?.dialog !== dialog || !dialog.open) return
      fit()
      closeButton.focus()
    })
  }

  return {
    open,
    dispose: () => {
      const current = active
      if (current === undefined) return
      if (current.dialog.open) current.dialog.close()
      current.finish()
    },
  }
}

function errorNotice(error: unknown): HTMLElement {
  const notice = document.createElement('div')
  notice.className = 'dsh-mermaid-error'
  notice.textContent = `Mermaid could not render this diagram: ${error instanceof Error ? error.message : String(error)}`
  return notice
}

function elementChildren(block: HTMLElement): HTMLElement[] {
  return Array.from(block.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
}

function setHidden(elements: readonly HTMLElement[], hidden: boolean): void {
  for (const element of elements) element.hidden = hidden
}

function restore(record: RenderRecord): void {
  record.disposeWorkspace()
  record.addition.remove()
  setHidden(record.originalChildren, false)
  record.block.removeAttribute(OWNED_ATTRIBUTE)
}

/** Browser plugin body: enhance settled Mermaid fences and reverse every owned DOM mutation on disposal. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    let disposed = false
    let sequence = 0
    const records = new Map<HTMLElement, RenderRecord>()

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
    })

    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-mermaid-web'
    style.textContent = styles
    document.head.append(style)

    const renderBlock = async (block: HTMLElement): Promise<void> => {
      if (disposed || block.getAttribute(OWNED_ATTRIBUTE) !== null) return
      if (blockLanguage(block) !== 'mermaid') return
      if (block.closest('[data-streaming]') !== null) return
      const source = blockSource(block)
      if (source === undefined || source.trim() === '') return

      block.setAttribute(OWNED_ATTRIBUTE, 'pending')
      const addition = document.createElement('div')
      addition.className = 'dsh-mermaid-render'
      const canvas = document.createElement('div')
      canvas.className = 'dsh-mermaid-canvas'
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', 'Mermaid diagram')
      const originalChildren = elementChildren(block)

      try {
        const result = await mermaid.render(`dsh-mermaid-${Date.now()}-${sequence++}`, source)
        if (disposed || !block.isConnected || block.getAttribute(OWNED_ATTRIBUTE) !== 'pending') return
        // Mermaid generated this SVG under strict security mode; no assistant-authored HTML is inserted directly.
        canvas.innerHTML = result.svg
        result.bindFunctions?.(canvas)
        const svg = canvas.querySelector('svg')
        if (!(svg instanceof SVGSVGElement)) throw new Error('Mermaid returned no SVG root')
        const stage = document.createElement('div')
        stage.className = 'dsh-mermaid-stage'
        canvas.replaceChildren(stage)
        stage.append(svg)
        addition.append(canvas, sourceDetails(source))
        block.append(addition)
        const base = diagramSize(svg)
        const workspaceBase = naturalDiagramSize(svg, base)
        svg.style.width = `${base.width}px`
        svg.style.height = `${base.height}px`
        svg.style.maxWidth = 'none'
        const inlineZoom = zoomToolbar(svg, stage, base)
        const workspace = workspaceManager(svg, stage, inlineZoom, base, workspaceBase, source, `dsh-mermaid-title-${sequence}`)
        const expand = button('Expand', 'Open fullscreen diagram', 'dsh-mermaid-expand')
        expand.addEventListener('click', workspace.open)
        inlineZoom.element.prepend(expand)
        addition.prepend(inlineZoom.element)
        setHidden(originalChildren, true)
        block.setAttribute(OWNED_ATTRIBUTE, 'rendered')
        records.set(block, { block, originalChildren, addition, disposeWorkspace: workspace.dispose })
      } catch (error) {
        if (disposed || !block.isConnected) return
        addition.remove()
        setHidden(originalChildren, false)
        block.append(errorNotice(error))
        block.setAttribute(OWNED_ATTRIBUTE, 'error')
        const notice = block.lastElementChild
        if (notice instanceof HTMLElement) {
          records.set(block, { block, originalChildren: [], addition: notice, disposeWorkspace: () => {} })
        }
      }
    }

    const scan = (root: ParentNode): void => {
      if (root instanceof HTMLElement && root.matches(BLOCK_SELECTOR)) void renderBlock(root)
      for (const block of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) void renderBlock(block)
    }

    const releaseBlock = (block: HTMLElement): void => {
      const record = records.get(block)
      if (record !== undefined) {
        restore(record)
        records.delete(block)
      } else {
        block.removeAttribute(OWNED_ATTRIBUTE)
      }
    }

    const release = (root: ParentNode): void => {
      if (root instanceof HTMLElement && root.matches(BLOCK_SELECTOR)) releaseBlock(root)
      for (const block of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) releaseBlock(block)
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          if (mutation.target instanceof HTMLElement) scan(mutation.target)
          continue
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) release(node)
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) scan(node)
        }
      }
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-streaming'],
    })
    scan(document.body)

    return () => {
      disposed = true
      observer.disconnect()
      for (const record of records.values()) restore(record)
      records.clear()
      style.remove()
    }
  }, 'dsh-mermaid-web: render settled Mermaid fences')
}
