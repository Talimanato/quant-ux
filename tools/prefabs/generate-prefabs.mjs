/**
 * Generates the extended prefab ("Templates") theme JSON files under src/themes/.
 *
 * Run with:  node tools/prefabs/generate-prefabs.mjs
 *
 * The generated files are committed to the repo. Re-run this script whenever
 * the definitions below change. Widget models follow the same conventions as
 * the hand written files in src/themes/composite (see login.json).
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEMES = join(__dirname, '../../src/themes')

const FONT = 'Helvetica Neue,Helvetica,Arial,sans-serif'

const C = {
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primarySoft: '#eff6ff',
  primaryBorder: '#bfdbfe',
  dark: '#111827',
  gray: '#6b7280',
  grayLight: '#9ca3af',
  light: '#f3f4f6',
  lighter: '#f9fafb',
  border: '#e5e7eb',
  white: '#ffffff',
  success: '#10b981',
  successSoft: '#ecfdf5',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  danger: '#ef4444',
  dangerSoft: '#fef2f2',
  sidebar: '#1f2937',
  sidebarHover: '#374151',
  sidebarText: '#9ca3af'
}

/* ------------------------------------------------------------------ */
/* Widget helpers                                                      */
/* ------------------------------------------------------------------ */

let prefix = 'X'
let counter = 0
const nid = () => `${prefix}${counter++}`
function setPrefix (p) {
  prefix = p
  counter = 0
}

function clean (o) {
  return JSON.parse(JSON.stringify(o))
}

function baseText (over = {}) {
  return clean({
    fontSize: 14,
    fontFamily: FONT,
    textAlign: 'left',
    letterSpacing: 0,
    lineHeight: 1.4,
    color: C.dark,
    ...over
  })
}

function fullBorder (color = C.border, width = 1, radius = 0) {
  const res = {}
  for (const s of ['Top', 'Bottom', 'Right', 'Left']) {
    res[`border${s}Width`] = width
    res[`border${s}Color`] = color
    res[`border${s}Style`] = 'solid'
  }
  for (const s of ['TopRight', 'TopLeft', 'BottomRight', 'BottomLeft']) {
    res[`border${s}Radius`] = radius
  }
  return res
}

function inputStates (style, opt = {}) {
  const border = opt.border || C.border
  return {
    focus: { ...style, background: opt.focusBg || C.white, ...fullBorder(opt.focusBorder || C.primary, 1, style.borderTopRightRadius || 6) },
    hover: { ...style, background: opt.hoverBg || C.light, ...fullBorder(opt.hoverBorder || border, 1, style.borderTopRightRadius || 6) },
    error: { ...style, background: C.dangerSoft, color: C.danger, ...fullBorder(C.danger, 1, style.borderTopRightRadius || 6) }
  }
}

function wlabel (name, x, y, w, h, text, opt = {}) {
  return clean({
    id: nid(), type: 'Label', _type: 'Widget', name, x, y, w, h, z: null,
    props: { label: text },
    has: { label: true, padding: true, advancedText: true },
    style: baseText({
      fontSize: opt.size || 14,
      color: opt.color || C.dark,
      fontWeight: opt.bold ? 'bold' : undefined,
      textAlign: opt.align || 'left',
      background: opt.bg,
      lineHeight: opt.lineHeight
    })
  })
}

function wbox (name, x, y, w, h, opt = {}) {
  return clean({
    id: nid(), type: 'Box', _type: 'Widget', name, x, y, w, h, z: null,
    props: { label: '' },
    has: { backgroundColor: true, border: true, label: true, padding: true },
    style: clean({
      ...baseText({ color: opt.color }),
      ...fullBorder(opt.borderColor === undefined ? C.border : opt.borderColor, opt.borderWidth === undefined ? 1 : opt.borderWidth, opt.radius || 0),
      background: opt.bg,
      paddingTop: opt.padding, paddingBottom: opt.padding, paddingLeft: opt.padding, paddingRight: opt.padding
    })
  })
}

function wbutton (name, x, y, w, h, text, opt = {}) {
  const bg = opt.bg || C.primary
  const fg = opt.color || C.white
  const border = opt.borderColor === undefined ? bg : opt.borderColor
  const radius = opt.radius === undefined ? 6 : opt.radius
  const style = clean({
    ...baseText({
      textAlign: opt.align || 'center', verticalAlign: 'middle', lineHeight: 1.5,
      fontSize: opt.size || 14, color: fg,
      fontWeight: opt.bold ? 'bold' : undefined
    }),
    ...fullBorder(border, opt.borderWidth === undefined ? 1 : opt.borderWidth, radius),
    background: bg,
    paddingTop: 0, paddingBottom: 0,
    paddingLeft: opt.paddingLeft, paddingRight: opt.paddingRight
  })
  return clean({
    id: nid(), type: 'Button', _type: 'Widget', name, x, y, w, h, z: null,
    props: { label: text },
    has: { backgroundColor: true, border: true, onclick: true, label: true, padding: true },
    style,
    hover: opt.noHover ? undefined : clean({
      background: opt.hoverBg || C.primaryHover,
      color: fg,
      ...fullBorder(opt.hoverBorder || border, 1, radius)
    })
  })
}

function wtext (name, x, y, w, h, placeholder, opt = {}) {
  const radius = opt.radius === undefined ? 6 : opt.radius
  const style = clean({
    ...baseText({ fontSize: opt.size || 14, textAlign: opt.align }),
    ...fullBorder(opt.border || C.border, 1, radius),
    background: opt.bg || C.white,
    paddingTop: 0, paddingBottom: 0, paddingLeft: 12, paddingRight: 12
  })
  return clean({
    id: nid(), type: opt.type || 'TextBox', _type: 'Widget', name, x, y, w, h, z: null,
    props: clean({ label: placeholder, placeholder: true, cleartext: opt.cleartext, cleartextHideLabel: opt.cleartext ? 'Hide' : undefined, cleartextShowLabel: opt.cleartext ? 'Show' : undefined }),
    has: { label: true, backgroundColor: true, border: true, editable: true, onclick: true, padding: true },
    style,
    ...inputStates(style, opt)
  })
}

function wdropdown (name, x, y, w, h, options, opt = {}) {
  return clean({
    id: nid(), type: 'DropDown', _type: 'Widget', name, x, y, w, h, z: null,
    props: { options },
    has: { onclick: true, border: true, backgroundColor: true, data: true, padding: true, label: true },
    style: clean({
      ...baseText({ fontSize: opt.size || 14 }),
      ...fullBorder(opt.border || C.border, 1, opt.radius === undefined ? 6 : opt.radius),
      background: opt.bg || C.white
    }),
    hover: { background: opt.hoverBg || C.light, ...fullBorder(opt.hoverBorder || C.border, 1, 6) }
  })
}

function wcheck (name, x, y, w, h, text, checked, opt = {}) {
  return clean({
    id: nid(), type: 'LabeledCheckBox', _type: 'Widget', name, x, y, w, h, z: null,
    props: { checked: !!checked, label: text, gap: 8 },
    has: { label: true, onclick: true, border: true, data: true },
    style: clean({
      ...baseText({ fontSize: opt.size || 14, color: opt.color }),
      ...fullBorder(opt.borderColor || C.border, 1, 4),
      background: opt.bg || C.white,
      color: C.primary
    })
  })
}

function wradio (name, x, y, w, h, text, checked, opt = {}) {
  return clean({
    id: nid(), type: 'LabeledRadioBox', _type: 'Widget', name, x, y, w, h, z: null,
    props: { checked: !!checked, label: text, gap: 8 },
    has: { label: true, onclick: true, border: true, data: true },
    style: clean({
      ...baseText({ fontSize: opt.size || 14, color: opt.color }),
      ...fullBorder(opt.borderColor || C.border, 1, 8),
      background: opt.bg || C.white
    })
  })
}

function wswitch (name, x, y, w, h, checked, opt = {}) {
  return clean({
    id: nid(), type: 'Switch', _type: 'Widget', name, x, y, w, h, z: null,
    props: { checked: !!checked },
    has: { onclick: true, border: true, data: true },
    style: clean({ activeColor: opt.activeColor || C.primary, passiveColor: opt.passiveColor || C.grayLight })
  })
}

function wicon (name, x, y, size, cls, opt = {}) {
  return clean({
    id: nid(), type: 'Icon', _type: 'Widget', name, x, y, w: size, h: size, z: null,
    props: {},
    has: { onclick: true, data: true },
    style: clean({ icon: `mdi ${cls}`, color: opt.color || C.gray, iconSizeFactor: opt.factor || 1 })
  })
}

function wtable (name, x, y, w, h, columns, data, opt = {}) {
  return clean({
    id: nid(), type: 'Table', _type: 'Widget', name, x, y, w, h, z: null,
    props: {
      columns: columns.map(c => ({ label: c, width: Math.round(w / columns.length), isEditable: false, isSortable: true, isSearchable: false })),
      data
    },
    has: { onclick: true, label: true },
    style: clean({
      ...baseText({ fontSize: opt.size || 13 }),
      ...fullBorder(C.border, 1, opt.radius || 0),
      background: C.white
    })
  })
}

function wbar (name, x, y, w, h, data, opt = {}) {
  return clean({
    id: nid(), type: 'BarChart', _type: 'Widget', name, x, y, w, h, z: null,
    props: clean({ data, isHorizontal: opt.horizontal, isLine: opt.line }),
    has: { onclick: true, border: true },
    style: {
      borderTopWidth: 0, borderBottomWidth: 1, borderRightWidth: 0, borderLeftWidth: 1,
      borderTopColor: C.border, borderBottomColor: C.border, borderRightColor: C.border, borderLeftColor: C.border,
      background0: opt.c0 || C.primary,
      background1: opt.c1 || '#93c5fd',
      background2: '#d1d5db',
      background3: '#f9fafb'
    }
  })
}

function wpie (name, x, y, w, h, data) {
  return clean({
    id: nid(), type: 'PieChart', _type: 'Widget', name, x, y, w, h, z: null,
    props: { data: [data] },
    has: {},
    style: { background0: C.primary, background1: C.success, background2: C.warning, background3: C.grayLight }
  })
}

function wring (name, x, y, w, h, value) {
  return clean({
    id: nid(), type: 'RingChart', _type: 'Widget', name, x, y, w, h, z: null,
    props: { value },
    has: {},
    style: { background: C.border, color: C.primary, lineWidth: 24 }
  })
}

function wprogress (name, x, y, w, h, value, opt = {}) {
  return clean({
    id: nid(), type: 'ProgressBar', _type: 'Widget', name, x, y, w, h, z: null,
    props: { value },
    has: { onclick: true, border: true },
    style: clean({ background: opt.bg || C.light, foreground: opt.color || C.primary, ...fullBorder('transparent', 0, 4) })
  })
}

function wsegment (name, x, y, w, h, options, selected, opt = {}) {
  return clean({
    id: nid(), type: 'SegmentButton', _type: 'Widget', name, x, y, w, h, z: null,
    props: { options, selected: [selected] },
    has: { onclick: true, backgroundColor: true, border: true, label: true },
    style: clean({
      ...baseText({ fontSize: 13 }),
      ...fullBorder(opt.border || C.border, 1, 6),
      background: opt.bg || C.light
    })
  })
}

function wrating (name, x, y, w, h, selected) {
  return clean({
    id: nid(), type: 'Rating', _type: 'Widget', name, x, y, w, h, z: null,
    props: { elementCount: 5, selected },
    has: { onclick: true },
    style: { color: C.warning, background: C.light }
  })
}

/* ------------------------------------------------------------------ */
/* Composition helpers                                                 */
/* ------------------------------------------------------------------ */

function group (id, name, children, opt = {}) {
  let w = 0
  let h = 0
  children.forEach(c => {
    w = Math.max(w, c.x + c.w)
    h = Math.max(h, c.y + c.h)
  })
  return clean({
    id, type: 'Group', _type: 'Group', name,
    category: opt.category || 'Composite',
    subcategory: opt.subcategory || 'Z',
    w, h, children
  })
}

/** Avatar: circular icon box */
function avatar (x, y, size, opt = {}) {
  return wbox('Avatar', x, y, size, size, {
    bg: opt.bg || C.primarySoft, radius: Math.round(size / 2), borderColor: opt.bg || C.primarySoft
  })
}

/** Gray image placeholder with mdi-image icon */
function imagePlaceholder (name, x, y, w, h, opt = {}) {
  const res = [wbox(name, x, y, w, h, { bg: opt.bg || C.light, radius: opt.radius === undefined ? 8 : opt.radius, borderColor: C.border })]
  if (!opt.noIcon) {
    const s = Math.min(w, h) * 0.25
    res.push(wicon('Image Icon', Math.round(x + w / 2 - s / 2), Math.round(y + h / 2 - s / 2), Math.round(s), opt.icon || 'mdi-image', { color: C.grayLight }))
  }
  return res
}

/** small rounded chip label */
function chip (name, x, y, text, opt = {}) {
  const w = opt.w || (text.length * 7 + 20)
  const h = opt.h || 22
  return [
    wbox(name, x, y, w, h, { bg: opt.bg || C.primarySoft, radius: 999, borderColor: opt.bg || C.primarySoft }),
    wlabel(`${name} Label`, x, y + (h - 16) / 2, w, 16, text, { size: 11, color: opt.color || C.primary, align: 'center', bold: true })
  ]
}

/** colored dot */
function dot (x, y, color, d = 8) {
  return wbox('Dot', x, y, d, d, { bg: color, radius: Math.round(d / 2), borderColor: color })
}

/** primary colored square logo mark with letter */
function logoMark (x, y, size, letter) {
  return [
    wbox('Logo', x, y, size, size, { bg: C.primary, radius: Math.round(size / 4), borderColor: C.primary }),
    wlabel('Logo Letter', x, y + size / 2 - 11, size, 22, letter, { size: 16, bold: true, color: C.white, align: 'center' })
  ]
}

function vdivider (x, y, h) {
  return wbox('Divider', x, y, 1, h, { bg: C.border, borderColor: C.border })
}

function hdivider (x, y, w) {
  return wbox('Divider', x, y, w, 1, { bg: C.border, borderColor: C.border })
}

