/**
 * Pure helpers to convert an Axure RP 9/10 HTML export into a quant-ux model.
 *
 * An Axure page export contains `pages/<page>/data.js` files that call
 *   $axure.loadCurrentPage({...});
 * with a JSON description of the page widgets. These helpers extract and
 * convert that JSON. Zip handling and image uploading live in AxureService.
 */

const FONT = 'Helvetica Neue,Helvetica,Arial,sans-serif'

/**
 * Extracts the JSON passed to $axure.loadCurrentPage() from a data.js file.
 */
export function extractPageData (text) {
  if (typeof text !== 'string') {
    return null
  }
  const marker = '$axure.loadCurrentPage('
  const start = text.indexOf(marker)
  if (start < 0) {
    return null
  }
  let payload = text.substring(start + marker.length)
  const end = payload.lastIndexOf('}')
  if (end < 0) {
    return null
  }
  payload = payload.substring(0, end + 1)
  try {
    return JSON.parse(payload)
  } catch (err) {
    return null
  }
}

/**
 * Returns the widget objects of the base (non adaptive) diagram.
 */
export function getPageObjects (page) {
  if (!page || !Array.isArray(page.diagrams)) {
    return []
  }
  let diagram = page.diagrams.find(d => !d.adaptiveView)
  if (!diagram) {
    diagram = page.diagrams[0]
  }
  if (!diagram || !Array.isArray(diagram.objects)) {
    return []
  }
  return diagram.objects
}

/**
 * Converts Axure rich text (HTML) into plain text.
 */
export function htmlToText (html) {
  let text = String(html == null ? '' : html)
  if (!text) {
    return ''
  }
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
  return text.replace(/\n{2,}/g, '\n').trim()
}

function firstStringValue (value, depth = 0) {
  if (depth > 6 || value == null) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    for (const key of ['richText', 'text', 'html']) {
      if (typeof value[key] === 'string') {
        return value[key]
      }
    }
    for (const key in value) {
      const res = firstStringValue(value[key], depth + 1)
      if (res !== null) {
        return res
      }
    }
  }
  return null
}

/**
 * Best effort extraction of the (plain) text of an Axure object.
 * Different Axure versions store text in `text`, `texts` or `label`.
 */
export function getObjectText (obj) {
  if (!obj) {
    return ''
  }
  const candidates = [obj.text, obj.texts, obj.label]
  for (const candidate of candidates) {
    const raw = firstStringValue(candidate)
    if (raw) {
      return htmlToText(raw)
    }
  }
  return ''
}

function toNumber (value, fallback) {
  if (value == null || value === '') {
    return fallback
  }
  const parsed = parseFloat(value)
  return isNaN(parsed) ? fallback : parsed
}

/**
 * Maps an Axure style object to a quant-ux style fragment.
 */
export function parseStyle (axStyle = {}) {
  const res = {
    fontFamily: FONT,
    fontSize: 14,
    color: '#333333',
    textAlign: 'left',
    letterSpacing: 0,
    lineHeight: 1.4
  }
  if (axStyle.fontName) {
    res.fontFamily = axStyle.fontName
  }
  const fontSize = toNumber(axStyle.fontSize, NaN)
  if (!isNaN(fontSize)) {
    res.fontSize = Math.round(fontSize)
  }
  if (axStyle.foreColor) {
    res.color = axStyle.foreColor
  }
  if (axStyle.backColor && axStyle.backColor !== 'transparent') {
    res.background = axStyle.backColor
  }
  if (axStyle.fontWeight === 'bold' || axStyle.fontWeight === '700') {
    res.fontWeight = 'bold'
  }
  if (axStyle.fontStyle === 'italic') {
    res.fontStyle = 'italic'
  }
  if (axStyle.underline === true || axStyle.underline === 'true') {
    res.textDecoration = 'underline'
  }
  if (axStyle.textAlign) {
    res.textAlign = axStyle.textAlign.toLowerCase()
  }
  if (axStyle.verticalAlign) {
    res.verticalAlign = axStyle.verticalAlign.toLowerCase()
  }
  const borderWidth = toNumber(axStyle.borderWidth, 0)
  if (borderWidth > 0) {
    const borderColor = axStyle.borderColor || '#cccccc'
    for (const side of ['Top', 'Bottom', 'Right', 'Left']) {
      res[`border${side}Width`] = 1
      res[`border${side}Color`] = borderColor
      res[`border${side}Style`] = 'solid'
    }
  }
  const radius = toNumber(axStyle.cornerRadius, 0)
  if (radius > 0) {
    for (const corner of ['TopRight', 'TopLeft', 'BottomRight', 'BottomLeft']) {
      res[`border${corner}Radius`] = Math.round(radius)
    }
  }
  return res
}

function imageBorders (style, borderColor) {
  for (const side of ['Top', 'Bottom', 'Right', 'Left']) {
    style[`border${side}Width`] = style[`border${side}Width`] === undefined ? 0 : style[`border${side}Width`]
    if (!style[`border${side}Color`]) {
      style[`border${side}Color`] = borderColor || 'transparent'
    }
    style[`border${side}Style`] = 'solid'
  }
  return style
}

