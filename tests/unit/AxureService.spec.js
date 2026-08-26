import {
  extractPageData,
  getPageObjects,
  htmlToText,
  getObjectText,
  parseStyle,
  mapWidget,
  flattenObjects,
  buildModel
} from 'services/AxureParser'
import { resolveLocale } from 'services/Locale'

const DATA_JS = `
// Axure RP 9/10 page export
$axure.loadCurrentPage({
  "type": "Wireframe",
  "id": "page1",
  "name": "Login",
  "adaptiveView": "",
  "diagrams": [{
    "id": "d1",
    "label": "Page 1",
    "type": "diagram",
    "adaptiveView": "",
    "objects": [{
      "id": "obj1",
      "type": "Axure:TextBox",
      "location": {"x": 100, "y": 50},
      "size": {"width": 200, "height": 32},
      "style": {"fontSize": "13px", "foreColor": "#333333"},
      "text": "user@example.com"
    }, {
      "id": "obj2",
      "type": "Axure:Button",
      "location": {"x": 100, "y": 120},
      "size": {"width": 120, "height": 40},
      "style": {"fontSize": "14px", "fontWeight": "700"},
      "texts": {"rt1": {"richText": "<p><span>Login&nbsp;now</span></p>"}}
    }, {
      "id": "obj3",
      "type": "Axure:Image",
      "location": {"x": 0, "y": 0},
      "size": {"width": 400, "height": 300},
      "images": {"0": {"url": "files/page1/image1.png"}}
    }, {
      "id": "obj4",
      "type": "Axure:Heading1",
      "location": {"x": 100, "y": 400},
      "size": {"width": 300, "height": 40},
      "texts": {"rt1": {"richText": "<p><span>Welcome &amp; enjoy</span></p>"}}
    }]
  }, {
    "id": "d2",
    "label": "Phone",
    "type": "diagram",
    "adaptiveView": "phone",
    "objects": []
  }]
});
`

test('extractPageData - parses the loadCurrentPage payload', () => {
  const page = extractPageData(DATA_JS)
  expect(page).not.toBeNull()
  expect(page.name).toBe('Login')
  expect(page.diagrams.length).toBe(2)
})

test('extractPageData - returns null for non Axure files', () => {
  expect(extractPageData('var x = 1;')).toBeNull()
  expect(extractPageData('')).toBeNull()
  expect(extractPageData(null)).toBeNull()
})

test('getPageObjects - picks the non adaptive diagram', () => {
  const page = extractPageData(DATA_JS)
  const objects = getPageObjects(page)
  expect(objects.length).toBe(4)
})

test('htmlToText - strips html and decodes entities', () => {
  expect(htmlToText('<p><span>Hello&nbsp;&amp;&nbsp;world</span></p>')).toBe('Hello & world')
  expect(htmlToText('a<br/>b</p>')).toBe('a\nb')
  expect(htmlToText(null)).toBe('')
})

test('getObjectText - reads text and rich texts', () => {
  const objects = getPageObjects(extractPageData(DATA_JS))
  expect(getObjectText(objects[0])).toBe('user@example.com')
  expect(getObjectText(objects[1])).toBe('Login now')
  expect(getObjectText(objects[3])).toBe('Welcome & enjoy')
})

test('parseStyle - maps axure css values', () => {
  const style = parseStyle({
    fontName: 'Arial',
    fontSize: '13px',
    foreColor: '#ff0000',
    fontWeight: '700',
    textAlign: 'CENTER',
    borderWidth: '1',
    borderColor: '#00ff00',
    cornerRadius: '4'
  })
  expect(style.fontFamily).toBe('Arial')
  expect(style.fontSize).toBe(13)
  expect(style.color).toBe('#ff0000')
  expect(style.fontWeight).toBe('bold')
  expect(style.textAlign).toBe('center')
  expect(style.borderTopWidth).toBe(1)
  expect(style.borderTopColor).toBe('#00ff00')
  expect(style.borderTopLeftRadius).toBe(4)
})

test('parseStyle - defaults are sane', () => {
  const style = parseStyle({})
  expect(style.fontSize).toBe(14)
  expect(style.fontFamily).toContain('Helvetica')
  expect(style.borderTopWidth).toBeUndefined()
})

test('mapWidget - text box', () => {
  const objects = getPageObjects(extractPageData(DATA_JS))
  const { widget, imageUrl } = mapWidget(objects[0], 1)
  expect(widget.type).toBe('TextBox')
  expect(widget.x).toBe(100)
  expect(widget.y).toBe(50)
  expect(widget.w).toBe(200)
  expect(widget.h).toBe(32)
  expect(widget.z).toBe(1)
  expect(widget.props.label).toBe('user@example.com')
  expect(widget.has.editable).toBe(true)
  expect(imageUrl).toBeNull()
})

test('mapWidget - button gets centered text', () => {
  const objects = getPageObjects(extractPageData(DATA_JS))
  const { widget } = mapWidget(objects[1], 2)
  expect(widget.type).toBe('Button')
  expect(widget.props.label).toBe('Login now')
  expect(widget.style.textAlign).toBe('center')
  expect(widget.style.fontWeight).toBe('bold')
})

test('mapWidget - image returns the url to resolve', () => {
  const objects = getPageObjects(extractPageData(DATA_JS))
  const { widget, imageUrl } = mapWidget(objects[2], 3)
  expect(widget.type).toBe('Image')
  expect(imageUrl).toBe('files/page1/image1.png')
})