/* ------------------------------------------------------------------ */
/* 1) Navigation                                                       */
/* ------------------------------------------------------------------ */

function navFile () {
  setPrefix('QXNav')
  const out = []

  // TopBar Simple
  {
    const c = [
      ...logoMark(0, 14, 36, 'Q'),
      wlabel('Brand', 46, 18, 120, 24, 'Quant-UX', { size: 18, bold: true }),
      wlabel('Nav 1', 300, 22, 56, 20, 'Home', { size: 14, bold: true, color: C.primary }),
      wlabel('Nav 2', 364, 22, 64, 20, 'Features'),
      wlabel('Nav 3', 436, 22, 64, 20, 'Pricing'),
      wlabel('Nav 4', 508, 22, 56, 20, 'About'),
      wlabel('Login Link', 872, 22, 48, 20, 'Sign in', { color: C.primary }),
      wbutton('Signup', 928, 14, 112, 36, 'Sign Up', { radius: 999 })
    ]
    out.push(group('QXNavTopBar', 'Top Bar', c, { subcategory: 'ANav' }))
  }

  // TopBar with icons
  {
    const c = [
      wicon('Menu', 16, 20, 24, 'mdi-menu', { color: C.dark }),
      wlabel('Brand', 56, 22, 140, 22, 'Dashboard', { size: 17, bold: true }),
      wlabel('Nav Active', 300, 26, 56, 20, 'Home', { size: 14, bold: true, color: C.primary }),
      wbox('Active Indicator', 300, 46, 56, 2, { bg: C.primary, borderColor: C.primary }),
      wlabel('Nav 2', 364, 26, 72, 20, 'Analytics'),
      wlabel('Nav 3', 446, 26, 72, 20, 'Customers'),
      wlabel('Nav 4', 528, 26, 56, 20, 'Reports'),
      vdivider(940, 18, 28),
      wicon('Search', 960, 20, 22, 'mdi-magnify'),
      wicon('Bell', 996, 20, 22, 'mdi-bell'),
      avatar(1036, 16, 28),
      wbox('Badge', 1052, 16, 8, 8, { bg: C.danger, radius: 4, borderColor: C.danger })
    ]
    out.push(group('QXNavTopBarIcons', 'Top Bar with Icons', c, { subcategory: 'ANav' }))
  }

  // TopBar with search
  {
    const c = [
      wicon('Menu', 16, 24, 24, 'mdi-menu', { color: C.dark }),
      wlabel('Brand', 56, 26, 120, 22, 'Workspace', { size: 17, bold: true }),
      wbox('SearchBar', 240, 18, 420, 36, { bg: C.lighter, radius: 999, borderColor: C.border }),
      wicon('Search', 260, 27, 18, 'mdi-magnify'),
      wlabel('Search Placeholder', 288, 28, 300, 16, 'Search anything...', { size: 13, color: C.grayLight }),
      wicon('Help', 708, 24, 22, 'mdi-help-circle'),
      wicon('Apps', 744, 24, 22, 'mdi-apps'),
      wbutton('Invite', 880, 18, 96, 36, '+ Invite', { radius: 999 }),
      avatar(1000, 18, 32)
    ]
    out.push(group('QXNavTopBarSearch', 'Top Bar with Search', c, { subcategory: 'ANav' }))
  }

  // Sidebar Light
  {
    const c = [
      ...logoMark(20, 24, 32, 'Q'),
      wlabel('Brand', 64, 28, 120, 20, 'Quant-UX', { size: 16, bold: true }),
      wlabel('Section', 20, 88, 120, 14, 'MENU', { size: 11, color: C.grayLight, bold: true }),
      wicon('I1', 20, 116, 20, 'mdi-view-dashboard', { color: C.primary }),
      wbox('Item Active', 8, 110, 224, 36, { bg: C.primarySoft, radius: 8, borderColor: C.primarySoft }),
      wbox('Indicator', 8, 110, 3, 36, { bg: C.primary, borderColor: C.primary, radius: 2 }),
      wicon('I1b', 20, 118, 20, 'mdi-view-dashboard', { color: C.primary }),
      wlabel('L1', 52, 121, 100, 18, 'Dashboard', { size: 14, bold: true, color: C.primary }),
      wicon('I2', 20, 162, 20, 'mdi-chart-bar'),
      wlabel('L2', 52, 165, 100, 18, 'Analytics'),
      wicon('I3', 20, 206, 20, 'mdi-account-group'),
      wlabel('L3', 52, 209, 100, 18, 'Team'),
      wicon('I4', 20, 250, 20, 'mdi-file-document-outline'),
      wlabel('L4', 52, 253, 100, 18, 'Documents'),
      hdivider(20, 296, 200),
      wlabel('Section 2', 20, 316, 120, 14, 'PROJECTS', { size: 11, color: C.grayLight, bold: true }),
      wicon('I5', 20, 344, 20, 'mdi-folder'),
      wlabel('L5', 52, 347, 100, 18, 'Marketing'),
      wicon('I6', 20, 388, 20, 'mdi-folder'),
      wlabel('L6', 52, 391, 100, 18, 'Development'),
      wicon('I7', 20, 432, 20, 'mdi-cog'),
      wlabel('L7', 52, 435, 100, 18, 'Settings'),
      wbox('UserBox', 12, 560, 216, 56, { bg: C.lighter, radius: 10, borderColor: C.border }),
      avatar(24, 572, 32),
      wlabel('User', 66, 572, 120, 16, 'Klaus Huber', { size: 13, bold: true }),
      wlabel('User Mail', 66, 590, 140, 14, 'klaus@quant-ux.com', { size: 11, color: C.grayLight }),
      wicon('Logout', 204, 578, 18, 'mdi-logout')
    ]
    out.push(group('QXNavSidebar', 'Sidebar', c, { subcategory: 'ANav' }))
  }

  // Sidebar Dark
  {
    const c = [
      ...logoMark(20, 24, 32, 'Q'),
      wlabel('Brand', 64, 28, 120, 20, 'Quant-UX', { size: 16, bold: true, color: C.white }),
      wbox('Item Active', 8, 84, 224, 36, { bg: C.sidebarHover, radius: 8, borderColor: C.sidebarHover }),
      wbox('Indicator', 8, 84, 3, 36, { bg: C.primary, borderColor: C.primary, radius: 2 }),
      wicon('I1', 20, 92, 20, 'mdi-view-dashboard', { color: C.white }),
      wlabel('L1', 52, 95, 100, 18, 'Dashboard', { size: 14, bold: true, color: C.white }),
      wicon('I2', 20, 136, 20, 'mdi-chart-bar', { color: C.sidebarText }),
      wlabel('L2', 52, 139, 100, 18, 'Analytics', { color: C.sidebarText }),
      wicon('I3', 20, 180, 20, 'mdi-account-group', { color: C.sidebarText }),
      wlabel('L3', 52, 183, 100, 18, 'Team', { color: C.sidebarText }),
      wicon('I4', 20, 224, 20, 'mdi-file-document-outline', { color: C.sidebarText }),
      wlabel('L4', 52, 227, 100, 18, 'Documents', { color: C.sidebarText }),
      wicon('I5', 20, 268, 20, 'mdi-calendar', { color: C.sidebarText }),
      wlabel('L5', 52, 271, 100, 18, 'Calendar', { color: C.sidebarText }),
      wicon('I6', 20, 312, 20, 'mdi-cog', { color: C.sidebarText }),
      wlabel('L6', 52, 315, 100, 18, 'Settings', { color: C.sidebarText }),
      wbox('Upgrade Card', 16, 400, 208, 120, { bg: C.sidebarHover, radius: 12, borderColor: C.sidebarHover }),
      wlabel('Upgrade Title', 32, 416, 176, 18, 'Upgrade to Pro', { size: 14, bold: true, color: C.white }),
      wlabel('Upgrade Text', 32, 438, 176, 32, 'Unlock analytics and unlimited projects', { size: 12, color: C.sidebarText, lineHeight: 1.3 }),
      wbutton('Upgrade Btn', 32, 478, 96, 30, 'Upgrade', { radius: 6 }),
      avatar(20, 568, 32),
      wlabel('User', 62, 568, 120, 16, 'Klaus Huber', { size: 13, bold: true, color: C.white }),
      wlabel('Plan', 62, 586, 140, 14, 'Free plan', { size: 11, color: C.sidebarText }),
      wicon('Logout', 204, 574, 18, 'mdi-logout', { color: C.sidebarText })
    ]
    const sidebar = wbox('SidebarBg', 0, 0, 240, 640, { bg: C.sidebar, borderColor: C.sidebar, radius: 0 })
    out.push(group('QXNavSidebarDark', 'Sidebar Dark', [sidebar, ...c], { subcategory: 'ANav' }))
  }

  // Sidebar Mini
  {
    const c = [
      ...logoMark(16, 20, 32, 'Q'),
      wbox('Item Active', 8, 76, 48, 40, { bg: C.primarySoft, radius: 10, borderColor: C.primarySoft }),
      wicon('I1', 22, 86, 20, 'mdi-view-dashboard', { color: C.primary }),
      wicon('I2', 22, 132, 20, 'mdi-chart-bar'),
      wicon('I3', 22, 176, 20, 'mdi-account-group'),
      wicon('I4', 22, 220, 20, 'mdi-calendar'),
      wicon('I5', 22, 264, 20, 'mdi-email'),
      wicon('I6', 22, 308, 20, 'mdi-file-document-outline'),
      hdivider(16, 356, 32),
      wicon('I7', 22, 380, 20, 'mdi-cog'),
      avatar(16, 568, 32)
    ]
    out.push(group('QXNavSidebarMini', 'Sidebar Mini', c, { subcategory: 'ANav' }))
  }

  // Breadcrumb bar
  {
    const c = [
      wlabel('B1', 0, 10, 48, 18, 'Home', { size: 13, color: C.primary }),
      wicon('Chev1', 52, 11, 14, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B2', 72, 10, 72, 18, 'Projects', { size: 13, color: C.primary }),
      wicon('Chev2', 148, 11, 14, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B3', 168, 10, 80, 18, 'Website Redesign', { size: 13, bold: true }),
      wicon('Refresh', 920, 8, 20, 'mdi-refresh'),
      wbutton('Share', 952, 0, 88, 36, 'Share', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light })
    ]
    out.push(group('QXNavBreadcrumb', 'Breadcrumb Bar', c, { subcategory: 'ANav' }))
  }

  // Tab bar underline
  {
    const c = [
      wlabel('T1', 0, 12, 64, 20, 'Overview', { size: 14, bold: true, color: C.primary }),
      wbox('Tab Indicator', 0, 44, 64, 2, { bg: C.primary, borderColor: C.primary }),
      wlabel('T2', 80, 12, 80, 20, 'Statistics', { color: C.gray }),
      wlabel('T3', 176, 12, 72, 20, 'Activity', { color: C.gray }),
      wlabel('T4', 260, 12, 56, 20, 'Files', { color: C.gray }),
      wlabel('T5', 328, 12, 64, 20, 'Settings', { color: C.gray }),
      wbutton('Add', 936, 0, 104, 36, '+ New Task', { radius: 6 })
    ]
    out.push(group('QXNavTabs', 'Tab Bar', c, { subcategory: 'ANav' }))
  }

  // Footer
  {
    const mkLinks = (x, title, links) => {
      const res = [wlabel(title, x, 0, 120, 18, title, { size: 13, bold: true })]
      links.forEach((l, i) => {
        res.push(wlabel(`Link ${x} ${i}`, x, 32 + i * 28, 120, 18, l, { size: 13, color: C.gray }))
      })
      return res
    }
    const c = [
      ...logoMark(0, 0, 32, 'Q'),
      wlabel('Brand', 44, 4, 160, 20, 'Quant-UX', { size: 16, bold: true }),
      wlabel('Tagline', 0, 44, 220, 36, 'Open source design and research platform.', { size: 13, color: C.gray, lineHeight: 1.4 }),
      ...mkLinks(280, 'Product', ['Features', 'Pricing', 'Changelog', 'Roadmap']),
      ...mkLinks(440, 'Resources', ['Documentation', 'Tutorials', 'Blog', 'Support']),
      ...mkLinks(600, 'Company', ['About', 'Careers', 'Contact', 'Legal']),
      ...mkLinks(760, 'Subscribe', ['Newsletter', 'YouTube', 'Twitter', 'GitHub']),
      hdivider(0, 188, 920),
      wlabel('Copy', 0, 208, 320, 16, '© 2026 Quant-UX. All rights reserved.', { size: 12, color: C.grayLight }),
      wlabel('Social 1', 860, 206, 24, 18, 'GitHub', { size: 12, color: C.gray })
    ]
    out.push(group('QXNavFooter', 'Footer', c, { subcategory: 'ANav' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 2) Hero / marketing sections                                        */
/* ------------------------------------------------------------------ */

function heroFile () {
  setPrefix('QXHero')
  const out = []

  // Hero centered
  {
    const c = [
      ...chip('Badge', 470, 24, '✦ New: AI design generation'),
      wlabel('H1', 220, 68, 600, 48, 'Design, test and iterate faster', { size: 40, bold: true, align: 'center' }),
      wlabel('Sub', 260, 128, 520, 48, 'Quant-UX is the open source design and research platform for teams that ship.', { size: 16, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbutton('CTA', 400, 204, 140, 44, 'Start for free', { radius: 8 }),
      wbutton('CTA 2', 552, 204, 140, 44, 'View demo', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, hoverBorder: C.grayLight }),
      avatar(428, 268, 28),
      avatar(448, 268, 28, { bg: '#fef3c7' }),
      avatar(468, 268, 28, { bg: '#dcfce7' }),
      wlabel('Users', 504, 276, 160, 16, 'Loved by 10,000+ designers', { size: 13, color: C.gray }),
      hdivider(300, 324, 440),
      wlabel('Trusted', 420, 344, 200, 14, 'TRUSTED BY TEAMS AT', { size: 11, color: C.grayLight, align: 'center', bold: true }),
      ...['Google', 'Spotify', 'Airbnb', 'Uber', 'Netflix'].map((b, i) => wlabel(`Brand ${i}`, 250 + i * 112, 372, 96, 20, b, { size: 15, color: C.grayLight, align: 'center', bold: true }))
    ]
    out.push(group('QXHeroCentered', 'Hero Centered', c, { subcategory: 'BHero' }))
  }

  // Hero left text + image
  {
    const c = [
      ...chip('Eyebrow', 0, 20, 'v4.0 is here'),
      wlabel('H1', 0, 60, 460, 88, 'Prototype that feels like the real product', { size: 32, bold: true, lineHeight: 1.25 }),
      wlabel('Sub', 0, 164, 440, 48, 'Create interactive prototypes, run usability tests and gather feedback — all in one place.', { size: 15, color: C.gray, lineHeight: 1.5 }),
      wbutton('CTA', 0, 232, 140, 44, 'Get started', { radius: 8 }),
      wbutton('CTA 2', 156, 232, 120, 44, 'Learn more', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light }),
      hdivider(0, 312, 440),
      wlabel('S1V', 0, 332, 120, 26, '10k+', { size: 24, bold: true }),
      wlabel('S1L', 0, 360, 120, 14, 'Designers', { size: 12, color: C.gray }),
      wlabel('S2V', 140, 332, 120, 26, '45k', { size: 24, bold: true }),
      wlabel('S2L', 140, 360, 120, 14, 'Prototypes', { size: 12, color: C.gray }),
      wlabel('S3V', 280, 332, 120, 26, '99.9%', { size: 24, bold: true }),
      wlabel('S3L', 280, 360, 140, 14, 'Uptime', { size: 12, color: C.gray }),
      ...imagePlaceholder('Hero Image', 520, 40, 520, 340, { radius: 12 }),
      ...chip('Float Card', 840, 300, '✓ 38% faster testing')
    ]
    out.push(group('QXHeroLeft', 'Hero with Image', c, { subcategory: 'BHero' }))
  }

  // Hero split dark
  {
    const c = [
      wbox('Bg', 0, 0, 1040, 400, { bg: C.sidebar, borderColor: C.sidebar }),
      wlabel('Eyebrow', 64, 96, 200, 16, 'EARLY ACCESS', { size: 12, color: '#93c5fd', bold: true }),
      wlabel('H1', 64, 124, 420, 96, 'The future of design research', { size: 34, bold: true, color: C.white, lineHeight: 1.25 }),
      wlabel('Sub', 64, 236, 400, 48, 'Join the waitlist and be the first to try collaborative testing.', { size: 15, color: C.sidebarText, lineHeight: 1.5 }),
      wbutton('CTA', 64, 304, 160, 44, 'Join waitlist', { radius: 8 }),
      wlabel('Note', 240, 316, 200, 16, 'No credit card required', { size: 12, color: C.grayLight }),
      wbox('Form Card', 580, 60, 396, 280, { bg: C.white, radius: 16, borderColor: C.white }),
      wlabel('Form Title', 612, 92, 200, 22, 'Create account', { size: 18, bold: true }),
      wlabel('Form Sub', 612, 118, 300, 16, 'Start your free 14-day trial.', { size: 13, color: C.gray }),
      wlabel('F1L', 612, 152, 100, 14, 'Email', { size: 12, color: C.gray }),
      wtext('F1', 612, 170, 332, 38, 'you@company.com'),
      wlabel('F2L', 612, 220, 100, 14, 'Password', { size: 12, color: C.gray }),
      wtext('F2', 612, 238, 332, 38, '••••••••', { type: 'Password', cleartext: true }),
      wbutton('Form CTA', 612, 290, 332, 40, 'Create account', { radius: 8 })
    ]
    out.push(group('QXHeroDark', 'Hero Dark with Form', c, { subcategory: 'BHero' }))
  }

  // Feature row 3
  {
    const card = (x, icon, title, text) => [
      wbox(`Card ${x}`, x, 0, 320, 240, { bg: C.white, radius: 12 }),
      wbox(`Icon Bg ${x}`, x + 24, 24, 48, 48, { bg: C.primarySoft, radius: 12, borderColor: C.primarySoft }),
      wicon(`Icon ${x}`, x + 36, 36, 24, icon, { color: C.primary }),
      wlabel(`Title ${x}`, x + 24, 92, 260, 20, title, { size: 16, bold: true }),
      wlabel(`Text ${x}`, x + 24, 120, 272, 64, text, { size: 13, color: C.gray, lineHeight: 1.5 }),
      wlabel(`Link ${x}`, x + 24, 196, 160, 16, 'Learn more →', { size: 13, color: C.primary })
    ]
    const c = [
      ...card(0, 'mdi-vector-square', 'Design', 'Draw screens with a rich widget set and smart snapping.'),
      ...card(360, 'mdi-cellphone', 'Test', 'Run moderated and unmoderated usability tests.'),
      ...card(720, 'mdi-chart-bar', 'Analyze', 'Heatmaps, funnels and task analytics out of the box.')
    ]
    out.push(group('QXHeroFeatures3', 'Feature Row', c, { subcategory: 'BHero' }))
  }

  // Feature split with bullets
  {
    const c = [
      ...imagePlaceholder('Img', 0, 0, 440, 320, { radius: 12 }),
      wlabel('Title', 500, 16, 400, 32, 'Everything included', { size: 24, bold: true }),
      wlabel('Sub', 500, 56, 420, 44, 'No plugins, no add-ons. Everything your team needs ships in the core.', { size: 14, color: C.gray, lineHeight: 1.5 }),
      ...['Unlimited prototypes', 'Collaborative editing', 'Usability test suite', 'Analytics & heatmaps'].flatMap((t, i) => [
        wicon(`Check ${i}`, 500, 116 + i * 44, 22, 'mdi-check-circle', { color: C.success }),
        wlabel(`Bullet ${i}`, 534, 119 + i * 44, 300, 18, t, { size: 14 })
      ]),
      wbutton('CTA', 500, 300, 140, 40, 'See all features', { radius: 8 })
    ]
    out.push(group('QXHeroFeatureSplit', 'Feature Split', c, { subcategory: 'BHero' }))
  }

  // CTA banner
  {
    const c = [
      wbox('Bg', 0, 0, 1040, 180, { bg: C.primarySoft, radius: 16, borderColor: C.primaryBorder }),
      wlabel('Title', 48, 44, 520, 32, 'Ready to start designing?', { size: 24, bold: true }),
      wlabel('Sub', 48, 84, 520, 20, 'Free for individuals. No credit card required.', { size: 14, color: C.gray }),
      wbutton('CTA', 760, 68, 220, 44, 'Create free account', { radius: 8 })
    ]
    out.push(group('QXHeroCTA', 'CTA Banner', c, { subcategory: 'BHero' }))
  }

  // Page header
  {
    const c = [
      wlabel('B1', 0, 8, 48, 16, 'Home', { size: 12, color: C.primary }),
      wicon('Chev', 52, 9, 12, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B2', 70, 8, 120, 16, 'Team management', { size: 12, color: C.gray }),
      wlabel('Title', 0, 32, 400, 30, 'Team members', { size: 22, bold: true }),
      wlabel('Sub', 0, 68, 480, 18, 'Manage who can access your workspace and prototypes.', { size: 13, color: C.gray }),
      wbutton('Secondary', 856, 40, 84, 36, 'Export', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light }),
      wbutton('Primary', 952, 40, 88, 36, '+ Invite'),
      hdivider(0, 96, 1040)
    ]
    out.push(group('QXHeroPageHeader', 'Page Header', c, { subcategory: 'BHero' }))
  }

  // Stats row
  {
    const stat = (x, value, label) => [
      wlabel(`V ${x}`, x, 0, 220, 34, value, { size: 30, bold: true }),
      wlabel(`L ${x}`, x, 40, 220, 18, label, { size: 13, color: C.gray }),
      x < 780 ? vdivider(x + 244, 0, 52) : null
    ].filter(Boolean)
    const c = [
      ...stat(0, '24.5k', 'Monthly visitors'),
      ...stat(260, '3,204', 'Active users'),
      ...stat(520, '4.8%', 'Conversion rate'),
      ...stat(780, '92%', 'Retention')
    ]
    out.push(group('QXHeroStats', 'Stats Row', c, { subcategory: 'BHero' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 3) Cards                                                            */
/* ------------------------------------------------------------------ */

function cardFile () {
  setPrefix('QXCard')
  const out = []

  // Pricing card
  {
    const c = [
      wbox('Card', 0, 0, 300, 420, { bg: C.white, radius: 12 }),
      wlabel('Tier', 24, 24, 200, 22, 'Pro', { size: 18, bold: true }),
      wlabel('Tier Desc', 24, 50, 240, 18, 'For growing design teams', { size: 13, color: C.gray }),
      wlabel('Price', 24, 84, 140, 36, '$12', { size: 32, bold: true }),
      wlabel('Per', 100, 104, 120, 16, '/ user / month', { size: 12, color: C.grayLight }),
      hdivider(24, 136, 252),
      ...['Unlimited prototypes', 'Usability testing', 'Analytics suite', 'Priority support'].flatMap((t, i) => [
        wicon(`Check ${i}`, 24, 156 + i * 32, 20, 'mdi-check', { color: C.success }),
        wlabel(`F ${i}`, 52, 159 + i * 32, 220, 18, t, { size: 13 })
      ]),
      wbutton('CTA', 24, 340, 252, 44, 'Choose Pro', { radius: 8 })
    ]
    out.push(group('QXCardPricing', 'Pricing Card', c, { subcategory: 'CCard' }))
  }

  // Pricing table (3 cards)
  {
    const tier = (x, name, price, features, highlight) => {
      const border = highlight ? C.primary : C.border
      const c = [
        wbox(`Card ${name}`, x, highlight ? 0 : 24, 300, highlight ? 436 : 388, { bg: C.white, radius: 12, borderColor: border, borderWidth: highlight ? 2 : 1 }),
        wlabel(`Name ${name}`, x + 24, (highlight ? 0 : 24) + 24, 200, 22, name, { size: 18, bold: true }),
        wlabel(`Price ${name}`, x + 24, (highlight ? 0 : 24) + 56, 160, 34, price, { size: 30, bold: true }),
        wlabel(`Per ${name}`, x + 24, (highlight ? 0 : 24) + 92, 200, 16, 'per month', { size: 12, color: C.grayLight }),
        hdivider(x + 24, (highlight ? 0 : 24) + 120, 252),
        ...features.flatMap((t, i) => [
          wicon(`C ${name} ${i}`, x + 24, (highlight ? 0 : 24) + 140 + i * 30, 18, 'mdi-check', { color: C.success }),
          wlabel(`F ${name} ${i}`, x + 50, (highlight ? 0 : 24) + 142 + i * 30, 220, 17, t, { size: 13 })
        ]),
        wbutton(`CTA ${name}`, x + 24, (highlight ? 0 : 24) + 308, 252, 40, `Choose ${name}`, {
          radius: 8,
          bg: highlight ? C.primary : C.white,
          color: highlight ? C.white : C.dark,
          borderColor: highlight ? C.primary : C.border,
          hoverBg: highlight ? C.primaryHover : C.light
        })
      ]
      if (highlight) {
        c.push(...chip(`Badge ${name}`, x + 204, 12, 'POPULAR'))
      }
      return c
    }
    const c = [
      ...tier(0, 'Basic', '$0', ['3 prototypes', '1 user', 'Community support']),
      ...tier(320, 'Pro', '$12', ['Unlimited prototypes', '5 users', 'Usability testing', 'Analytics'], true),
      ...tier(640, 'Enterprise', '$49', ['Everything in Pro', 'SSO & audit logs', 'Dedicated support', 'Custom SLA'])
    ]
    out.push(group('QXCardPricingTable', 'Pricing Table', c, { subcategory: 'CCard' }))
  }

  // Stat card
  {
    const c = [
      wbox('Card', 0, 0, 240, 120, { bg: C.white, radius: 12 }),
      wlabel('Label', 16, 16, 140, 14, 'Monthly revenue', { size: 12, color: C.gray }),
      wlabel('Value', 16, 36, 160, 30, '$48,210', { size: 24, bold: true }),
      ...chip('Delta', 16, 76, '▲ 12.5%', { bg: C.successSoft, color: C.success }),
      wlabel('Since', 92, 79, 120, 14, 'vs last month', { size: 11, color: C.grayLight }),
      wicon('Icon', 196, 16, 24, 'mdi-currency-usd', { color: C.primaryLight || C.primary })
    ]
    out.push(group('QXCardStat', 'Stat Card', c, { subcategory: 'CCard' }))
  }

  // Product card
  {
    const c = [
      wbox('Card', 0, 0, 240, 360, { bg: C.white, radius: 12 }),
      ...imagePlaceholder('Image', 12, 12, 216, 200, { radius: 8 }),
      wicon('Wish', 204, 24, 20, 'mdi-heart-outline', { color: C.danger }),
      wlabel('Category', 16, 226, 120, 14, 'Sneakers', { size: 11, color: C.grayLight }),
      wlabel('Title', 16, 244, 208, 20, 'Runner Pro X1', { size: 15, bold: true }),
      wrating('Rating', 16, 270, 100, 20, 4),
      wlabel('Reviews', 124, 274, 100, 14, '(128)', { size: 11, color: C.grayLight }),
      wlabel('Price', 16, 300, 100, 22, '$129', { size: 18, bold: true }),
      wbutton('Add', 152, 296, 72, 32, 'Add', { radius: 6 })
    ]
    out.push(group('QXCardProduct', 'Product Card', c, { subcategory: 'CCard' }))
  }

  // Profile card
  {
    const c = [
      wbox('Card', 0, 0, 300, 340, { bg: C.white, radius: 12 }),
      wbox('Cover', 0, 0, 300, 80, { bg: C.primarySoft, borderColor: C.primarySoft, radius: 0 }),
      avatar(116, 44, 68, { bg: C.white }),
      wicon('Avatar Icon', 134, 60, 32, 'mdi-account', { color: C.grayLight }),
      wlabel('Name', 50, 124, 200, 22, 'Anna Müller', { size: 17, bold: true, align: 'center' }),
      wlabel('Role', 50, 150, 200, 16, 'Product Designer', { size: 13, color: C.gray, align: 'center' }),
      hdivider(40, 180, 220),
      wlabel('SV1', 48, 196, 68, 22, '142', { size: 17, bold: true, align: 'center' }),
      wlabel('SL1', 48, 220, 68, 14, 'Posts', { size: 11, color: C.grayLight, align: 'center' }),
      vdivider(128, 196, 40),
      wlabel('SV2', 148, 196, 68, 22, '8.4k', { size: 17, bold: true, align: 'center' }),
      wlabel('SL2', 148, 220, 68, 14, 'Followers', { size: 11, color: C.grayLight, align: 'center' }),
      vdivider(228, 196, 40),
      wlabel('SV3', 244, 196, 48, 22, '312', { size: 17, bold: true, align: 'center' }),
      wlabel('SL3', 244, 220, 48, 14, 'Following', { size: 11, color: C.grayLight, align: 'center' }),
      wbutton('Follow', 24, 256, 120, 38, 'Follow', { radius: 999 }),
      wbutton('Message', 156, 256, 120, 38, 'Message', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 999 })
    ]
    out.push(group('QXCardProfile', 'Profile Card', c, { subcategory: 'CCard' }))
  }

  // Comment item
  {
    const c = [
      avatar(0, 0, 36),
      wlabel('Name', 48, 0, 200, 18, 'Peter Simmons', { size: 14, bold: true }),
      wlabel('Time', 48, 20, 200, 14, '2 hours ago', { size: 12, color: C.grayLight }),
      wlabel('Text', 48, 44, 464, 44, 'This is exactly what we needed! The analytics view saved us hours of manual work every week.', { size: 14, lineHeight: 1.5 }),
      wicon('Like', 48, 96, 18, 'mdi-thumb-up-outline'),
      wlabel('Like Count', 72, 98, 40, 14, '24', { size: 12, color: C.gray }),
      wicon('Dislike', 112, 96, 18, 'mdi-thumb-down-outline'),
      wlabel('Reply', 152, 98, 48, 14, 'Reply', { size: 12, color: C.primary })
    ]
    out.push(group('QXCardComment', 'Comment Item', c, { subcategory: 'CCard' }))
  }

  // Testimonial card
  {
    const c = [
      wbox('Card', 0, 0, 360, 240, { bg: C.white, radius: 12 }),
      wicon('Quote', 24, 24, 32, 'mdi-format-quote-open', { color: C.primaryBorder }),
      wlabel('Text', 24, 72, 312, 64, '“We replaced three tools with Quant-UX. Our research cycle went from weeks to days.”', { size: 14, lineHeight: 1.6 }),
      wrating('Stars', 24, 148, 120, 20, 5),
      avatar(24, 180, 36),
      wlabel('Name', 72, 182, 180, 18, 'Julia Chen', { size: 14, bold: true }),
      wlabel('Role', 72, 202, 220, 14, 'Head of Design, Northwind', { size: 12, color: C.grayLight })
    ]
    out.push(group('QXCardTestimonial', 'Testimonial Card', c, { subcategory: 'CCard' }))
  }

  // Empty state
  {
    const c = [
      wbox('Icon Bg', 148, 24, 104, 104, { bg: C.light, radius: 52, borderColor: C.light }),
      wicon('Icon', 174, 50, 52, 'mdi-file-search-outline', { color: C.grayLight }),
      wlabel('Title', 60, 156, 280, 24, 'No results found', { size: 18, bold: true, align: 'center' }),
      wlabel('Sub', 60, 186, 280, 40, 'Try adjusting your search or filters to find what you are looking for.', { size: 13, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbutton('Action', 130, 240, 140, 40, 'Clear filters', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 })
    ]
    out.push(group('QXCardEmpty', 'Empty State', c, { subcategory: 'CCard' }))
  }

  // Social login
  {
    const c = [
      wbox('Card', 0, 0, 340, 300, { bg: C.white, radius: 12 }),
      wlabel('Title', 0, 32, 340, 24, 'Sign in with', { size: 18, bold: true, align: 'center' }),
      wbutton('Google', 36, 80, 268, 44, 'Continue with Google', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('Google Ic', 56, 94, 18, 'mdi-google', { color: C.dark }),
      wbutton('GitHub', 36, 136, 268, 44, 'Continue with GitHub', { bg: '#181717', color: C.white, borderColor: '#181717', hoverBg: '#000000', radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('GitHub Ic', 56, 150, 18, 'mdi-github', { color: C.white }),
      wbutton('Microsoft', 36, 192, 268, 44, 'Continue with Microsoft', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('MS Ic', 56, 206, 18, 'mdi-microsoft-windows', { color: C.dark }),
      wlabel('Terms', 36, 256, 268, 28, 'By continuing you agree to our Terms of Service and Privacy Policy.', { size: 11, color: C.grayLight, align: 'center', lineHeight: 1.4 })
    ]
    out.push(group('QXCardSocialLogin', 'Social Login', c, { subcategory: 'CCard' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 4) Forms                                                            */
/* ------------------------------------------------------------------ */

function formFile () {
  setPrefix('QXForm')
  const out = []

  // Search bar
  {
    const c = [
      wbox('Bar', 0, 0, 480, 44, { bg: C.white, radius: 999, borderColor: C.border }),
      wicon('Icon', 16, 12, 20, 'mdi-magnify'),
      wlabel('Placeholder', 48, 14, 280, 16, 'Search products, brands...', { size: 14, color: C.grayLight }),
      wbutton('Btn', 376, 4, 96, 36, 'Search', { radius: 999 })
    ]
    out.push(group('QXFormSearch', 'Search Bar', c, { subcategory: 'DForm' }))
  }

  // Newsletter
  {
    const c = [
      wbox('Card', 0, 0, 480, 160, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 300, 22, 'Stay in the loop', { size: 17, bold: true }),
      wlabel('Sub', 24, 46, 360, 18, 'Monthly product updates. No spam.', { size: 13, color: C.gray }),
      wtext('Email', 24, 78, 300, 40, 'Your email address'),
      wbutton('Subscribe', 332, 78, 124, 40, 'Subscribe', { radius: 8 }),
      wlabel('Hint', 24, 128, 300, 14, 'Unsubscribe anytime.', { size: 11, color: C.grayLight })
    ]
    out.push(group('QXFormNewsletter', 'Newsletter Signup', c, { subcategory: 'DForm' }))
  }

  // Filter panel
  {
    const c = [
      wbox('Panel', 0, 0, 260, 460, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 160, 20, 'Filters', { size: 16, bold: true }),
      wlabel('Clear', 188, 22, 52, 16, 'Clear all', { size: 12, color: C.primary, align: 'right' }),
      hdivider(20, 48, 220),
      wlabel('Cat', 20, 64, 200, 16, 'Category', { size: 13, bold: true }),
      wcheck('C1', 20, 88, 220, 24, 'Sneakers', true),
      wcheck('C2', 20, 118, 220, 24, 'Boots'),
      wcheck('C3', 20, 148, 220, 24, 'Sandals'),
      wcheck('C4', 20, 178, 220, 24, 'Loafers'),
      hdivider(20, 212, 220),
      wlabel('Price', 20, 228, 200, 16, 'Price range', { size: 13, bold: true }),
      wtext('Min', 20, 252, 100, 36, 'Min', { size: 13 }),
      wlabel('Dash', 128, 260, 24, 16, '—', { size: 13, color: C.grayLight, align: 'center' }),
      wtext('Max', 140, 252, 100, 36, 'Max', { size: 13 }),
      hdivider(20, 304, 220),
      wlabel('Rating', 20, 320, 200, 16, 'Rating', { size: 13, bold: true }),
      wdropdown('Rating D', 20, 344, 220, 36, ['4 stars & up', '3 stars & up', 'Any rating']),
      hdivider(20, 396, 220),
      wbutton('Reset', 20, 412, 100, 36, 'Reset', { bg: C.white, color: C.gray, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('Apply', 128, 412, 112, 36, 'Apply filters', { radius: 8 })
    ]
    out.push(group('QXFormFilter', 'Filter Panel', c, { subcategory: 'DForm' }))
  }

  // Contact form
  {
    const c = [
      wbox('Card', 0, 0, 420, 500, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, 'Get in touch', { size: 20, bold: true }),
      wlabel('Sub', 32, 58, 340, 18, 'We usually reply within 24 hours.', { size: 13, color: C.gray }),
      wlabel('N1L', 32, 96, 200, 14, 'First name', { size: 12, color: C.gray }),
      wtext('N1', 32, 114, 170, 38, 'Jane'),
      wlabel('N2L', 218, 96, 200, 14, 'Last name', { size: 12, color: C.gray }),
      wtext('N2', 218, 114, 170, 38, 'Doe'),
      wlabel('EL', 32, 166, 200, 14, 'Email', { size: 12, color: C.gray }),
      wtext('E', 32, 184, 356, 38, 'jane@company.com'),
      wlabel('SL', 32, 236, 200, 14, 'Subject', { size: 12, color: C.gray }),
      wdropdown('S', 32, 254, 356, 38, ['General question', 'Sales', 'Support', 'Partnership']),
      wlabel('ML', 32, 306, 200, 14, 'Message', { size: 12, color: C.gray }),
      wtext('M', 32, 324, 356, 96, 'How can we help?', { type: 'TextArea' }),
      wcheck('Agree', 32, 436, 340, 22, 'Send me a copy of this message'),
      wbutton('Send', 32, 452, 140, 40, 'Send message', { radius: 8 })
    ]
    out.push(group('QXFormContact', 'Contact Form', c, { subcategory: 'DForm' }))
  }

  // Settings form
  {
    const c = [
      wbox('Card', 0, 0, 520, 560, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, 'Account settings', { size: 20, bold: true }),
      avatar(32, 72, 64),
      wbutton('Change Avatar', 112, 96, 120, 32, 'Change photo', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 6, size: 13 }),
      wlabel('Name L', 32, 168, 200, 14, 'Full name', { size: 12, color: C.gray }),
      wtext('Name', 32, 186, 456, 38, 'Klaus Huber'),
      wlabel('Email L', 32, 238, 200, 14, 'Email', { size: 12, color: C.gray }),
      wtext('Email', 32, 256, 456, 38, 'klaus@quant-ux.com'),
      wlabel('TZ L', 32, 308, 200, 14, 'Timezone', { size: 12, color: C.gray }),
      wdropdown('TZ', 32, 326, 456, 38, ['Europe/Berlin (GMT+1)', 'America/New_York (GMT-5)', 'Asia/Shanghai (GMT+8)']),
      wlabel('Notif', 32, 384, 300, 18, 'Notifications', { size: 14, bold: true }),
      wlabel('N1L', 32, 412, 340, 16, 'Email notifications', { size: 13 }),
      wswitch('N1', 456, 406, 48, 24, true),
      wlabel('N2L', 32, 444, 340, 16, 'Product updates', { size: 13 }),
      wswitch('N2', 456, 438, 48, 24),
      wlabel('N3L', 32, 476, 340, 16, 'Weekly digest', { size: 13 }),
      wswitch('N3', 456, 470, 48, 24, true),
      hdivider(32, 504, 456),
      wbutton('Cancel', 300, 516, 88, 36, 'Cancel', { bg: C.white, color: C.gray, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('Save', 400, 516, 88, 36, 'Save changes', { radius: 8 })
    ]
    out.push(group('QXFormSettings', 'Settings Form', c, { subcategory: 'DForm' }))
  }

  // Signup extended
  {
    const c = [
      wbox('Card', 0, 0, 400, 600, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, 'Create your account', { size: 20, bold: true }),
      wlabel('Sub', 32, 58, 320, 18, 'Start your 14-day free trial.', { size: 13, color: C.gray }),
      wlabel('Name L', 32, 96, 200, 14, 'Full name', { size: 12, color: C.gray }),
      wtext('Name', 32, 114, 336, 38, 'Jane Doe'),
      wlabel('Email L', 32, 166, 200, 14, 'Email', { size: 12, color: C.gray }),
      wtext('Email', 32, 184, 336, 38, 'jane@company.com'),
      wlabel('Pw L', 32, 236, 200, 14, 'Password', { size: 12, color: C.gray }),
      wtext('Pw', 32, 254, 336, 38, '8+ characters', { type: 'Password', cleartext: true }),
      wlabel('Pw2 L', 32, 306, 200, 14, 'Confirm password', { size: 12, color: C.gray }),
      wtext('Pw2', 32, 324, 336, 38, 'Repeat password', { type: 'Password' }),
      wicon('Pw Hint Ic', 344, 260, 16, 'mdi-lock', { color: C.grayLight }),
      wcheck('Terms', 32, 380, 336, 22, 'I agree to the Terms and Privacy Policy'),
      wbutton('Create', 32, 416, 336, 44, 'Create account', { radius: 8 }),
      hdivider(32, 484, 336),
      wlabel('Or', 160, 498, 80, 14, 'or continue with', { size: 12, color: C.grayLight, align: 'center' }),
      wbutton('Google', 32, 528, 160, 40, 'Google', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('GitHub', 208, 528, 160, 40, 'GitHub', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 })
    ]
    out.push(group('QXFormSignup', 'Sign Up Form', c, { subcategory: 'DForm' }))
  }

  // Address form
  {
    const c = [
      wbox('Card', 0, 0, 420, 440, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 22, 'Shipping address', { size: 18, bold: true }),
      wlabel('SL', 32, 64, 200, 14, 'Street address', { size: 12, color: C.gray }),
      wtext('S', 32, 82, 356, 38, 'Musterstraße 12'),
      wlabel('CL', 32, 134, 200, 14, 'City', { size: 12, color: C.gray }),
      wtext('C', 32, 152, 200, 38, 'Berlin'),
      wlabel('ZL', 244, 134, 120, 14, 'ZIP', { size: 12, color: C.gray }),
      wtext('Z', 244, 152, 144, 38, '10115'),
      wlabel('CoL', 32, 204, 200, 14, 'Country', { size: 12, color: C.gray }),
      wdropdown('Co', 32, 222, 356, 38, ['Germany', 'Austria', 'Switzerland', 'China', 'United States']),
      wlabel('PhL', 32, 274, 200, 14, 'Phone', { size: 12, color: C.gray }),
      wtext('Ph', 32, 292, 356, 38, '+49 30 12345678'),
      wcheck('Default', 32, 348, 356, 22, 'Use as my default address'),
      wbutton('Save', 32, 384, 356, 40, 'Save address', { radius: 8 })
    ]
    out.push(group('QXFormAddress', 'Address Form', c, { subcategory: 'DForm' }))
  }

  // Payment form
  {
    const c = [
      wbox('Card', 0, 0, 400, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 22, 'Payment details', { size: 18, bold: true }),
      wicon('Visa', 276, 30, 28, 'mdi-credit-card', { color: C.primary }),
      wicon('MC', 310, 30, 28, 'mdi-credit-card-outline', { color: C.gray }),
      wicon('PP', 344, 30, 24, 'mdi-currency-usd', { color: C.grayLight }),
      wlabel('NumL', 32, 72, 200, 14, 'Card number', { size: 12, color: C.gray }),
      wtext('Num', 32, 90, 336, 38, '4242 4242 4242 4242'),
      wlabel('NameL', 32, 142, 200, 14, 'Name on card', { size: 12, color: C.gray }),
      wtext('Name', 32, 160, 336, 38, 'KLAUS HUBER'),
      wlabel('ExpL', 32, 212, 120, 14, 'Expiry', { size: 12, color: C.gray }),
      wtext('Exp', 32, 230, 156, 38, 'MM / YY'),
      wlabel('CvcL', 212, 212, 120, 14, 'CVC', { size: 12, color: C.gray }),
      wtext('Cvc', 212, 230, 156, 38, '123'),
      wcheck('Save', 32, 286, 300, 22, 'Save card for future payments'),
      wbutton('Pay', 32, 322, 336, 44, 'Pay $129.00', { radius: 8, bold: true })
    ]
    out.push(group('QXFormPayment', 'Payment Form', c, { subcategory: 'DForm' }))
  }

  // Login compact
  {
    const c = [
      wbox('Card', 0, 0, 320, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 28, 28, 260, 22, 'Welcome back', { size: 18, bold: true }),
      wlabel('Sub', 28, 54, 260, 16, 'Log in to continue.', { size: 13, color: C.gray }),
      wlabel('EL', 28, 92, 200, 14, 'Email', { size: 12, color: C.gray }),
      wtext('E', 28, 110, 264, 38, 'you@company.com'),
      wlabel('PL', 28, 162, 200, 14, 'Password', { size: 12, color: C.gray }),
      wtext('P', 28, 180, 264, 38, '••••••••', { type: 'Password', cleartext: true }),
      wcheck('Remember', 28, 232, 140, 22, 'Remember me'),
      wlabel('Forgot', 192, 235, 100, 16, 'Forgot?', { size: 12, color: C.primary, align: 'right' }),
      wbutton('Login', 28, 264, 264, 40, 'Log in', { radius: 8, bold: true })
    ]
    out.push(group('QXFormLoginCompact', 'Login Compact', c, { subcategory: 'DForm' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 5) Dashboard blocks                                                 */
/* ------------------------------------------------------------------ */

function dashFile () {
  setPrefix('QXDash')
  const out = []

  // Dashboard header
  {
    const c = [
      wlabel('Title', 0, 8, 300, 28, 'Analytics overview', { size: 22, bold: true }),
      wlabel('Sub', 0, 42, 400, 16, 'Data from Jan 1 – Jan 31, 2026', { size: 13, color: C.gray }),
      wdropdown('Range', 700, 12, 160, 36, ['Last 30 days', 'Last 7 days', 'This year']),
      wbutton('Export', 872, 12, 64, 36, '', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 }),
      wicon('Export Ic', 896, 22, 16, 'mdi-download', { color: C.gray }),
      wbutton('Add', 936, 12, 104, 36, '+ New report')
    ]
    out.push(group('QXDashHeader', 'Dashboard Header', c, { subcategory: 'EDash' }))
  }

  // KPI row
  {
    const kpi = (x, label, value, delta, up, icon) => [
      wbox(`Card ${x}`, x, 0, 240, 130, { bg: C.white, radius: 12 }),
      wicon(`Icon ${x}`, x + 192, 16, 24, icon, { color: C.primary }),
      wlabel(`Label ${x}`, x + 20, 18, 150, 14, label, { size: 12, color: C.gray }),
      wlabel(`Value ${x}`, x + 20, 38, 170, 30, value, { size: 24, bold: true }),
      ...chip(`Delta ${x}`, x + 20, 78, `${up ? '▲' : '▼'} ${delta}`, { bg: up ? C.successSoft : C.dangerSoft, color: up ? C.success : C.danger }),
      wlabel(`Since ${x}`, x + 104, 81, 120, 14, 'vs last month', { size: 11, color: C.grayLight })
    ]
    const c = [
      ...kpi(0, 'Revenue', '$48.2k', '12.5%', true, 'mdi-currency-usd'),
      ...kpi(268, 'Active users', '8,421', '3.2%', true, 'mdi-account-group'),
      ...kpi(536, 'Churn', '2.1%', '0.4%', false, 'mdi-chart-line'),
      ...kpi(804, 'NPS', '62', '5.0', true, 'mdi-heart')
    ]
    out.push(group('QXDashKPIRow', 'KPI Row', c, { subcategory: 'EDash' }))
  }

  // Chart card
  {
    const c = [
      wbox('Card', 0, 0, 480, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 220, 20, 'Weekly sessions', { size: 15, bold: true }),
      ...chip('Delta', 24, 48, '▲ 8.1%'),
      wdropdown('Range', 348, 16, 108, 32, ['This week', 'This month'], { size: 12 }),
      wbar('Chart', 24, 88, 432, 200, [['120'], ['180'], ['90'], ['220'], ['310'], ['260'], ['340']])
    ]
    out.push(group('QXDashBarCard', 'Bar Chart Card', c, { subcategory: 'EDash' }))
  }

  // Line chart card
  {
    const c = [
      wbox('Card', 0, 0, 480, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 240, 20, 'Conversion rate', { size: 15, bold: true }),
      ...chip('Delta', 24, 48, '▲ 2.4%', { bg: C.successSoft, color: C.success }),
      wdropdown('Range', 348, 16, 108, 32, ['30 days', '90 days'], { size: 12 }),
      wbar('Chart', 24, 88, 432, 200, [['2.1'], ['2.4'], ['2.2'], ['2.8'], ['3.0'], ['2.9'], ['3.4']], { line: true })
    ]
    out.push(group('QXDashLineCard', 'Line Chart Card', c, { subcategory: 'EDash' }))
  }

  // Ring card with legend
  {
    const c = [
      wbox('Card', 0, 0, 320, 300, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Traffic sources', { size: 15, bold: true }),
      wring('Ring', 36, 64, 140, 140, 62),
      wlabel('Ring Value', 76, 118, 60, 24, '62%', { size: 20, bold: true, align: 'center' }),
      ...[['Organic search', '2,845', C.primary], ['Direct', '1,120', C.success], ['Referral', '645', C.warning], ['Social', '312', C.grayLight]].flatMap((r, i) => [
        dot(196, 74 + i * 40, r[2]),
        wlabel(`LL ${i}`, 212, 70 + i * 40, 100, 16, r[0], { size: 12 }),
        wlabel(`LV ${i}`, 212, 88 + i * 40, 100, 16, r[1], { size: 13, bold: true })
      ])
    ]
    out.push(group('QXDashRingCard', 'Ring Chart Card', c, { subcategory: 'EDash' }))
  }

  // Pie card
  {
    const c = [
      wbox('Card', 0, 0, 320, 280, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Device split', { size: 15, bold: true }),
      wpie('Pie', 40, 60, 160, 160, [45, 30, 25]),
      ...[['Desktop', '45%', C.primary], ['Mobile', '30%', C.success], ['Tablet', '25%', C.warning]].flatMap((r, i) => [
        dot(216, 92 + i * 44, r[2]),
        wlabel(`LL ${i}`, 232, 86 + i * 44, 80, 15, r[0], { size: 12 }),
        wlabel(`LV ${i}`, 232, 102 + i * 44, 80, 16, r[1], { size: 13, bold: true })
      ])
    ]
    out.push(group('QXDashPieCard', 'Pie Chart Card', c, { subcategory: 'EDash' }))
  }

  // Table card
  {
    const c = [
      wbox('Card', 0, 0, 720, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 240, 20, 'Recent orders', { size: 15, bold: true }),
      wbox('Search', 480, 14, 130, 32, { bg: C.lighter, radius: 6, borderColor: C.border }),
      wicon('Search Ic', 492, 22, 16, 'mdi-magnify', { color: C.grayLight }),
      wbutton('Filter', 624, 14, 72, 32, 'Filter', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6, size: 13 }),
      wtable('Table', 24, 60, 672, 260,
        ['Order', 'Customer', 'Date', 'Status', 'Total'],
        [
          ['#10248', 'Anna Müller', 'Jan 12, 2026', 'Paid', '$129.00'],
          ['#10247', 'Peter Simmons', 'Jan 11, 2026', 'Pending', '$89.00'],
          ['#10246', 'Julia Chen', 'Jan 10, 2026', 'Paid', '$249.00'],
          ['#10245', 'Klaus Huber', 'Jan 8, 2026', 'Refunded', '$59.00'],
          ['#10244', 'Maria Silva', 'Jan 6, 2026', 'Paid', '$179.00']
        ]),
      wlabel('Count', 24, 340, 200, 16, 'Showing 1–5 of 128', { size: 12, color: C.grayLight }),
      wbutton('Prev', 540, 332, 32, 32, '<', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 }),
      wbox('Page', 580, 332, 32, 32, { bg: C.primarySoft, radius: 6, borderColor: C.primarySoft }),
      wlabel('Page L', 580, 340, 32, 16, '1', { size: 13, bold: true, color: C.primary, align: 'center' }),
      wbutton('Next', 620, 332, 32, 32, '>', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 })
    ]
    out.push(group('QXDashTableCard', 'Table Card', c, { subcategory: 'EDash' }))
  }

  // Progress panel
  {
    const rows = [['Design system', 82], ['Mobile app', 54], ['Website', 96], ['API docs', 28]]
    const c = [
      wbox('Card', 0, 0, 320, 280, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Project progress', { size: 15, bold: true }),
      ...rows.flatMap((r, i) => [
        wlabel(`PL ${i}`, 20, 60 + i * 52, 180, 16, r[0], { size: 13 }),
        wlabel(`PV ${i}`, 260, 60 + i * 52, 40, 16, `${r[1]}%`, { size: 13, bold: true, align: 'right' }),
        wprogress(`P ${i}`, 20, 82 + i * 52, 280, 8, r[1])
      ])
    ]
    out.push(group('QXDashProgress', 'Progress Panel', c, { subcategory: 'EDash' }))
  }

  // Activity feed
  {
    const acts = [
      ['mdi-comment-text', C.primarySoft, C.primary, 'Anna commented on “Checkout flow”', '10:42 AM'],
      ['mdi-file-document-outline', C.successSoft, C.success, 'Peter uploaded “Brand-assets-v3.zip”', '9:15 AM'],
      ['mdi-account-plus', C.warningSoft, C.warning, 'Maria invited 2 new members', 'Yesterday'],
      ['mdi-check-circle', C.successSoft, C.success, 'Sprint 24 goals completed', 'Yesterday'],
      ['mdi-cog', C.light, C.gray, 'Integration settings changed', 'Monday']
    ]
    const c = [
      wbox('Card', 0, 0, 360, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Activity', { size: 15, bold: true }),
      wlabel('See All', 288, 23, 52, 14, 'See all', { size: 12, color: C.primary, align: 'right' }),
      ...acts.flatMap((a, i) => [
        wbox(`Ic Bg ${i}`, 20, 56 + i * 64, 36, 36, { bg: a[1], radius: 18, borderColor: a[1] }),
        wicon(`Ic ${i}`, 28, 64 + i * 64, 20, a[0], { color: a[2] }),
        wlabel(`T ${i}`, 68, 58 + i * 64, 268, 34, a[3], { size: 13, lineHeight: 1.3 }),
        wlabel(`Time ${i}`, 68, 78 + i * 64, 200, 13, a[4], { size: 11, color: C.grayLight })
      ])
    ]
    out.push(group('QXDashActivity', 'Activity Feed', c, { subcategory: 'EDash' }))
  }

  // Calendar
  {
    const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    const c = [
      wbox('Card', 0, 0, 320, 340, { bg: C.white, radius: 12 }),
      wlabel('Month', 20, 20, 160, 20, 'January 2026', { size: 15, bold: true }),
      wicon('Prev', 264, 20, 18, 'mdi-chevron-left'),
      wicon('Next', 288, 20, 18, 'mdi-chevron-right'),
      ...days.map((d, i) => wlabel(`H ${i}`, 20 + i * 40, 56, 32, 14, d, { size: 11, color: C.grayLight, align: 'center', bold: true })),
      ...Array.from({ length: 35 }, (_, i) => {
        const day = i - 2 // Jan 1st 2026 is a Thursday -> column 3 in a Mo-first grid
        const col = i % 7
        const row = Math.floor(i / 7)
        const x = 20 + col * 40
        const y = 76 + row * 40
        const valid = day >= 1 && day <= 31
        const isToday = day === 15
        const isWeekend = col >= 5
        const res = []
        if (isToday) {
          res.push(wbox(`D Bg ${i}`, x, y, 32, 32, { bg: C.primary, radius: 8, borderColor: C.primary }))
        }
        res.push(wlabel(`D ${i}`, x, y + 8, 32, 15, valid ? String(day) : '', {
          size: 12,
          align: 'center',
          bold: isToday,
          color: isToday ? C.white : (isWeekend ? C.grayLight : C.dark)
        }))
        return res
      }).flat(),
      // event dots below days 8, 21 and 26 (day d sits at index d + 2)
      ...[8, 21, 26].map(d => {
        const i = d + 2
        return dot(20 + (i % 7) * 40 + 13, 76 + Math.floor(i / 7) * 40 + 26, C.primary, 6)
      })
    ]
    out.push(group('QXDashCalendar', 'Calendar Month', c, { subcategory: 'EDash' }))
  }

  // Kanban column
  {
    const task = (y, title, tag, tagColor, tagBg, due, avatarBg) => [
      wbox(`Task ${y}`, 12, y, 232, 96, { bg: C.white, radius: 8 }),
      wlabel(`TT ${y}`, 24, y + 12, 180, 17, title, { size: 13, bold: true, lineHeight: 1.3 }),
      ...chip(`Tag ${y}`, 24, y + 38, tag, { bg: tagBg, color: tagColor }),
      wlabel(`Due ${y}`, 24, y + 66, 120, 14, `⏱ ${due}`, { size: 11, color: C.grayLight }),
      avatar(212, y + 64, 22, { bg: avatarBg })
    ]
    const c = [
      wlabel('Title', 0, 0, 160, 20, 'In Progress', { size: 14, bold: true }),
      wbox('Count', 92, 2, 24, 18, { bg: C.primarySoft, radius: 9, borderColor: C.primarySoft }),
      wlabel('Count L', 92, 5, 24, 13, '3', { size: 11, bold: true, color: C.primary, align: 'center' }),
      wicon('Add', 224, 0, 20, 'mdi-plus', { color: C.gray }),
      ...task(32, 'Fix login redirect on Safari', 'Bug', C.danger, C.dangerSoft, 'Jan 14', '#fee2e2'),
      ...task(140, 'Update pricing page copy', 'Content', C.primary, C.primarySoft, 'Jan 16', '#dbeafe'),
      ...task(248, 'Setup CI for e2e tests', 'DevOps', C.warning, C.warningSoft, 'Jan 18', '#fef3c7'),
      wbox('Add Card', 12, 356, 232, 44, { bg: C.white, radius: 8, borderColor: C.border, borderWidth: 1 }),
      wlabel('Add L', 12, 370, 232, 16, '+ Add card', { size: 13, color: C.gray, align: 'center' })
    ]
    out.push(group('QXDashKanban', 'Kanban Column', c, { subcategory: 'EDash' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 6) Lists & social                                                   */
/* ------------------------------------------------------------------ */

function listFile () {
  setPrefix('QXList')
  const out = []

  // Inbox
  {
    const mails = [
      ['Anna Müller', 'Design review notes for v3', '9:24', true, true],
      ['GitHub', '[quant-ux] PR #482 merged', '8:51', true, false],
      ['Julia Chen', 'Re: Contract update', 'Yesterday', false, false],
      ['Newsletter', 'Weekly design digest', 'Tue', false, true],
      ['Peter Simmons', 'Lunch tomorrow?', 'Mon', false, false]
    ]
    const c = [
      wbox('Panel', 0, 0, 520, 400, { bg: C.white, radius: 12 }),
      wcheck('All', 20, 20, 24, 22, '', false),
      wicon('Archive', 56, 22, 20, 'mdi-archive-outline'),
      wicon('Delete', 84, 22, 20, 'mdi-delete'),
      wlabel('Title', 420, 22, 80, 18, 'Inbox (2)', { size: 14, bold: true, align: 'right' }),
      hdivider(0, 56, 520),
      ...mails.flatMap((m, i) => {
        const y = 56 + i * 64
        const unread = m[3]
        return [
          wbox(`Row Bg ${i}`, 0, y, 520, 64, { bg: unread ? C.primarySoft : C.white, borderColor: C.border, borderWidth: 0, radius: 0 }),
          avatar(20, y + 14, 36, { bg: ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff'][i] }),
          wlabel(`Name ${i}`, 68, y + 14, 260, 17, m[0], { size: 14, bold: unread }),
          wlabel(`Sub ${i}`, 68, y + 35, 320, 15, m[1], { size: 13, color: unread ? C.dark : C.gray }),
          wlabel(`Time ${i}`, 428, y + 16, 72, 14, m[2], { size: 11, color: C.grayLight, align: 'right' }),
          wicon(`Star ${i}`, 432, y + 38, 18, m[4] ? 'mdi-star' : 'mdi-star-outline', { color: m[4] ? C.warning : C.grayLight }),
          i < 4 ? hdivider(16, y + 64, 488) : null
        ].filter(Boolean)
      })
    ]
    out.push(group('QXListInbox', 'Inbox List', c, { subcategory: 'FList' }))
  }

  // Chat window
  {
    const c = [
      wbox('Window', 0, 0, 400, 480, { bg: C.lighter, radius: 12 }),
      wbox('Header', 0, 0, 400, 60, { bg: C.white, borderColor: C.border, radius: 0 }),
      avatar(16, 14, 32),
      wlabel('Name', 60, 14, 160, 18, 'Anna Müller', { size: 14, bold: true }),
      wlabel('Status', 60, 34, 160, 14, '● Online', { size: 11, color: C.success }),
      wicon('Call', 340, 18, 20, 'mdi-phone'),
      wicon('More', 368, 18, 20, 'mdi-dots-vertical'),
      wbox('Msg 1', 16, 76, 200, 40, { bg: C.white, radius: 12, borderColor: C.border }),
      wlabel('Msg 1 T', 28, 88, 176, 16, 'Hey! How is the redesign going?', { size: 13 }),
      wbox('Msg 2', 184, 128, 200, 68, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Msg 2 T', 196, 140, 176, 44, 'Going great! I finished the dashboard screens today ✨', { size: 13, color: C.white, lineHeight: 1.4 }),
      wbox('Msg 3', 16, 208, 160, 40, { bg: C.white, radius: 12, borderColor: C.border }),
      wlabel('Msg 3 T', 28, 220, 136, 16, 'Can you share them?', { size: 13 }),
      wbox('Msg 4', 248, 258, 136, 40, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Msg 4 T', 260, 270, 112, 16, 'Sure, one sec!', { size: 13, color: C.white }),
      wlabel('Typing', 16, 306, 200, 14, 'Anna is typing...', { size: 11, color: C.grayLight }),
      wbox('Input', 16, 408, 320, 44, { bg: C.white, radius: 999, borderColor: C.border }),
      wlabel('Input PH', 36, 422, 240, 16, 'Write a message...', { size: 13, color: C.grayLight }),
      wicon('Attach', 300, 422, 18, 'mdi-attachment', { color: C.grayLight }),
      wbox('Send Btn', 348, 408, 44, 44, { bg: C.primary, radius: 22, borderColor: C.primary }),
      wicon('Send Ic', 361, 421, 18, 'mdi-send', { color: C.white })
    ]
    out.push(group('QXListChat', 'Chat Window', c, { subcategory: 'FList' }))
  }

  // Notifications panel
  {
    const notifs = [
      ['mdi-account-plus', C.primarySoft, C.primary, 'New team member', 'Maria Silva joined your workspace', '2m'],
      ['mdi-comment-text', C.successSoft, C.success, 'New comment', 'Peter commented on “Home screen”', '1h'],
      ['mdi-alert-circle', C.warningSoft, C.warning, 'Storage 90% full', 'Consider upgrading your plan', '3h'],
      ['mdi-check-circle', C.primarySoft, C.primary, 'Deploy finished', 'v4.0.2 is now live', 'Yesterday']
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Notifications', { size: 15, bold: true }),
      wlabel('Mark', 224, 23, 116, 14, 'Mark all as read', { size: 12, color: C.primary, align: 'right' }),
      hdivider(0, 52, 360),
      ...notifs.flatMap((n, i) => {
        const y = 52 + i * 72
        return [
          wbox(`Ic Bg ${i}`, 20, y + 12, 40, 40, { bg: n[1], radius: 20, borderColor: n[1] }),
          wicon(`Ic ${i}`, 30, y + 22, 20, n[0], { color: n[2] }),
          wlabel(`T ${i}`, 72, y + 12, 200, 17, n[3], { size: 13, bold: true }),
          wlabel(`D ${i}`, 72, y + 32, 250, 30, n[4], { size: 12, color: C.gray, lineHeight: 1.3 }),
          wlabel(`Time ${i}`, 296, y + 14, 44, 13, n[5], { size: 11, color: C.grayLight, align: 'right' }),
          hdivider(0, y + 72, 360)
        ]
      }),
      wlabel('Footer', 0, 372, 360, 16, 'View all notifications', { size: 13, color: C.primary, align: 'center' })
    ]
    out.push(group('QXListNotifications', 'Notification Panel', c, { subcategory: 'FList' }))
  }

  // Social feed item
  {
    const c = [
      wbox('Card', 0, 0, 480, 200, { bg: C.white, radius: 12 }),
      avatar(20, 20, 40),
      wlabel('Name', 72, 22, 220, 18, 'Julia Chen', { size: 14, bold: true }),
      wlabel('Handle', 72, 42, 220, 14, '@juliadesign · 3h', { size: 12, color: C.grayLight }),
      wicon('More', 444, 22, 18, 'mdi-dots-horizontal'),
      wlabel('Text', 20, 76, 440, 40, 'Just shipped our new design system 🎉 40+ components, fully documented. Feedback welcome!', { size: 14, lineHeight: 1.4 }),
      hdivider(20, 128, 440),
      wicon('Like', 28, 144, 20, 'mdi-heart-outline', { color: C.danger }),
      wlabel('Like C', 54, 147, 40, 14, '128', { size: 12, color: C.gray }),
      wicon('Comment Ic', 116, 144, 20, 'mdi-comment-outline'),
      wlabel('Comment C', 142, 147, 40, 14, '32', { size: 12, color: C.gray }),
      wicon('Share', 204, 144, 20, 'mdi-share-variant'),
      wicon('Bookmark', 444, 144, 20, 'mdi-bookmark-outline')
    ]
    out.push(group('QXListFeed', 'Feed Item', c, { subcategory: 'FList' }))
  }

  // Team list
  {
    const members = [
      ['Klaus Huber', 'Owner', C.primarySoft, C.primary],
      ['Anna Müller', 'Admin', C.successSoft, C.success],
      ['Peter Simmons', 'Editor', C.warningSoft, C.warning],
      ['Julia Chen', 'Editor', C.warningSoft, C.warning],
      ['Maria Silva', 'Viewer', C.light, C.gray]
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 360, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'Team members', { size: 15, bold: true }),
      wlabel('Invite', 280, 23, 60, 14, '+ Invite', { size: 13, color: C.primary, align: 'right' }),
      hdivider(0, 52, 360),
      ...members.flatMap((m, i) => {
        const y = 64 + i * 60
        return [
          avatar(20, y, 36, { bg: m[2] }),
          wlabel(`N ${i}`, 68, y + 2, 160, 17, m[0], { size: 14, bold: true }),
          ...chip(`Role ${i}`, 68, y + 22, m[1], { bg: m[2], color: m[3], h: 18 }),
          wicon(`More ${i}`, 320, y + 8, 18, 'mdi-dots-vertical')
        ]
      })
    ]
    out.push(group('QXListTeam', 'Team List', c, { subcategory: 'FList' }))
  }

  // Todo list
  {
    const todos = [
      ['Review pull request #482', true],
      ['Prepare sprint demo slides', false],
      ['Update component library docs', false],
      ['Schedule user testing sessions', false],
      ['Fix mobile nav overflow bug', false]
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 380, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, 'My tasks', { size: 15, bold: true }),
      ...chip('Badge', 90, 20, '1 / 5', { h: 20 }),
      wbox('Input', 20, 52, 240, 36, { bg: C.lighter, radius: 8, borderColor: C.border }),
      wlabel('Input PH', 32, 62, 200, 16, 'Add a new task...', { size: 13, color: C.grayLight }),
      wbox('Add Btn', 268, 52, 72, 36, { bg: C.primary, radius: 8, borderColor: C.primary }),
      wlabel('Add L', 268, 62, 72, 16, '+ Add', { size: 13, color: C.white, align: 'center', bold: true }),
      hdivider(20, 104, 320),
      ...todos.flatMap((t, i) => {
        const y = 116 + i * 48
        return [
          wcheck(`C ${i}`, 20, y, 24, 22, '', t[1]),
          wlabel(`T ${i}`, 56, y, 240, 18, t[0], { size: 14, color: t[1] ? C.grayLight : C.dark }),
          wicon(`Del ${i}`, 320, y, 18, 'mdi-close', { color: C.grayLight })
        ]
      }),
      hdivider(20, 340, 320),
      wlabel('Footer', 20, 352, 200, 16, '4 tasks remaining', { size: 12, color: C.grayLight }),
      wlabel('Clear', 260, 352, 80, 16, 'Clear done', { size: 12, color: C.primary, align: 'right' })
    ]
    out.push(group('QXListTodo', 'Todo List', c, { subcategory: 'FList' }))
  }

  // Comment thread
  {
    const c = [
      wlabel('Title', 0, 0, 200, 20, 'Comments (3)', { size: 15, bold: true }),
      hdivider(0, 32, 560),
      avatar(0, 48, 36),
      wlabel('N1', 48, 48, 200, 17, 'Anna Müller', { size: 14, bold: true }),
      wlabel('T1', 48, 68, 200, 14, '2h ago', { size: 12, color: C.grayLight }),
      wlabel('B1', 48, 90, 512, 40, 'The spacing in the hero section looks much better now. Maybe increase the CTA button size?', { size: 14, lineHeight: 1.4 }),
      wlabel('Reply 1', 48, 134, 80, 14, '↩ Reply', { size: 12, color: C.primary }),
      avatar(0, 172, 36, { bg: '#dcfce7' }),
      wlabel('N2', 48, 172, 200, 17, 'Peter Simmons', { size: 14, bold: true }),
      wlabel('T2', 48, 192, 200, 14, '1h ago', { size: 12, color: C.grayLight }),
      wlabel('B2', 48, 214, 512, 20, 'Agreed, +2px padding works well.', { size: 14, lineHeight: 1.4 }),
      wlabel('Reply 2', 48, 240, 80, 14, '↩ Reply', { size: 12, color: C.primary }),
      avatar(0, 292, 36, { bg: '#fef3c7' }),
      wbox('Reply Input', 48, 292, 512, 44, { bg: C.lighter, radius: 999, borderColor: C.border }),
      wlabel('Reply PH', 68, 306, 400, 16, 'Write a reply...', { size: 13, color: C.grayLight }),
      wicon('Send', 528, 306, 18, 'mdi-send', { color: C.primary })
    ]
    out.push(group('QXListThread', 'Comment Thread', c, { subcategory: 'FList' }))
  }

  // Search results
  {
    const results = [
      ['Design systems documentation – Quant-UX Help', 'docs.quant-ux.com/design-systems', 'Learn how to create, manage and publish your design system components...'],
      ['Getting started with prototypes', 'docs.quant-ux.com/prototypes', 'Build interactive prototypes in minutes. Add transitions, logic and...'],
      ['Design tokens guide', 'blog.quant-ux.com/tokens', 'Colors, spacing and typography tokens keep your product consistent...']
    ]
    const c = [
      wbox('Search', 0, 0, 560, 44, { bg: C.white, radius: 999, borderColor: C.primary }),
      wicon('Ic', 16, 12, 20, 'mdi-magnify', { color: C.primary }),
      wlabel('Query', 48, 14, 400, 16, 'design system', { size: 14 }),
      wlabel('Meta', 0, 60, 400, 14, 'About 1,240 results (0.42 seconds)', { size: 12, color: C.grayLight }),
      ...results.flatMap((r, i) => {
        const y = 92 + i * 100
        return [
          wlabel(`T ${i}`, 0, y, 520, 20, r[0], { size: 16, color: C.primary }),
          wlabel(`U ${i}`, 0, y + 24, 400, 15, r[1], { size: 12, color: C.success }),
          wlabel(`S ${i}`, 0, y + 44, 540, 40, r[2], { size: 13, color: C.gray, lineHeight: 1.4 })
        ]
      })
    ]
    out.push(group('QXListSearchResults', 'Search Results', c, { subcategory: 'FList' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 7) E-commerce                                                       */
/* ------------------------------------------------------------------ */

function shopFile () {
  setPrefix('QXShop')
  const out = []

  // Product grid
  {
    const prod = (x, y, name, cat, price, liked) => [
      ...imagePlaceholder(`Img ${x} ${y}`, x, y, 216, 180, { radius: 8 }),
      wicon(`Heart ${x} ${y}`, x + 188, y + 8, 18, liked ? 'mdi-heart' : 'mdi-heart-outline', { color: C.danger }),
      wlabel(`Cat ${x} ${y}`, x, y + 188, 160, 13, cat, { size: 11, color: C.grayLight }),
      wlabel(`Name ${x} ${y}`, x, y + 204, 210, 18, name, { size: 14, bold: true }),
      wrating(`Rate ${x} ${y}`, x, y + 226, 90, 16, 4),
      wlabel(`Price ${x} ${y}`, x, y + 248, 100, 20, price, { size: 16, bold: true }),
      wbutton(`Add ${x} ${y}`, x + 140, y + 244, 72, 28, 'Add', { radius: 6, size: 13 })
    ]
    const cells = []
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 3; col++) {
        cells.push([col * 248, r * 296])
      }
    }
    const prods = [
      ['Runner Pro X1', 'Sneakers', '$129', true],
      ['Classic Leather', 'Boots', '$189', false],
      ['Summer Breeze', 'Sandals', '$79', false],
      ['City Loafer', 'Loafers', '$149', false],
      ['Trail Blazer', 'Hiking', '$169', true],
      ['Eco Slip-On', 'Sneakers', '$99', false]
    ]
    const c = cells.flatMap((pos, i) => prod(pos[0], pos[1], prods[i][0], prods[i][1], prods[i][2], prods[i][3]))
    out.push(group('QXShopGrid', 'Product Grid', c, { subcategory: 'GShop' }))
  }

  // Cart item
  {
    const c = [
      ...imagePlaceholder('Thumb', 0, 0, 80, 80, { radius: 8 }),
      wlabel('Name', 96, 8, 260, 18, 'Runner Pro X1', { size: 15, bold: true }),
      wlabel('Variant', 96, 30, 260, 14, 'Size 42 · Color: Black', { size: 12, color: C.grayLight }),
      wlabel('Stock', 96, 50, 260, 14, 'In stock', { size: 12, color: C.success }),
      wicon('Delete', 520, 8, 20, 'mdi-close', { color: C.grayLight }),
      wbox('Qty', 96, 44 + 24, 88, 28, { bg: C.white, radius: 6, borderColor: C.border }),
      wlabel('Qty L', 96 + 36, 44 + 32, 16, 16, '1', { size: 13, align: 'center' }),
      wicon('Minus', 96 + 8, 44 + 30, 14, 'mdi-minus', { color: C.gray }),
      wicon('Plus', 96 + 66, 44 + 30, 14, 'mdi-plus', { color: C.gray }),
      wlabel('Price', 464, 48, 88, 20, '$129.00', { size: 16, bold: true, align: 'right' })
    ]
    out.push(group('QXShopCartItem', 'Cart Item', c, { subcategory: 'GShop' }))
  }

  // Cart summary
  {
    const rows = [['Subtotal (2 items)', '$218.00'], ['Shipping', '$6.90'], ['Tax (19%)', '$41.42']]
    const c = [
      wbox('Card', 0, 0, 320, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 24, 200, 20, 'Order summary', { size: 16, bold: true }),
      ...rows.flatMap((r, i) => [
        wlabel(`RL ${i}`, 24, 60 + i * 28, 200, 16, r[0], { size: 13, color: C.gray }),
        wlabel(`RV ${i}`, 204, 60 + i * 28, 92, 16, r[1], { size: 13, align: 'right' })
      ]),
      hdivider(24, 148, 272),
      wlabel('Total L', 24, 164, 120, 20, 'Total', { size: 16, bold: true }),
      wlabel('Total V', 164, 164, 132, 20, '$266.32', { size: 18, bold: true, align: 'right' }),
      wbox('Promo', 24, 200, 180, 38, { bg: C.lighter, radius: 8, borderColor: C.border }),
      wlabel('Promo PH', 36, 211, 140, 16, 'Promo code', { size: 13, color: C.grayLight }),
      wbutton('Apply', 212, 200, 84, 38, 'Apply', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('Checkout', 24, 256, 272, 44, 'Proceed to checkout', { radius: 8, bold: true })
    ]
    out.push(group('QXShopSummary', 'Cart Summary', c, { subcategory: 'GShop' }))
  }

  // Category tiles
  {
    const cats = [['mdi-tshirt-crew', 'Fashion'], ['mdi-cellphone', 'Electronics'], ['mdi-sofa', 'Home & Living'], ['mdi-dumbbell', 'Sports']]
    const c = cats.flatMap((cat, i) => {
      const x = i * 148
      return [
        wbox(`Tile ${i}`, x, 0, 132, 132, { bg: C.white, radius: 12 }),
        wbox(`Ic Bg ${i}`, x + 42, 20, 48, 48, { bg: C.primarySoft, radius: 24, borderColor: C.primarySoft }),
        wicon(`Ic ${i}`, x + 54, 32, 24, cat[0], { color: C.primary }),
        wlabel(`L ${i}`, x, 84, 132, 16, cat[1], { size: 13, bold: true, align: 'center' }),
        wlabel(`S ${i}`, x, 102, 132, 13, '128 items', { size: 11, color: C.grayLight, align: 'center' })
      ]
    })
    out.push(group('QXShopCategories', 'Category Tiles', c, { subcategory: 'GShop' }))
  }

  // Promo banner
  {
    const c = [
      wbox('Bg', 0, 0, 720, 160, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Eyebrow', 40, 32, 300, 16, 'LIMITED TIME', { size: 12, color: '#bfdbfe', bold: true }),
      wlabel('Title', 40, 56, 420, 32, 'Summer Sale — up to 50% off', { size: 26, bold: true, color: C.white }),
      wlabel('Sub', 40, 96, 380, 16, 'Ends Jan 31. While stocks last.', { size: 13, color: '#dbeafe' }),
      wbox('Code', 520, 58, 180, 44, { bg: C.white, radius: 8, borderColor: C.white }),
      wlabel('Code L', 520, 64, 180, 16, 'USE CODE', { size: 10, color: C.grayLight, align: 'center', bold: true }),
      wlabel('Code V', 520, 80, 180, 18, 'SUMMER50', { size: 16, bold: true, align: 'center' }),
      wicon('Copy', 664, 104, 16, 'mdi-content-copy', { color: C.white })
    ]
    out.push(group('QXShopPromo', 'Promo Banner', c, { subcategory: 'GShop' }))
  }

  // Product detail
  {
    const c = [
      ...imagePlaceholder('Main', 0, 0, 360, 360, { radius: 12 }),
      ...imagePlaceholder('T1', 0, 372, 108, 88, { radius: 8 }),
      ...imagePlaceholder('T2', 120, 372, 108, 88, { radius: 8 }),
      ...imagePlaceholder('T3', 240, 372, 108, 88, { radius: 8 }),
      wbox('T Active', 240, 372, 108, 88, { radius: 8, borderColor: C.primary, borderWidth: 2 }),
      wlabel('Cat', 408, 0, 200, 14, 'Sneakers', { size: 12, color: C.grayLight }),
      wlabel('Title', 408, 20, 300, 28, 'Runner Pro X1', { size: 24, bold: true }),
      wrating('Rating', 408, 56, 110, 20, 4),
      wlabel('Reviews', 526, 60, 160, 14, '4.8 (128 reviews)', { size: 12, color: C.grayLight }),
      wlabel('Price', 408, 88, 120, 28, '$129', { size: 24, bold: true }),
      wlabel('Price Old', 492, 96, 60, 16, '$159', { size: 13, color: C.grayLight }),
      ...chip('Save', 556, 92, 'Save 19%', { bg: C.dangerSoft, color: C.danger }),
      wlabel('Size L', 408, 136, 200, 14, 'Size', { size: 12, color: C.gray, bold: true }),
      wsegment('Sizes', 408, 156, 240, 36, ['40', '41', '42', '43', '44'], '42'),
      wlabel('Color L', 408, 208, 200, 14, 'Color', { size: 12, color: C.gray, bold: true }),
      wbox('Col 1', 408, 228, 28, 28, { bg: '#111827', radius: 14, borderColor: C.primary, borderWidth: 2 }),
      wbox('Col 2', 444, 228, 28, 28, { bg: C.white, radius: 14 }),
      wbox('Col 3', 480, 228, 28, 28, { bg: '#2563eb', radius: 14 }),
      wbox('Col 4', 516, 228, 28, 28, { bg: C.danger, radius: 14 }),
      wlabel('Qty L', 408, 272, 100, 14, 'Quantity', { size: 12, color: C.gray, bold: true }),
      wbox('Qty', 408, 292, 96, 40, { bg: C.white, radius: 8, borderColor: C.border }),
      wicon('Minus', 424, 306, 16, 'mdi-minus', { color: C.gray }),
      wlabel('Qty V', 448, 304, 16, 16, '1', { size: 14, align: 'center', bold: true }),
      wicon('Plus', 472, 306, 16, 'mdi-plus', { color: C.gray }),
      wbutton('Add', 516, 292, 196, 40, 'Add to cart', { radius: 8 }),
      wbutton('Buy', 408, 344, 304, 44, 'Buy it now', { bg: C.dark, borderColor: C.dark, hoverBg: '#000000', radius: 8, bold: true }),
      hdivider(408, 404, 304),
      wlabel('Sku', 408, 420, 120, 14, 'SKU: RPX1-001', { size: 12, color: C.grayLight }),
      wlabel('Ship', 408, 440, 240, 14, 'Free shipping · 30-day returns', { size: 12, color: C.grayLight })
    ]
    out.push(group('QXShopProductDetail', 'Product Detail', c, { subcategory: 'GShop' }))
  }

  // Order card
  {
    const c = [
      wbox('Card', 0, 0, 560, 120, { bg: C.white, radius: 12 }),
      wlabel('Id', 24, 20, 160, 18, 'Order #10248', { size: 15, bold: true }),
      wlabel('Date', 24, 42, 200, 14, 'Jan 12, 2026 · 3 items', { size: 12, color: C.grayLight }),
      ...chip('Status', 460, 20, 'Paid', { bg: C.successSoft, color: C.success }),
      wlabel('Items', 24, 72, 400, 14, 'Runner Pro X1 ×1, Classic Leather ×2', { size: 13, color: C.gray }),
      wlabel('Total', 440, 66, 96, 22, '$347.00', { size: 18, bold: true, align: 'right' }),
      wlabel('Action', 452, 92, 84, 14, 'View details →', { size: 12, color: C.primary, align: 'right' })
    ]
    out.push(group('QXShopOrder', 'Order Card', c, { subcategory: 'GShop' }))
  }

  // Checkout steps
  {
    const steps = ['Cart', 'Shipping', 'Payment', 'Done']
    const c = steps.flatMap((s, i) => {
      const x = i * 240
      const active = i === 1
      const done = i === 0
      const res = [
        wbox(`Circle ${i}`, x, 8, 32, 32, {
          bg: done ? C.success : (active ? C.primary : C.white),
          radius: 16,
          borderColor: done ? C.success : (active ? C.primary : C.border),
          borderWidth: active ? 2 : 1
        }),
        wlabel(`Num ${i}`, x, 16, 32, 16, done ? '✓' : String(i + 1), {
          size: 13, bold: true, align: 'center',
          color: done || active ? C.white : C.grayLight
        }),
        wlabel(`L ${i}`, x + 40, 16, 120, 16, s, { size: 14, bold: active, color: active ? C.dark : C.gray })
      ]
      if (i < 3) {
        res.push(wbox(`Line ${i}`, x + 170, 23, 80, 2, { bg: done ? C.success : C.border, borderColor: done ? C.success : C.border }))
      }
      return res
    })
    out.push(group('QXShopSteps', 'Checkout Steps', c, { subcategory: 'GShop' }))
  }

  // Rating breakdown
  {
    const rows = [[5, 72], [4, 18], [3, 6], [2, 3], [1, 1]]
    const c = [
      wbox('Card', 0, 0, 400, 260, { bg: C.white, radius: 12 }),
      wlabel('Avg', 24, 32, 100, 44, '4.8', { size: 38, bold: true }),
      wrating('Stars', 24, 84, 110, 20, 5),
      wlabel('Count', 24, 110, 140, 14, '128 reviews', { size: 12, color: C.grayLight }),
      ...rows.flatMap((r, i) => [
        wlabel(`SL ${i}`, 160, 30 + i * 40, 14, 15, String(r[0]), { size: 12, color: C.grayLight }),
        wprogress(`SP ${i}`, 182, 35 + i * 40, 150, 8, r[1]),
        wlabel(`SV ${i}`, 344, 30 + i * 40, 36, 15, `${r[1]}%`, { size: 12, color: C.gray, align: 'right' })
      ])
    ]
    out.push(group('QXShopRating', 'Rating Breakdown', c, { subcategory: 'GShop' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 8) Mobile                                                          */
/* ------------------------------------------------------------------ */

function mobileFile () {
  setPrefix('QXMobile')
  const out = []

  // Mobile status bar
  {
    const c = [
      wlabel('Time', 20, 14, 60, 18, '9:41', { size: 14, bold: true }),
      wicon('Wifi', 296, 15, 16, 'mdi-wifi', { color: C.dark }),
      wicon('Signal', 316, 15, 16, 'mdi-signal-cellular-3', { color: C.dark }),
      wicon('Battery', 336, 15, 20, 'mdi-battery', { color: C.dark })
    ]
    out.push(group('QXMobileStatus', 'Mobile Status Bar', c, { subcategory: 'HMobile' }))
  }

  // Mobile header
  {
    const c = [
      wicon('Back', 16, 16, 24, 'mdi-arrow-left', { color: C.dark }),
      wlabel('Title', 87, 18, 200, 20, 'Product Details', { size: 16, bold: true, align: 'center' }),
      wicon('Cart', 328, 16, 24, 'mdi-cart-outline', { color: C.dark }),
      wbox('Badge', 344, 12, 14, 14, { bg: C.danger, radius: 7, borderColor: C.danger }),
      wlabel('Badge L', 344, 14, 14, 11, '2', { size: 9, color: C.white, align: 'center', bold: true })
    ]
    out.push(group('QXMobileHeader', 'Mobile Header', c, { subcategory: 'HMobile' }))
  }

  // Mobile tab bar
  {
    const tabs = [['mdi-home', 'Home', true], ['mdi-magnify', 'Search', false], ['mdi-heart-outline', 'Saved', false], ['mdi-account', 'Profile', false]]
    const c = [
      hdivider(0, 0, 375),
      ...tabs.flatMap((t, i) => {
        const x = 12 + i * 94
        return [
          wicon(`Ic ${i}`, x + 26, 16, 24, t[0], { color: t[2] ? C.primary : C.grayLight }),
          wlabel(`L ${i}`, x, 48, 76, 13, t[1], { size: 11, color: t[2] ? C.primary : C.grayLight, align: 'center', bold: t[2] })
        ]
      })
    ]
    out.push(group('QXMobileTabBar', 'Mobile Tab Bar', c, { subcategory: 'HMobile' }))
  }

  // Mobile list
  {
    const rows = [
      ['Anna Müller', 'Product Designer', '#dbeafe'],
      ['Peter Simmons', 'Developer', '#dcfce7'],
      ['Julia Chen', 'Researcher', '#fef3c7'],
      ['Maria Silva', 'Marketing', '#fce7f3'],
      ['Klaus Huber', 'Owner', '#e0e7ff']
    ]
    const c = [
      wbox('Search', 16, 0, 343, 40, { bg: C.light, radius: 10, borderColor: C.light }),
      wicon('Search Ic', 28, 12, 18, 'mdi-magnify', { color: C.grayLight }),
      wlabel('Search PH', 54, 12, 240, 16, 'Search contacts', { size: 13, color: C.grayLight }),
      wlabel('Section', 16, 60, 200, 14, 'RECENTS', { size: 11, color: C.grayLight, bold: true }),
      ...rows.flatMap((r, i) => {
        const y = 84 + i * 68
        return [
          avatar(16, y, 44, { bg: r[2] }),
          wlabel(`N ${i}`, 72, y + 4, 200, 17, r[0], { size: 15, bold: true }),
          wlabel(`R ${i}`, 72, y + 24, 220, 14, r[1], { size: 12, color: C.grayLight }),
          wicon(`Chev ${i}`, 336, y + 14, 18, 'mdi-chevron-right', { color: C.grayLight }),
          i < 4 ? hdivider(72, y + 56, 280) : null
        ].filter(Boolean)
      })
    ]
    out.push(group('QXMobileList', 'Mobile List', c, { subcategory: 'HMobile' }))
  }

  // Mobile card stack
  {
    const card = (y, title, text, tag, tagColor, tagBg) => [
      wbox(`Card ${y}`, 16, y, 343, 180, { bg: C.white, radius: 12 }),
      ...imagePlaceholder(`Img ${y}`, 16, y, 343, 96, { radius: 0, noIcon: true }),
      wlabel(`Title ${y}`, 32, y + 108, 240, 18, title, { size: 15, bold: true }),
      wlabel(`Text ${y}`, 32, y + 130, 300, 15, text, { size: 12, color: C.gray, lineHeight: 1.3 }),
      ...chip(`Tag ${y}`, 244, y + 148, tag, { bg: tagBg, color: tagColor, h: 20 })
    ]
    const c = [
      ...card(0, 'Design review: Q1 goals', 'Anna Müller · 3 min read', 'Design', C.primary, C.primarySoft),
      ...card(196, 'Sprint 25 retrospective', 'Team · 5 min read', 'Team', C.success, C.successSoft)
    ]
    out.push(group('QXMobileCards', 'Mobile Article Cards', c, { subcategory: 'HMobile' }))
  }

  // Mobile profile
  {
    const c = [
      wbox('Cover', 0, 0, 375, 140, { bg: C.primarySoft, borderColor: C.primarySoft, radius: 0 }),
      avatar(143, 96, 88, { bg: C.white }),
      wicon('Avatar Ic', 167, 120, 40, 'mdi-account', { color: C.grayLight }),
      wicon('Edit', 328, 16, 20, 'mdi-pencil', { color: C.dark }),
      wlabel('Name', 0, 196, 375, 22, 'Anna Müller', { size: 20, bold: true, align: 'center' }),
      wlabel('Handle', 0, 222, 375, 16, '@annamueller · Product Designer', { size: 13, color: C.gray, align: 'center' }),
      wlabel('Bio', 48, 248, 280, 36, 'Designing intuitive products. Coffee enthusiast. Based in Berlin.', { size: 13, color: C.gray, align: 'center', lineHeight: 1.4 }),
      wlabel('SV1', 80, 296, 60, 20, '142', { size: 17, bold: true, align: 'center' }),
      wlabel('SL1', 80, 318, 60, 13, 'Posts', { size: 11, color: C.grayLight, align: 'center' }),
      wlabel('SV2', 158, 296, 60, 20, '8.4k', { size: 17, bold: true, align: 'center' }),
      wlabel('SL2', 158, 318, 60, 13, 'Followers', { size: 11, color: C.grayLight, align: 'center' }),
      wlabel('SV3', 236, 296, 60, 20, '312', { size: 17, bold: true, align: 'center' }),
      wlabel('SL3', 236, 318, 60, 13, 'Following', { size: 11, color: C.grayLight, align: 'center' }),
      wbutton('Follow', 48, 344, 155, 40, 'Follow', { radius: 999, bold: true }),
      wbutton('Message', 172 + 0, 344, 155, 40, 'Message', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 999 }),
      ...imagePlaceholder('G1', 16, 400, 111, 111, { radius: 8 }),
      ...imagePlaceholder('G2', 132, 400, 111, 111, { radius: 8 }),
      ...imagePlaceholder('G3', 248, 400, 111, 111, { radius: 8 })
    ]
    out.push(group('QXMobileProfile', 'Mobile Profile', c, { subcategory: 'HMobile' }))
  }

  // Mobile bottom sheet
  {
    const options = [
      ['mdi-camera', 'Take photo'],
      ['mdi-image', 'Choose from gallery'],
      ['mdi-file-document-outline', 'Attach document'],
      ['mdi-link', 'Add link']
    ]
    const c = [
      wbox('Sheet', 0, 0, 375, 340, { bg: C.white, radius: 16, borderColor: C.border }),
      wbox('Grabber', 160, 12, 56, 4, { bg: C.border, borderColor: C.border, radius: 2 }),
      wlabel('Title', 24, 32, 280, 20, 'Add attachment', { size: 16, bold: true }),
      wicon('Close', 336, 32, 20, 'mdi-close', { color: C.grayLight }),
      ...options.flatMap((o, i) => {
        const y = 72 + i * 56
        return [
          wbox(`Row ${i}`, 16, y, 343, 48, { bg: C.lighter, radius: 10, borderColor: C.lighter }),
          wicon(`Ic ${i}`, 32, y + 14, 20, o[0], { color: C.primary }),
          wlabel(`L ${i}`, 64, y + 15, 240, 17, o[1], { size: 14 })
        ]
      }),
      wbutton('Cancel', 16, 288, 343, 40, 'Cancel', { bg: C.light, color: C.gray, borderColor: C.light, radius: 10 })
    ]
    out.push(group('QXMobileSheet', 'Mobile Bottom Sheet', c, { subcategory: 'HMobile' }))
  }

  // Onboarding
  {
    const c = [
      wlabel('Skip', 304, 16, 56, 16, 'Skip', { size: 14, color: C.gray, align: 'right' }),
      wbox('Illu Bg', 88, 80, 200, 200, { bg: C.primarySoft, radius: 100, borderColor: C.primarySoft }),
      wicon('Illu', 148, 140, 80, 'mdi-vector-square', { color: C.primary, factor: 2 }),
      wlabel('Title', 40, 320, 296, 26, 'Design with ease', { size: 22, bold: true, align: 'center' }),
      wlabel('Text', 48, 356, 280, 44, 'Create beautiful prototypes in minutes with smart components and templates.', { size: 14, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbox('D1', 168, 424, 8, 8, { bg: C.primary, radius: 4, borderColor: C.primary }),
      wbox('D2', 184, 424, 8, 8, { bg: C.border, radius: 4, borderColor: C.border }),
      wbox('D3', 200, 424, 8, 8, { bg: C.border, radius: 4, borderColor: C.border }),
      wbutton('Next', 48, 460, 280, 48, 'Get started', { radius: 999, bold: true })
    ]
    out.push(group('QXMobileOnboarding', 'Onboarding Screen', c, { subcategory: 'HMobile' }))
  }

  return out
}

/* ------------------------------------------------------------------ */
/* 9) Chart cards (category: Charts)                                   */
/* ------------------------------------------------------------------ */

function chartFile () {
  setPrefix('QXChart')
  const out = []
  const card = (id, name, title, build) => {
    const inner = build(24, 84)
    const c = [
      wbox('Card', 0, 0, 360, 280, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 240, 20, title, { size: 15, bold: true }),
      ...inner
    ]
    out.push(group(id, name, c, { category: 'Charts', subcategory: 'QCards' }))
  }

  card('QXChartBar', 'Chart Card', 'Weekly revenue', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['4'], ['6'], ['5'], ['8'], ['7'], ['9'], ['12']])
  ])

  card('QXChartBar2', 'Chart Card 2 Series', 'Signups vs upgrades', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['4', '1'], ['6', '2'], ['5', '2'], ['8', '3'], ['7', '3'], ['9', '4'], ['12', '5']])
  ])

  card('QXChartLine', 'Line Chart Card', 'Active users', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['12'], ['18'], ['15'], ['22'], ['28'], ['25'], ['34']], { line: true })
  ])

  card('QXChartHorizontal', 'Horizontal Chart Card', 'Top pages', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['/home', '840'], ['/pricing', '520'], ['/docs', '380'], ['/blog', '260'], ['/about', '140']], { horizontal: true })
  ])

  card('QXChartPie', 'Pie Chart Card', 'Device split', (x, y) => [
    wpie('Chart', x + 60, y, 160, 160, [45, 30, 25]),
    dot(x + 20, y + 16, C.primary), wlabel('L1', x + 34, y + 12, 80, 14, 'Desktop', { size: 11 }),
    dot(x + 20, y + 40, C.success), wlabel('L2', x + 34, y + 36, 80, 14, 'Mobile', { size: 11 }),
    dot(x + 20, y + 64, C.warning), wlabel('L3', x + 34, y + 60, 80, 14, 'Tablet', { size: 11 })
  ])

  card('QXChartRing', 'Ring Chart Card', 'Goal completion', (x, y) => [
    wring('Chart', x + 60, y, 160, 160, 68),
    wlabel('Value', x + 116, y + 66, 48, 26, '68%', { size: 20, bold: true, align: 'center' }),
    wlabel('Sub', x, y + 166, 312, 14, '1,020 of 1,500 sessions', { size: 11, color: C.grayLight, align: 'center' })
  ])

  card('QXChartLegend', 'Chart Card Legend', 'Revenue by region', (x, y) => [
    wbar('Chart', x, y, 312, 120, [['4', '2'], ['6', '3'], ['5', '2'], ['8', '4'], ['7', '3']]),
    ...[['#2563eb', 'EMEA'], ['#93c5fd', 'AMER'], ['#10b981', 'APAC']].flatMap((l, i) => [
      dot(x + 60 + i * 80, y + 136, l[0]),
      wlabel(`L ${i}`, x + 74 + i * 80, y + 132, 60, 14, l[1], { size: 11, color: C.gray })
    ])
  ])

  card('QXChartSpark', 'Mini Chart Card', 'Today’s visitors', (x, y) => [
    wlabel('Value', x, y, 200, 34, '1,284', { size: 28, bold: true }),
    ...chip('Delta', x, y + 42, '▲ 12%'),
    wbar('Chart', x, y + 76, 312, 84, [['2'], ['5'], ['3'], ['7'], ['4'], ['8'], ['6'], ['9'], ['7'], ['11']], { line: true })
  ])

  return out
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const files = [
  ['composite/qux_navigation.json', navFile()],
  ['composite/qux_hero.json', heroFile()],
  ['composite/qux_cards.json', cardFile()],
  ['composite/qux_forms.json', formFile()],
  ['composite/qux_dashboard.json', dashFile()],
  ['composite/qux_lists.json', listFile()],
  ['composite/qux_ecommerce.json', shopFile()],
  ['composite/qux_mobile.json', mobileFile()],
  ['charts/qux_charts.json', chartFile()]
]

let total = 0
for (const [rel, themes] of files) {
  const path = join(THEMES, rel)
  writeFileSync(path, JSON.stringify(themes, null, 2) + '\n')
  total += themes.length
  console.log(`${rel}: ${themes.length} prefabs`)
}
console.log(`Total: ${total} prefabs`)