/**
 * Returns the image url of an Axure object or null.
 */
export function getObjectImageUrl (obj) {
  if (!obj) {
    return null
  }
  if (obj.images) {
    for (const key in obj.images) {
      const img = obj.images[key]
      if (img && typeof img.url === 'string' && img.url) {
        return img.url
      }
    }
  }
  if (typeof obj.imageUrl === 'string' && obj.imageUrl) {
    return obj.imageUrl
  }
  return null
}

function headingSize (type, fallback) {
  switch (type) {
    case 'Axure:Heading1': return 26
    case 'Axure:Heading2': return 22
    case 'Axure:Heading3': return 18
    case 'Axure:Heading4': return 16
  }
  return fallback
}

/**
 * Converts a single Axure object into a quant-ux widget. Returns
 * {widget, imageUrl} - imageUrl is set for image widgets and must be
 * resolved / uploaded by the caller.
 */
export function mapWidget (obj, z) {
  const loc = obj.location || {}
  const size = obj.size || {}
  const style = parseStyle(obj.style)
  const text = getObjectText(obj)
  const x = Math.round(toNumber(loc.x, 0))
  const y = Math.round(toNumber(loc.y, 0))
  const w = Math.max(2, Math.round(toNumber(size.width, 120)))
  const h = Math.max(2, Math.round(toNumber(size.height, 24)))
  const name = obj.name || obj.type || 'Widget'

  const base = {
    x,
    y,
    w,
    h,
    z: z == null ? 0 : z,
    name
  }

  const type = obj.type

  if (type === 'Axure:Image') {
    const widget = {
      ...base,
      type: 'Image',
      props: {},
      has: { backgroundColor: true, border: true, onclick: true },
      style: imageBorders({ ...style, background: style.background || '#f3f4f6' }, null)
    }
    return { widget, imageUrl: getObjectImageUrl(obj) }
  }

  if (type === 'Axure:Button') {
    const bg = style.background || '#f5f5f5'
    return {
      widget: {
        ...base,
        type: 'Button',
        props: { label: text },
        has: { backgroundColor: true, border: true, onclick: true, label: true, padding: true },
        style: {
          ...imageBorders(style, '#cccccc'),
          background: bg,
          textAlign: style.textAlign === 'left' ? 'center' : style.textAlign,
          verticalAlign: style.verticalAlign || 'middle'
        },
        hover: { background: '#e8e8e8' }
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:TextBox' || type === 'Axure:TextArea') {
    return {
      widget: {
        ...base,
        type: type === 'Axure:TextArea' ? 'TextArea' : 'TextBox',
        props: { label: text, placeholder: false },
        has: { label: true, backgroundColor: true, border: true, editable: true, onclick: true, padding: true },
        style: {
          ...imageBorders({ ...style, background: style.background || '#ffffff' }, '#cccccc'),
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: 6,
          paddingRight: 6
        }
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:DropDownList' || type === 'Axure:ListBox') {
    let options = ['Option 1', 'Option 2', 'Option 3']
    if (Array.isArray(obj.options) && obj.options.length) {
      options = obj.options.map(o => (typeof o === 'string' ? o : (o.label || o.text || 'Option'))).slice(0, 20)
    }
    return {
      widget: {
        ...base,
        type: 'DropDown',
        props: { options },
        has: { onclick: true, border: true, backgroundColor: true, data: true, padding: true, label: true },
        style: imageBorders({ ...style, background: style.background || '#ffffff' }, '#cccccc')
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:CheckBox') {
    return {
      widget: {
        ...base,
        type: 'LabeledCheckBox',
        props: { label: text, checked: obj.checked === true, gap: 8 },
        has: { label: true, onclick: true, border: true, data: true },
        style: imageBorders(style, '#cccccc')
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:RadioButton') {
    return {
      widget: {
        ...base,
        type: 'LabeledRadioBox',
        props: { label: text, checked: obj.checked === true, gap: 8 },
        has: { label: true, onclick: true, border: true, data: true },
        style: imageBorders(style, '#cccccc')
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:Label' || type === 'Axure:Paragraph' ||
      (type && type.indexOf('Axure:Heading') === 0)) {
    const heading = headingSize(type, null)
    if (heading) {
      style.fontSize = heading
      style.fontWeight = 'bold'
    }
    delete style.background
    return {
      widget: {
        ...base,
        type: 'Label',
        props: { label: text },
        has: { label: true, padding: true, advancedText: true },
        style
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:Line' || type === 'Axure:Connector' || type === 'Axure:VerticalLine' || type === 'Axure:HorizontalLine') {
    const isHorizontal = w >= h
    const style2 = imageBorders({}, null)
    delete style2.background
    if (isHorizontal) {
      return {
        widget: {
          ...base,
          h: Math.max(h, 2),
          type: 'Box',
          props: { label: '' },
          has: { backgroundColor: true, border: true, label: true },
          style: { ...style2, borderTopWidth: 1, borderTopColor: style.color || '#cccccc' }
        },
        imageUrl: null
      }
    }
    return {
      widget: {
        ...base,
        w: Math.max(w, 2),
        type: 'Box',
        props: { label: '' },
        has: { backgroundColor: true, border: true, label: true },
        style: { ...style2, borderLeftWidth: 1, borderLeftColor: style.color || '#cccccc' }
      },
      imageUrl: null
    }
  }

  if (type === 'Axure:DynamicPanel') {
    return {
      widget: {
        ...base,
        type: 'Box',
        props: { label: '' },
        has: { backgroundColor: true, border: true, label: true },
        style: imageBorders({}, '#e5e7eb')
      },
      imageUrl: null
    }
  }

  /**
   * Default: render as box with the text inside (rectangles, shapes,
   * placeholders, masters, unknown widget types...).
   */
  return {
    widget: {
      ...base,
      type: 'Box',
      props: { label: text },
      has: { backgroundColor: true, border: true, label: true, padding: true },
      style: {
        ...imageBorders(style, '#cccccc'),
        background: style.background || 'transparent',
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6
      }
    },
    imageUrl: null
  }
}

/**
 * Axure emits dynamic panel state children either in page-absolute
 * coordinates or relative to the panel (varies by version/export path).
 * We treat them as relative when their bounding box fits inside the panel
 * rect — a deterministic check that also works for edge-aligned panels
 * (x=0 / y=0) where a "smaller on both axes" comparison would fail.
 */
function isRelativeToPanel (children, panel) {
  if (children.length === 0) {
    return false
  }
  const pw = ((panel.size || {}).width) || Infinity
  const ph = ((panel.size || {}).height) || Infinity
  const tol = 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const child of children) {
    const w = ((child.size || {}).width) || 0
    const h = ((child.size || {}).height) || 0
    minX = Math.min(minX, child.location.x)
    minY = Math.min(minY, child.location.y)
    maxX = Math.max(maxX, child.location.x + w)
    maxY = Math.max(maxY, child.location.y + h)
  }
  if (minX < -tol || minY < -tol) {
    return false
  }
  return maxX <= pw + tol && maxY <= ph + tol
}

/**
 * Flattens dynamic panel state objects into the page objects list.
 * Axure stores panel states in `obj.diagrams[].objects`.
 */
export function flattenObjects (objects) {
  const result = []
  for (const obj of objects) {
    result.push(obj)
    if (obj && obj.type === 'Axure:DynamicPanel' && Array.isArray(obj.diagrams)) {
      const state = obj.diagrams.find(d => !d.adaptiveView) || obj.diagrams[0]
      if (state && Array.isArray(state.objects) && state.objects.length > 0) {
        const children = state.objects.filter(c => c && c.location)
        if (children.length > 0 && isRelativeToPanel(children, obj)) {
          const panelX = (obj.location || {}).x || 0
          const panelY = (obj.location || {}).y || 0
          for (const child of children) {
            child.location = { x: child.location.x + panelX, y: child.location.y + panelY }
          }
        }
        for (const child of state.objects) {
          result.push(child)
        }
      }
    }
  }
  return result
}

/**
 * Builds {screens, widgets, imageRefs} from parsed pages.
 * imageRefs is a list of {widgetId, url} that the caller has to resolve.
 */
export function buildModel (pages) {
  const screens = []
  const widgets = []
  const imageRefs = []
  let screenX = 0
  let maxScreenW = 0

  pages.forEach((page, pageIndex) => {
    const objects = flattenObjects(getPageObjects(page.data))
    const screenWidgets = []
    let maxX = 0
    let maxY = 0
    let z = 1
    for (const obj of objects) {
      if (!obj || !obj.type) {
        continue
      }
      try {
        const { widget, imageUrl } = mapWidget(obj, z++)
        const widgetId = `ax_${pageIndex}_${obj.id || widgets.length}`
        widget.id = widgetId
        widgets.push(widget)
        screenWidgets.push(widgetId)
        if (imageUrl) {
          imageRefs.push({ widgetId, url: imageUrl, pagePath: page.path })
        }
        maxX = Math.max(maxX, widget.x + widget.w)
        maxY = Math.max(maxY, widget.y + widget.h)
      } catch (err) {
        // skip broken widgets, keep importing the rest
      }
    }

    const screenW = Math.min(5000, Math.max(375, maxX + 32))
    const screenH = Math.min(8000, Math.max(480, maxY + 32))
    const screen = {
      id: `ax_s_${pageIndex}`,
      name: page.data.name || (page.path || '').split('/').slice(-2, -1)[0] || `Page ${pageIndex + 1}`,
      type: 'Screen',
      x: screenX,
      y: 0,
      w: screenW,
      h: screenH,
      style: { background: '#ffffff' },
      has: { image: true },
      props: { start: pageIndex === 0 },
      children: screenWidgets
    }
    if (page.data.style && page.data.style.backColor) {
      screen.style.background = page.data.style.backColor
    }
    screens.push(screen)
    maxScreenW = Math.max(maxScreenW, screenW)
    screenX += screenW + 100
  })

  return { screens, widgets, imageRefs }
}