test('mapWidget - headings become bold labels', () => {
  const objects = getPageObjects(extractPageData(DATA_JS))
  const { widget } = mapWidget(objects[3], 4)
  expect(widget.type).toBe('Label')
  expect(widget.style.fontSize).toBe(26)
  expect(widget.style.fontWeight).toBe('bold')
})

test('mapWidget - unknown types become boxes', () => {
  const { widget } = mapWidget({
    id: 'x',
    type: 'Axure:SomethingNew',
    location: { x: 0, y: 0 },
    size: { width: 50, height: 50 },
    text: 'hi'
  }, 1)
  expect(widget.type).toBe('Box')
  expect(widget.props.label).toBe('hi')
})

test('flattenObjects - expands dynamic panel state objects', () => {
  const objects = flattenObjects([{
    id: 'panel',
    type: 'Axure:DynamicPanel',
    location: { x: 400, y: 300 },
    size: { width: 200, height: 200 },
    diagrams: [{
      id: 'state1',
      objects: [{
        id: 'child',
        type: 'Axure:Rectangle',
        location: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
      }]
    }]
  }])
  expect(objects.length).toBe(2)
  // relative coordinates are offset by the panel position
  expect(objects[1].location.x).toBe(410)
  expect(objects[1].location.y).toBe(320)
})

test('flattenObjects - offsets relative children of edge-aligned panel (x=0)', () => {
  const objects = flattenObjects([{
    id: 'panel',
    type: 'Axure:DynamicPanel',
    location: { x: 0, y: 100 },
    size: { width: 375, height: 200 },
    diagrams: [{
      id: 'state1',
      objects: [{
        id: 'child',
        type: 'Axure:Rectangle',
        location: { x: 10, y: 20 },
        size: { width: 100, height: 40 }
      }]
    }]
  }])
  expect(objects[1].location.x).toBe(10)
  expect(objects[1].location.y).toBe(120)
})

test('flattenObjects - keeps page-absolute state children untouched', () => {
  const objects = flattenObjects([{
    id: 'panel',
    type: 'Axure:DynamicPanel',
    location: { x: 400, y: 300 },
    size: { width: 200, height: 150 },
    diagrams: [{
      id: 'state1',
      objects: [{
        id: 'child',
        type: 'Axure:Rectangle',
        location: { x: 500, y: 400 },
        size: { width: 100, height: 40 }
      }]
    }]
  }])
  expect(objects[1].location.x).toBe(500)
  expect(objects[1].location.y).toBe(400)
})

test('flattenObjects - treats non-negative children as relative when panel has no size', () => {
  const objects = flattenObjects([{
    id: 'panel',
    type: 'Axure:DynamicPanel',
    location: { x: 30, y: 40 },
    diagrams: [{
      id: 'state1',
      objects: [{
        id: 'child',
        type: 'Axure:Rectangle',
        location: { x: 10, y: 20 },
        size: { width: 100, height: 40 }
      }]
    }]
  }])
  expect(objects[1].location.x).toBe(40)
  expect(objects[1].location.y).toBe(60)
})

test('buildModel - wires screens, widgets and image refs', () => {
  const page = extractPageData(DATA_JS)
  const model = buildModel([{ path: 'pages/login/data.js', data: page }])

  expect(model.screens.length).toBe(1)
  const screen = model.screens[0]
  expect(screen.name).toBe('Login')
  expect(screen.props.start).toBe(true)
  expect(screen.children.length).toBe(4)
  // screen size is derived from the widget bounding box
  expect(screen.w).toBeGreaterThanOrEqual(432)
  expect(screen.h).toBeGreaterThanOrEqual(472)
  expect(screen.style.background).toBe('#ffffff')

  expect(model.widgets.length).toBe(4)
  model.widgets.forEach(w => {
    expect(screen.children).toContain(w.id)
  })
  // text box x position preserved
  const textBox = model.widgets.find(w => w.type === 'TextBox')
  expect(textBox.x).toBe(100)

  expect(model.imageRefs.length).toBe(1)
  expect(model.imageRefs[0].url).toBe('files/page1/image1.png')
  expect(model.imageRefs[0].pagePath).toBe('pages/login/data.js')
})

test('buildModel - multiple pages are placed next to each other', () => {
  const pageA = extractPageData(DATA_JS)
  const pageB = JSON.parse(JSON.stringify(pageA))
  pageB.name = 'Home'
  const model = buildModel([
    { path: 'pages/login/data.js', data: pageA },
    { path: 'pages/home/data.js', data: pageB }
  ])
  expect(model.screens.length).toBe(2)
  expect(model.screens[0].props.start).toBe(true)
  expect(model.screens[1].props.start).toBe(false)
  expect(model.screens[1].x).toBeGreaterThanOrEqual(model.screens[0].x + model.screens[0].w)
})

test('resolveLocale - maps to registered locales with cn default', () => {
  expect(resolveLocale('zh-CN')).toBe('cn')
  expect(resolveLocale('zh')).toBe('cn')
  expect(resolveLocale('en-US')).toBe('en')
  expect(resolveLocale('de-DE')).toBe('de')
  expect(resolveLocale('pt-BR')).toBe('pt-br')
  expect(resolveLocale('fr')).toBe('cn')
  expect(resolveLocale(null)).toBe('cn')
  expect(resolveLocale('cn')).toBe('cn')
})
