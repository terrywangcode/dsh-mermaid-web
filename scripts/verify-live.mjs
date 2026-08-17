import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const browser = await chromium.launch()
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

try {
  await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('style[data-plugin="dsh-mermaid-web"]', { state: 'attached', timeout: 30_000 })

  await page.evaluate(() => {
    const fixture = document.createElement('section')
    fixture.id = 'dsh-mermaid-live-fixture'
    fixture.style.width = '520px'
    fixture.innerHTML = `
      <div id="valid-mermaid" class="md-code-block">
        <div><div><div>mermaid</div><div></div></div></div>
        <pre><code>flowchart LR\n  Prompt --&gt; Agent --&gt; Tool</code></pre>
      </div>
      <div id="invalid-mermaid" class="md-code-block">
        <div><div><div>mermaid</div><div></div></div></div>
        <pre><code>flowchart LR\n  broken --&gt;</code></pre>
      </div>
      <div id="large-mermaid" class="md-code-block">
        <div><div><div>mermaid</div><div></div></div></div>
        <pre><code>flowchart LR\n  N01[Prompt] --&gt; N02[Planner] --&gt; N03[Router] --&gt; N04[Search] --&gt; N05[Fetch] --&gt; N06[Parse] --&gt; N07[Rank] --&gt; N08[Context] --&gt; N09[Model] --&gt; N10[Tool] --&gt; N11[Observe] --&gt; N12[Reflect] --&gt; N13[Retry] --&gt; N14[Validate] --&gt; N15[Answer]</code></pre>
      </div>
      <div id="streaming-parent" data-streaming="true">
        <div id="streaming-mermaid" class="md-code-block">
          <div><div><div>mermaid</div><div></div></div></div>
          <pre><code>sequenceDiagram\n  User-&gt;&gt;Harness: Prompt\n  Harness--&gt;&gt;User: Reply</code></pre>
        </div>
      </div>`
    document.body.append(fixture)
  })

  await page.waitForTimeout(250)
  const streamingBeforeSettle = await page.locator('#streaming-mermaid').getAttribute('data-dsh-mermaid-state')
  await page.locator('#streaming-parent').evaluate(element => element.removeAttribute('data-streaming'))
  await page.waitForSelector('#valid-mermaid[data-dsh-mermaid-state="rendered"] svg', { timeout: 30_000 })
  await page.waitForSelector('#invalid-mermaid[data-dsh-mermaid-state="error"] .dsh-mermaid-error', { timeout: 30_000 })
  await page.waitForSelector('#large-mermaid[data-dsh-mermaid-state="rendered"] svg', { timeout: 30_000 })
  await page.waitForSelector('#streaming-mermaid[data-dsh-mermaid-state="rendered"] svg', { timeout: 30_000 })

  const zoomIn = page.locator('#valid-mermaid button[aria-label="Zoom in"]')
  const zoomOut = page.locator('#valid-mermaid button[aria-label="Zoom out"]')
  const zoomReset = page.locator('#valid-mermaid button[aria-label="Reset zoom"]')
  const initialGeometry = await page.locator('#valid-mermaid svg').evaluate(svg => ({
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
    transform: svg.style.transform,
    stageWidth: svg.parentElement?.getBoundingClientRect().width,
    stageHeight: svg.parentElement?.getBoundingClientRect().height,
    widthAttribute: svg.getAttribute('width'),
    styleAttribute: svg.getAttribute('style'),
  }))
  await zoomIn.click()
  await zoomIn.click()
  const zoomAfterIncrease = await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  const increasedGeometry = await page.locator('#valid-mermaid svg').evaluate(svg => ({
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
    transform: svg.style.transform,
    stageWidth: svg.parentElement?.getBoundingClientRect().width,
    stageHeight: svg.parentElement?.getBoundingClientRect().height,
    widthAttribute: svg.getAttribute('width'),
    styleAttribute: svg.getAttribute('style'),
  }))
  assert.ok(Math.abs(increasedGeometry.width / initialGeometry.width - 1.5) < 0.02)
  assert.ok(Math.abs(increasedGeometry.height / initialGeometry.height - 1.5) < 0.02)
  assert.ok(Math.abs((increasedGeometry.stageWidth ?? 0) / (initialGeometry.stageWidth ?? 1) - 1.5) < 0.02)
  const zoomLabelAfterIncrease = await zoomReset.textContent()
  await mkdir('artifacts', { recursive: true })
  await page.locator('#valid-mermaid .dsh-mermaid-render').screenshot({ path: 'artifacts/zoom-controls.png' })
  await zoomReset.click()
  const zoomAfterReset = await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  await zoomOut.click()
  const zoomAfterDecrease = await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  await zoomOut.click()
  const minimumZoom = await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  const zoomOutDisabledAtMinimum = await zoomOut.isDisabled()
  await zoomReset.click()
  for (let index = 0; index < 8; index += 1) await zoomIn.click()
  const maximumZoom = await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  const zoomInDisabledAtMaximum = await zoomIn.isDisabled()
  const otherChartZoom = await page.locator('#streaming-mermaid .dsh-mermaid-stage').getAttribute('data-zoom')
  const overflowGeometry = await page.locator('#valid-mermaid .dsh-mermaid-canvas').evaluate(canvas => ({
    clientWidth: canvas.clientWidth,
    scrollWidth: canvas.scrollWidth,
  }))
  assert.ok(overflowGeometry.scrollWidth > overflowGeometry.clientWidth)

  const expand = page.locator('#valid-mermaid button[aria-label="Open fullscreen diagram"]')
  await expand.click()
  const dialog = page.locator('dialog.dsh-mermaid-workspace[open]')
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })
  const dialogGeometry = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight }
  })
  assert.ok(Math.abs(dialogGeometry.width - dialogGeometry.viewportWidth) < 2)
  assert.ok(Math.abs(dialogGeometry.height - dialogGeometry.viewportHeight) < 2)
  assert.equal(await page.locator('#valid-mermaid .dsh-mermaid-stage svg').count(), 0)
  assert.equal(await dialog.locator('.dsh-mermaid-workspace-stage svg').count(), 1)
  assert.equal(await dialog.locator('.dsh-mermaid-workspace-source code').textContent(), 'flowchart LR\n  Prompt --> Agent --> Tool')

  const workspaceStage = dialog.locator('.dsh-mermaid-workspace-stage')
  const workspaceViewport = dialog.locator('.dsh-mermaid-workspace-viewport')
  const workspaceZoomIn = dialog.locator('button[aria-label="Zoom in fullscreen diagram"]')
  const workspaceReset = dialog.locator('button[aria-label="Reset fullscreen zoom"]')
  const workspaceFit = dialog.locator('button[aria-label="Fit diagram"]')
  const workspaceBeforeZoom = await workspaceStage.getAttribute('data-zoom')
  await workspaceZoomIn.click()
  const workspaceAfterButtonZoom = await workspaceStage.getAttribute('data-zoom')
  assert.ok(Number(workspaceAfterButtonZoom) > Number(workspaceBeforeZoom))
  await workspaceReset.click()
  assert.equal(await workspaceStage.getAttribute('data-zoom'), '1')

  const viewportBox = await workspaceViewport.boundingBox()
  assert.ok(viewportBox !== null)
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  const workspaceAfterWheelZoom = await workspaceStage.getAttribute('data-zoom')
  assert.ok(Number(workspaceAfterWheelZoom) > 1)

  const transformBeforeDrag = await workspaceStage.evaluate(element => element.style.transform)
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(viewportBox.x + viewportBox.width / 2 + 80, viewportBox.y + viewportBox.height / 2 + 45, { steps: 4 })
  await page.mouse.up()
  const transformAfterDrag = await workspaceStage.evaluate(element => element.style.transform)
  assert.notEqual(transformAfterDrag, transformBeforeDrag)

  await page.keyboard.press('0')
  assert.equal(await workspaceStage.getAttribute('data-zoom'), '1')
  await page.keyboard.press('f')
  assert.ok(Number(await workspaceStage.getAttribute('data-zoom')) <= 1)
  await workspaceFit.click()
  await page.keyboard.press('Escape')
  await page.locator('#valid-mermaid .dsh-mermaid-stage svg').waitFor({ state: 'attached', timeout: 10_000 })
  assert.equal(await page.locator('#valid-mermaid .dsh-mermaid-stage svg').count(), 1)
  assert.equal(await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom'), '3')
  assert.equal(await page.locator('#valid-mermaid svg').evaluate(svg => svg.style.transform), 'scale(3)')

  await page.locator('#large-mermaid button[aria-label="Open fullscreen diagram"]').click()
  const largeDialog = page.locator('dialog.dsh-mermaid-workspace[open]')
  await largeDialog.waitFor({ state: 'visible', timeout: 10_000 })
  const largeWorkspaceStage = largeDialog.locator('.dsh-mermaid-workspace-stage')
  const largeFitZoom = Number(await largeWorkspaceStage.getAttribute('data-zoom'))
  const largeSvgGeometry = await largeDialog.locator('svg').evaluate(svg => ({
    renderedWidth: svg.getBoundingClientRect().width,
    naturalWidth: svg.viewBox.baseVal.width,
    styledWidth: svg.style.width,
  }))
  assert.ok(largeFitZoom < 1)
  assert.ok(largeSvgGeometry.naturalWidth > dialogGeometry.viewportWidth)
  assert.ok(Math.abs(Number.parseFloat(largeSvgGeometry.styledWidth) - largeSvgGeometry.naturalWidth) < 0.02)
  await page.screenshot({ path: 'artifacts/fullscreen-workspace.png' })
  await largeDialog.locator('button[aria-label="Close fullscreen diagram"]').click()
  await page.locator('#large-mermaid .dsh-mermaid-stage svg').waitFor({ state: 'attached', timeout: 10_000 })

  await page.evaluate(() => {
    const block = document.querySelector('#streaming-mermaid')
    if (!(block instanceof HTMLElement)) throw new Error('streaming Mermaid fixture is missing')
    window.__dshRemovedMermaid = block
    block.remove()
  })
  await page.waitForFunction(() => window.__dshRemovedMermaid?.getAttribute('data-dsh-mermaid-state') === null)
  const removedBlockReset = await page.evaluate(() => ({
    state: window.__dshRemovedMermaid?.getAttribute('data-dsh-mermaid-state'),
    generatedUi: window.__dshRemovedMermaid?.querySelector('.dsh-mermaid-render') !== null,
    originalVisible: window.__dshRemovedMermaid?.querySelector(':scope > pre')?.hidden === false,
  }))
  assert.equal(removedBlockReset.state, null)
  assert.equal(removedBlockReset.generatedUi, false)
  assert.equal(removedBlockReset.originalVisible, true)
  await page.evaluate(() => {
    const parent = document.querySelector('#streaming-parent')
    if (!(parent instanceof HTMLElement) || !(window.__dshRemovedMermaid instanceof HTMLElement)) {
      throw new Error('streaming Mermaid reinsertion fixture is missing')
    }
    parent.append(window.__dshRemovedMermaid)
  })
  await page.waitForSelector('#streaming-mermaid[data-dsh-mermaid-state="rendered"] svg', { timeout: 30_000 })

  const result = await page.evaluate(() => ({
    pluginStyle: document.querySelector('style[data-plugin="dsh-mermaid-web"]') !== null,
    validState: document.querySelector('#valid-mermaid')?.getAttribute('data-dsh-mermaid-state'),
    validSvg: document.querySelector('#valid-mermaid .dsh-mermaid-canvas svg') !== null,
    sourceDisclosure: document.querySelector('#valid-mermaid .dsh-mermaid-source code')?.textContent,
    originalHidden: document.querySelector('#valid-mermaid > pre')?.hidden,
    invalidState: document.querySelector('#invalid-mermaid')?.getAttribute('data-dsh-mermaid-state'),
    invalidSourceVisible: document.querySelector('#invalid-mermaid > pre')?.hidden === false,
    invalidError: document.querySelector('#invalid-mermaid .dsh-mermaid-error')?.textContent,
    streamingAfterSettle: document.querySelector('#streaming-mermaid')?.getAttribute('data-dsh-mermaid-state'),
    zoomToolbarLabel: document.querySelector('#valid-mermaid .dsh-mermaid-toolbar')?.getAttribute('aria-label'),
  }))

  console.log(JSON.stringify({
    ...result,
    streamingBeforeSettle,
    zoomAfterIncrease,
    initialGeometry,
    increasedGeometry,
    zoomLabelAfterIncrease,
    zoomAfterReset,
    zoomAfterDecrease,
    minimumZoom,
    zoomOutDisabledAtMinimum,
    maximumZoom,
    zoomInDisabledAtMaximum,
    otherChartZoom,
    dialogGeometry,
    workspaceBeforeZoom,
    workspaceAfterButtonZoom,
    workspaceAfterWheelZoom,
    transformChangedAfterDrag: transformAfterDrag !== transformBeforeDrag,
    inlineZoomRestoredAfterClose: await page.locator('#valid-mermaid .dsh-mermaid-stage').getAttribute('data-zoom'),
    largeFitZoom,
    largeSvgGeometry,
    removedBlockReset,
    pageErrors,
  }, null, 2))
} finally {
  await browser.close()
}
