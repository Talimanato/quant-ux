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
    id: nid(), type: '评分', _type: 'Widget', name, x, y, w, h, z: null,
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
      wlabel('Nav 1', 300, 22, 56, 20, '首页', { size: 14, bold: true, color: C.primary }),
      wlabel('Nav 2', 364, 22, 64, 20, '功能'),
      wlabel('Nav 3', 436, 22, 64, 20, '定价'),
      wlabel('Nav 4', 508, 22, 56, 20, '关于我们'),
      wlabel('Login Link', 872, 22, 48, 20, '登录', { color: C.primary }),
      wbutton('Signup', 928, 14, 112, 36, '注册', { radius: 999 })
    ]
    out.push(group('QXNavTopBar', '顶部导航栏', c, { subcategory: 'ANav' }))
  }

  // TopBar with icons
  {
    const c = [
      wicon('Menu', 16, 20, 24, 'mdi-menu', { color: C.dark }),
      wlabel('Brand', 56, 22, 140, 22, '仪表盘', { size: 17, bold: true }),
      wlabel('Nav Active', 300, 26, 56, 20, '首页', { size: 14, bold: true, color: C.primary }),
      wbox('Active Indicator', 300, 46, 56, 2, { bg: C.primary, borderColor: C.primary }),
      wlabel('Nav 2', 364, 26, 72, 20, '数据分析'),
      wlabel('Nav 3', 446, 26, 72, 20, '客户'),
      wlabel('Nav 4', 528, 26, 56, 20, '报表'),
      vdivider(940, 18, 28),
      wicon('搜索', 960, 20, 22, 'mdi-magnify'),
      wicon('Bell', 996, 20, 22, 'mdi-bell'),
      avatar(1036, 16, 28),
      wbox('Badge', 1052, 16, 8, 8, { bg: C.danger, radius: 4, borderColor: C.danger })
    ]
    out.push(group('QXNavTopBarIcons', '顶栏（图标）', c, { subcategory: 'ANav' }))
  }

  // TopBar with search
  {
    const c = [
      wicon('Menu', 16, 24, 24, 'mdi-menu', { color: C.dark }),
      wlabel('Brand', 56, 26, 120, 22, '工作区', { size: 17, bold: true }),
      wbox('SearchBar', 240, 18, 420, 36, { bg: C.lighter, radius: 999, borderColor: C.border }),
      wicon('搜索', 260, 27, 18, 'mdi-magnify'),
      wlabel('Search Placeholder', 288, 28, 300, 16, '搜索任何内容...', { size: 13, color: C.grayLight }),
      wicon('Help', 708, 24, 22, 'mdi-help-circle'),
      wicon('Apps', 744, 24, 22, 'mdi-apps'),
      wbutton('Invite', 880, 18, 96, 36, '+ 邀请', { radius: 999 }),
      avatar(1000, 18, 32)
    ]
    out.push(group('QXNavTopBarSearch', '顶栏（搜索）', c, { subcategory: 'ANav' }))
  }

  // Sidebar Light
  {
    const c = [
      ...logoMark(20, 24, 32, 'Q'),
      wlabel('Brand', 64, 28, 120, 20, 'Quant-UX', { size: 16, bold: true }),
      wlabel('Section', 20, 88, 120, 14, '菜单', { size: 11, color: C.grayLight, bold: true }),
      wicon('I1', 20, 116, 20, 'mdi-view-dashboard', { color: C.primary }),
      wbox('Item Active', 8, 110, 224, 36, { bg: C.primarySoft, radius: 8, borderColor: C.primarySoft }),
      wbox('Indicator', 8, 110, 3, 36, { bg: C.primary, borderColor: C.primary, radius: 2 }),
      wicon('I1b', 20, 118, 20, 'mdi-view-dashboard', { color: C.primary }),
      wlabel('L1', 52, 121, 100, 18, '仪表盘', { size: 14, bold: true, color: C.primary }),
      wicon('I2', 20, 162, 20, 'mdi-chart-bar'),
      wlabel('L2', 52, 165, 100, 18, '数据分析'),
      wicon('I3', 20, 206, 20, 'mdi-account-group'),
      wlabel('L3', 52, 209, 100, 18, '团队'),
      wicon('I4', 20, 250, 20, 'mdi-file-document-outline'),
      wlabel('L4', 52, 253, 100, 18, '文档'),
      hdivider(20, 296, 200),
      wlabel('Section 2', 20, 316, 120, 14, '项目', { size: 11, color: C.grayLight, bold: true }),
      wicon('I5', 20, 344, 20, 'mdi-folder'),
      wlabel('L5', 52, 347, 100, 18, '市场'),
      wicon('I6', 20, 388, 20, 'mdi-folder'),
      wlabel('L6', 52, 391, 100, 18, '开发'),
      wicon('I7', 20, 432, 20, 'mdi-cog'),
      wlabel('L7', 52, 435, 100, 18, '设置'),
      wbox('UserBox', 12, 560, 216, 56, { bg: C.lighter, radius: 10, borderColor: C.border }),
      avatar(24, 572, 32),
      wlabel('User', 66, 572, 120, 16, 'Klaus Huber', { size: 13, bold: true }),
      wlabel('User Mail', 66, 590, 140, 14, 'klaus@quant-ux.com', { size: 11, color: C.grayLight }),
      wicon('Logout', 204, 578, 18, 'mdi-logout')
    ]
    out.push(group('QXNavSidebar', '侧边栏', c, { subcategory: 'ANav' }))
  }

  // Sidebar Dark
  {
    const c = [
      ...logoMark(20, 24, 32, 'Q'),
      wlabel('Brand', 64, 28, 120, 20, 'Quant-UX', { size: 16, bold: true, color: C.white }),
      wbox('Item Active', 8, 84, 224, 36, { bg: C.sidebarHover, radius: 8, borderColor: C.sidebarHover }),
      wbox('Indicator', 8, 84, 3, 36, { bg: C.primary, borderColor: C.primary, radius: 2 }),
      wicon('I1', 20, 92, 20, 'mdi-view-dashboard', { color: C.white }),
      wlabel('L1', 52, 95, 100, 18, '仪表盘', { size: 14, bold: true, color: C.white }),
      wicon('I2', 20, 136, 20, 'mdi-chart-bar', { color: C.sidebarText }),
      wlabel('L2', 52, 139, 100, 18, '数据分析', { color: C.sidebarText }),
      wicon('I3', 20, 180, 20, 'mdi-account-group', { color: C.sidebarText }),
      wlabel('L3', 52, 183, 100, 18, '团队', { color: C.sidebarText }),
      wicon('I4', 20, 224, 20, 'mdi-file-document-outline', { color: C.sidebarText }),
      wlabel('L4', 52, 227, 100, 18, '文档', { color: C.sidebarText }),
      wicon('I5', 20, 268, 20, 'mdi-calendar', { color: C.sidebarText }),
      wlabel('L5', 52, 271, 100, 18, '日历', { color: C.sidebarText }),
      wicon('I6', 20, 312, 20, 'mdi-cog', { color: C.sidebarText }),
      wlabel('L6', 52, 315, 100, 18, '设置', { color: C.sidebarText }),
      wbox('Upgrade Card', 16, 400, 208, 120, { bg: C.sidebarHover, radius: 12, borderColor: C.sidebarHover }),
      wlabel('Upgrade Title', 32, 416, 176, 18, '升级到 Pro', { size: 14, bold: true, color: C.white }),
      wlabel('Upgrade Text', 32, 438, 176, 32, '解锁分析与无限项目', { size: 12, color: C.sidebarText, lineHeight: 1.3 }),
      wbutton('Upgrade Btn', 32, 478, 96, 30, '升级', { radius: 6 }),
      avatar(20, 568, 32),
      wlabel('User', 62, 568, 120, 16, 'Klaus Huber', { size: 13, bold: true, color: C.white }),
      wlabel('Plan', 62, 586, 140, 14, '免费方案', { size: 11, color: C.sidebarText }),
      wicon('Logout', 204, 574, 18, 'mdi-logout', { color: C.sidebarText })
    ]
    const sidebar = wbox('SidebarBg', 0, 0, 240, 640, { bg: C.sidebar, borderColor: C.sidebar, radius: 0 })
    out.push(group('QXNavSidebarDark', '深色侧边栏', [sidebar, ...c], { subcategory: 'ANav' }))
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
    out.push(group('QXNavSidebarMini', '迷你侧边栏', c, { subcategory: 'ANav' }))
  }

  // Breadcrumb bar
  {
    const c = [
      wlabel('B1', 0, 10, 48, 18, '首页', { size: 13, color: C.primary }),
      wicon('Chev1', 52, 11, 14, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B2', 72, 10, 72, 18, '项目', { size: 13, color: C.primary }),
      wicon('Chev2', 148, 11, 14, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B3', 168, 10, 80, 18, '网站改版', { size: 13, bold: true }),
      wicon('Refresh', 920, 8, 20, 'mdi-refresh'),
      wbutton('分享', 952, 0, 88, 36, '分享', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light })
    ]
    out.push(group('QXNavBreadcrumb', '面包屑导航', c, { subcategory: 'ANav' }))
  }

  // Tab bar underline
  {
    const c = [
      wlabel('T1', 0, 12, 64, 20, '概览', { size: 14, bold: true, color: C.primary }),
      wbox('Tab Indicator', 0, 44, 64, 2, { bg: C.primary, borderColor: C.primary }),
      wlabel('T2', 80, 12, 80, 20, '统计', { color: C.gray }),
      wlabel('T3', 176, 12, 72, 20, '动态', { color: C.gray }),
      wlabel('T4', 260, 12, 56, 20, '文件', { color: C.gray }),
      wlabel('T5', 328, 12, 64, 20, '设置', { color: C.gray }),
      wbutton('添加', 936, 0, 104, 36, '+ 新建任务', { radius: 6 })
    ]
    out.push(group('QXNavTabs', '标签导航栏', c, { subcategory: 'ANav' }))
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
      wlabel('Tagline', 0, 44, 220, 36, '开源设计与研究平台。', { size: 13, color: C.gray, lineHeight: 1.4 }),
      ...mkLinks(280, '产品', ['功能', '定价', '更新日志', '路线图']),
      ...mkLinks(440, '资源', ['文档', '教程', '博客', '支持']),
      ...mkLinks(600, '公司', ['关于我们', '招聘', '联系我们', '法律条款']),
      ...mkLinks(760, '订阅', ['邮件订阅', 'YouTube', 'Twitter', 'GitHub']),
      hdivider(0, 188, 920),
      wlabel('Copy', 0, 208, 320, 16, '© 2026 Quant-UX 保留所有权利。', { size: 12, color: C.grayLight }),
      wlabel('Social 1', 860, 206, 24, 18, 'GitHub', { size: 12, color: C.gray })
    ]
    out.push(group('QXNavFooter', '页脚', c, { subcategory: 'ANav' }))
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
      ...chip('Badge', 470, 24, '✦ 新功能：AI 设计生成'),
      wlabel('H1', 220, 68, 600, 48, '更快地设计、测试与迭代', { size: 40, bold: true, align: 'center' }),
      wlabel('Sub', 260, 128, 520, 48, 'Quant-UX 是面向高效交付团队的开源设计与研究平台。', { size: 16, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbutton('CTA', 400, 204, 140, 44, '免费开始', { radius: 8 }),
      wbutton('CTA 2', 552, 204, 140, 44, '查看演示', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, hoverBorder: C.grayLight }),
      avatar(428, 268, 28),
      avatar(448, 268, 28, { bg: '#fef3c7' }),
      avatar(468, 268, 28, { bg: '#dcfce7' }),
      wlabel('Users', 504, 276, 160, 16, '深受 10,000+ 设计师喜爱', { size: 13, color: C.gray }),
      hdivider(300, 324, 440),
      wlabel('Trusted', 420, 344, 200, 14, '受到以下团队信赖', { size: 11, color: C.grayLight, align: 'center', bold: true }),
      ...['Google', 'Spotify', 'Airbnb', 'Uber', 'Netflix'].map((b, i) => wlabel(`Brand ${i}`, 250 + i * 112, 372, 96, 20, b, { size: 15, color: C.grayLight, align: 'center', bold: true }))
    ]
    out.push(group('QXHeroCentered', '居中主视觉', c, { subcategory: 'BHero' }))
  }

  // Hero left text + image
  {
    const c = [
      ...chip('Eyebrow', 0, 20, 'v4.0 来了'),
      wlabel('H1', 0, 60, 460, 88, '接近真实产品的原型体验', { size: 32, bold: true, lineHeight: 1.25 }),
      wlabel('Sub', 0, 164, 440, 48, '创建交互原型、运行可用性测试、收集反馈 — 尽在一处。', { size: 15, color: C.gray, lineHeight: 1.5 }),
      wbutton('CTA', 0, 232, 140, 44, '开始使用', { radius: 8 }),
      wbutton('CTA 2', 156, 232, 120, 44, '了解更多', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light }),
      hdivider(0, 312, 440),
      wlabel('S1V', 0, 332, 120, 26, '10k+', { size: 24, bold: true }),
      wlabel('S1L', 0, 360, 120, 14, '设计师', { size: 12, color: C.gray }),
      wlabel('S2V', 140, 332, 120, 26, '45k', { size: 24, bold: true }),
      wlabel('S2L', 140, 360, 120, 14, '原型', { size: 12, color: C.gray }),
      wlabel('S3V', 280, 332, 120, 26, '99.9%', { size: 24, bold: true }),
      wlabel('S3L', 280, 360, 140, 14, '可用率', { size: 12, color: C.gray }),
      ...imagePlaceholder('Hero Image', 520, 40, 520, 340, { radius: 12 }),
      ...chip('Float Card', 840, 300, '✓ 测试提速 38%')
    ]
    out.push(group('QXHeroLeft', '图文主视觉', c, { subcategory: 'BHero' }))
  }

  // Hero split dark
  {
    const c = [
      wbox('Bg', 0, 0, 1040, 400, { bg: C.sidebar, borderColor: C.sidebar }),
      wlabel('Eyebrow', 64, 96, 200, 16, '抢先体验', { size: 12, color: '#93c5fd', bold: true }),
      wlabel('H1', 64, 124, 420, 96, '设计研究的未来', { size: 34, bold: true, color: C.white, lineHeight: 1.25 }),
      wlabel('Sub', 64, 236, 400, 48, '加入等候名单，抢先体验协作测试。', { size: 15, color: C.sidebarText, lineHeight: 1.5 }),
      wbutton('CTA', 64, 304, 160, 44, '加入等候名单', { radius: 8 }),
      wlabel('Note', 240, 316, 200, 16, '无需信用卡', { size: 12, color: C.grayLight }),
      wbox('Form Card', 580, 60, 396, 280, { bg: C.white, radius: 16, borderColor: C.white }),
      wlabel('Form Title', 612, 92, 200, 22, '创建账号', { size: 18, bold: true }),
      wlabel('Form Sub', 612, 118, 300, 16, '开始 14 天免费试用。', { size: 13, color: C.gray }),
      wlabel('F1L', 612, 152, 100, 14, '邮箱', { size: 12, color: C.gray }),
      wtext('F1', 612, 170, 332, 38, 'you@company.com'),
      wlabel('F2L', 612, 220, 100, 14, '密码', { size: 12, color: C.gray }),
      wtext('F2', 612, 238, 332, 38, '••••••••', { type: '密码', cleartext: true }),
      wbutton('Form CTA', 612, 290, 332, 40, '创建账号', { radius: 8 })
    ]
    out.push(group('QXHeroDark', '深色表单主视觉', c, { subcategory: 'BHero' }))
  }

  // Feature row 3
  {
    const card = (x, icon, title, text) => [
      wbox(`Card ${x}`, x, 0, 320, 240, { bg: C.white, radius: 12 }),
      wbox(`Icon Bg ${x}`, x + 24, 24, 48, 48, { bg: C.primarySoft, radius: 12, borderColor: C.primarySoft }),
      wicon(`Icon ${x}`, x + 36, 36, 24, icon, { color: C.primary }),
      wlabel(`Title ${x}`, x + 24, 92, 260, 20, title, { size: 16, bold: true }),
      wlabel(`Text ${x}`, x + 24, 120, 272, 64, text, { size: 13, color: C.gray, lineHeight: 1.5 }),
      wlabel(`Link ${x}`, x + 24, 196, 160, 16, '了解更多 →', { size: 13, color: C.primary })
    ]
    const c = [
      ...card(0, 'mdi-vector-square', '设计', '丰富控件与智能吸附，随手绘制页面。'),
      ...card(360, 'mdi-cellphone', '测试', '运行主持型与非主持型可用性测试。'),
      ...card(720, 'mdi-chart-bar', '分析', '开箱即用的热力图、漏斗和任务分析。')
    ]
    out.push(group('QXHeroFeatures3', '功能一行', c, { subcategory: 'BHero' }))
  }

  // Feature split with bullets
  {
    const c = [
      ...imagePlaceholder('Img', 0, 0, 440, 320, { radius: 12 }),
      wlabel('Title', 500, 16, 400, 32, '全部功能齐备', { size: 24, bold: true }),
      wlabel('Sub', 500, 56, 420, 44, '无需插件和附加组件，团队所需功能全部内置于核心。', { size: 14, color: C.gray, lineHeight: 1.5 }),
      ...['无限原型', '协作编辑', '可用性测试套件', '分析与热力图'].flatMap((t, i) => [
        wicon(`Check ${i}`, 500, 116 + i * 44, 22, 'mdi-check-circle', { color: C.success }),
        wlabel(`Bullet ${i}`, 534, 119 + i * 44, 300, 18, t, { size: 14 })
      ]),
      wbutton('CTA', 500, 300, 140, 40, '查看全部功能', { radius: 8 })
    ]
    out.push(group('QXHeroFeatureSplit', '功能分栏', c, { subcategory: 'BHero' }))
  }

  // CTA banner
  {
    const c = [
      wbox('Bg', 0, 0, 1040, 180, { bg: C.primarySoft, radius: 16, borderColor: C.primaryBorder }),
      wlabel('Title', 48, 44, 520, 32, '准备好开始设计了吗？', { size: 24, bold: true }),
      wlabel('Sub', 48, 84, 520, 20, '个人免费，无需信用卡。', { size: 14, color: C.gray }),
      wbutton('CTA', 760, 68, 220, 44, '免费创建账号', { radius: 8 })
    ]
    out.push(group('QXHeroCTA', '行动号召横幅', c, { subcategory: 'BHero' }))
  }

  // Page header
  {
    const c = [
      wlabel('B1', 0, 8, 48, 16, '首页', { size: 12, color: C.primary }),
      wicon('Chev', 52, 9, 12, 'mdi-chevron-right', { color: C.grayLight }),
      wlabel('B2', 70, 8, 120, 16, '团队管理', { size: 12, color: C.gray }),
      wlabel('Title', 0, 32, 400, 30, '团队成员', { size: 22, bold: true }),
      wlabel('Sub', 0, 68, 480, 18, '管理谁可以访问你的工作区和原型。', { size: 13, color: C.gray }),
      wbutton('Secondary', 856, 40, 84, 36, '导出', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light }),
      wbutton('Primary', 952, 40, 88, 36, '+ 邀请'),
      hdivider(0, 96, 1040)
    ]
    out.push(group('QXHeroPageHeader', '页头', c, { subcategory: 'BHero' }))
  }

  // Stats row
  {
    const stat = (x, value, label) => [
      wlabel(`V ${x}`, x, 0, 220, 34, value, { size: 30, bold: true }),
      wlabel(`L ${x}`, x, 40, 220, 18, label, { size: 13, color: C.gray }),
      x < 780 ? vdivider(x + 244, 0, 52) : null
    ].filter(Boolean)
    const c = [
      ...stat(0, '24.5k', '月访问量'),
      ...stat(260, '3,204', '活跃用户'),
      ...stat(520, '4.8%', '转化率'),
      ...stat(780, '92%', '留存率')
    ]
    out.push(group('QXHeroStats', '数据一行', c, { subcategory: 'BHero' }))
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
      wlabel('Tier', 24, 24, 200, 22, '专业版', { size: 18, bold: true }),
      wlabel('Tier Desc', 24, 50, 240, 18, '适合成长中的设计团队', { size: 13, color: C.gray }),
      wlabel('Price', 24, 84, 140, 36, '$12', { size: 32, bold: true }),
      wlabel('Per', 100, 104, 120, 16, '/ 用户 / 月', { size: 12, color: C.grayLight }),
      hdivider(24, 136, 252),
      ...['无限原型', '可用性测试', '分析套件', '优先支持'].flatMap((t, i) => [
        wicon(`Check ${i}`, 24, 156 + i * 32, 20, 'mdi-check', { color: C.success }),
        wlabel(`F ${i}`, 52, 159 + i * 32, 220, 18, t, { size: 13 })
      ]),
      wbutton('CTA', 24, 340, 252, 44, '选择专业版', { radius: 8 })
    ]
    out.push(group('QXCardPricing', '定价卡片', c, { subcategory: 'CCard' }))
  }

  // Pricing table (3 cards)
  {
    const tier = (x, name, price, features, highlight) => {
      const border = highlight ? C.primary : C.border
      const c = [
        wbox(`Card ${name}`, x, highlight ? 0 : 24, 300, highlight ? 436 : 388, { bg: C.white, radius: 12, borderColor: border, borderWidth: highlight ? 2 : 1 }),
        wlabel(`Name ${name}`, x + 24, (highlight ? 0 : 24) + 24, 200, 22, name, { size: 18, bold: true }),
        wlabel(`Price ${name}`, x + 24, (highlight ? 0 : 24) + 56, 160, 34, price, { size: 30, bold: true }),
        wlabel(`Per ${name}`, x + 24, (highlight ? 0 : 24) + 92, 200, 16, '/ 月', { size: 12, color: C.grayLight }),
        hdivider(x + 24, (highlight ? 0 : 24) + 120, 252),
        ...features.flatMap((t, i) => [
          wicon(`C ${name} ${i}`, x + 24, (highlight ? 0 : 24) + 140 + i * 30, 18, 'mdi-check', { color: C.success }),
          wlabel(`F ${name} ${i}`, x + 50, (highlight ? 0 : 24) + 142 + i * 30, 220, 17, t, { size: 13 })
        ]),
        wbutton(`CTA ${name}`, x + 24, (highlight ? 0 : 24) + 308, 252, 40, `选择${name}`, {
          radius: 8,
          bg: highlight ? C.primary : C.white,
          color: highlight ? C.white : C.dark,
          borderColor: highlight ? C.primary : C.border,
          hoverBg: highlight ? C.primaryHover : C.light
        })
      ]
      if (highlight) {
        c.push(...chip(`Badge ${name}`, x + 204, 12, '热门'))
      }
      return c
    }
    const c = [
      ...tier(0, '基础版', '$0', ['3 个原型', '1 位用户', '社区支持']),
      ...tier(320, '专业版', '$12', ['无限原型', '5 位用户', '可用性测试', '数据分析'], true),
      ...tier(640, '企业版', '$49', ['包含 Pro 全部功能', 'SSO 与审计日志', '专属支持', '定制 SLA'])
    ]
    out.push(group('QXCardPricingTable', '定价方案表', c, { subcategory: 'CCard' }))
  }

  // Stat card
  {
    const c = [
      wbox('Card', 0, 0, 240, 120, { bg: C.white, radius: 12 }),
      wlabel('Label', 16, 16, 140, 14, '月收入', { size: 12, color: C.gray }),
      wlabel('Value', 16, 36, 160, 30, '$48,210', { size: 24, bold: true }),
      ...chip('Delta', 16, 76, '▲ 12.5%', { bg: C.successSoft, color: C.success }),
      wlabel('Since', 92, 79, 120, 14, '较上月', { size: 11, color: C.grayLight }),
      wicon('Icon', 196, 16, 24, 'mdi-currency-usd', { color: C.primaryLight || C.primary })
    ]
    out.push(group('QXCardStat', '统计卡片', c, { subcategory: 'CCard' }))
  }

  // Product card
  {
    const c = [
      wbox('Card', 0, 0, 240, 360, { bg: C.white, radius: 12 }),
      ...imagePlaceholder('Image', 12, 12, 216, 200, { radius: 8 }),
      wicon('Wish', 204, 24, 20, 'mdi-heart-outline', { color: C.danger }),
      wlabel('分类', 16, 226, 120, 14, '运动鞋', { size: 11, color: C.grayLight }),
      wlabel('Title', 16, 244, 208, 20, 'Runner Pro X1', { size: 15, bold: true }),
      wrating('评分', 16, 270, 100, 20, 4),
      wlabel('Reviews', 124, 274, 100, 14, '（128）', { size: 11, color: C.grayLight }),
      wlabel('Price', 16, 300, 100, 22, '$129', { size: 18, bold: true }),
      wbutton('添加', 152, 296, 72, 32, '添加', { radius: 6 })
    ]
    out.push(group('QXCardProduct', '商品卡片', c, { subcategory: 'CCard' }))
  }

  // Profile card
  {
    const c = [
      wbox('Card', 0, 0, 300, 340, { bg: C.white, radius: 12 }),
      wbox('Cover', 0, 0, 300, 80, { bg: C.primarySoft, borderColor: C.primarySoft, radius: 0 }),
      avatar(116, 44, 68, { bg: C.white }),
      wicon('Avatar Icon', 134, 60, 32, 'mdi-account', { color: C.grayLight }),
      wlabel('Name', 50, 124, 200, 22, 'Anna Müller', { size: 17, bold: true, align: 'center' }),
      wlabel('Role', 50, 150, 200, 16, '产品设计师', { size: 13, color: C.gray, align: 'center' }),
      hdivider(40, 180, 220),
      wlabel('SV1', 48, 196, 68, 22, '142', { size: 17, bold: true, align: 'center' }),
      wlabel('SL1', 48, 220, 68, 14, '帖子', { size: 11, color: C.grayLight, align: 'center' }),
      vdivider(128, 196, 40),
      wlabel('SV2', 148, 196, 68, 22, '8.4k', { size: 17, bold: true, align: 'center' }),
      wlabel('SL2', 148, 220, 68, 14, '粉丝', { size: 11, color: C.grayLight, align: 'center' }),
      vdivider(228, 196, 40),
      wlabel('SV3', 244, 196, 48, 22, '312', { size: 17, bold: true, align: 'center' }),
      wlabel('SL3', 244, 220, 48, 14, '正在关注', { size: 11, color: C.grayLight, align: 'center' }),
      wbutton('关注', 24, 256, 120, 38, '关注', { radius: 999 }),
      wbutton('消息', 156, 256, 120, 38, '消息', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 999 })
    ]
    out.push(group('QXCardProfile', '个人资料卡', c, { subcategory: 'CCard' }))
  }

  // Comment item
  {
    const c = [
      avatar(0, 0, 36),
      wlabel('Name', 48, 0, 200, 18, 'Peter Simmons', { size: 14, bold: true }),
      wlabel('Time', 48, 20, 200, 14, '2 小时前', { size: 12, color: C.grayLight }),
      wlabel('Text', 48, 44, 464, 44, '这正是我们需要的！数据视图每周帮我们省下数小时手工工作。', { size: 14, lineHeight: 1.5 }),
      wicon('Like', 48, 96, 18, 'mdi-thumb-up-outline'),
      wlabel('Like Count', 72, 98, 40, 14, '24', { size: 12, color: C.gray }),
      wicon('Dislike', 112, 96, 18, 'mdi-thumb-down-outline'),
      wlabel('回复', 152, 98, 48, 14, '回复', { size: 12, color: C.primary })
    ]
    out.push(group('QXCardComment', '评论条目', c, { subcategory: 'CCard' }))
  }

  // Testimonial card
  {
    const c = [
      wbox('Card', 0, 0, 360, 240, { bg: C.white, radius: 12 }),
      wicon('Quote', 24, 24, 32, 'mdi-format-quote-open', { color: C.primaryBorder }),
      wlabel('Text', 24, 72, 312, 64, '“我们用 Quant-UX 替代了三个工具，研究周期从几周缩短到几天。”', { size: 14, lineHeight: 1.6 }),
      wrating('Stars', 24, 148, 120, 20, 5),
      avatar(24, 180, 36),
      wlabel('Name', 72, 182, 180, 18, 'Julia Chen', { size: 14, bold: true }),
      wlabel('Role', 72, 202, 220, 14, 'Northwind 设计负责人', { size: 12, color: C.grayLight })
    ]
    out.push(group('QXCardTestimonial', '客户评价卡', c, { subcategory: 'CCard' }))
  }

  // Empty state
  {
    const c = [
      wbox('Icon Bg', 148, 24, 104, 104, { bg: C.light, radius: 52, borderColor: C.light }),
      wicon('Icon', 174, 50, 52, 'mdi-file-search-outline', { color: C.grayLight }),
      wlabel('Title', 60, 156, 280, 24, '未找到结果', { size: 18, bold: true, align: 'center' }),
      wlabel('Sub', 60, 186, 280, 40, '试试调整搜索词或筛选条件来找到想要的内容。', { size: 13, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbutton('Action', 130, 240, 140, 40, '清除筛选', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 })
    ]
    out.push(group('QXCardEmpty', '空状态', c, { subcategory: 'CCard' }))
  }

  // Social login
  {
    const c = [
      wbox('Card', 0, 0, 340, 300, { bg: C.white, radius: 12 }),
      wlabel('Title', 0, 32, 340, 24, '登录方式', { size: 18, bold: true, align: 'center' }),
      wbutton('Google', 36, 80, 268, 44, '使用 Google 继续', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('Google Ic', 56, 94, 18, 'mdi-google', { color: C.dark }),
      wbutton('GitHub', 36, 136, 268, 44, '使用 GitHub 继续', { bg: '#181717', color: C.white, borderColor: '#181717', hoverBg: '#000000', radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('GitHub Ic', 56, 150, 18, 'mdi-github', { color: C.white }),
      wbutton('Microsoft', 36, 192, 268, 44, '使用 Microsoft 继续', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8, align: 'left', paddingLeft: 52 }),
      wicon('MS Ic', 56, 206, 18, 'mdi-microsoft-windows', { color: C.dark }),
      wlabel('条款', 36, 256, 268, 28, '继续即表示你同意我们的服务条款和隐私政策。', { size: 11, color: C.grayLight, align: 'center', lineHeight: 1.4 })
    ]
    out.push(group('QXCardSocialLogin', '社交登录', c, { subcategory: 'CCard' }))
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
      wlabel('Placeholder', 48, 14, 280, 16, '搜索商品、品牌...', { size: 14, color: C.grayLight }),
      wbutton('Btn', 376, 4, 96, 36, '搜索', { radius: 999 })
    ]
    out.push(group('QXFormSearch', '搜索栏', c, { subcategory: 'DForm' }))
  }

  // Newsletter
  {
    const c = [
      wbox('Card', 0, 0, 480, 160, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 300, 22, '保持资讯畅通', { size: 17, bold: true }),
      wlabel('Sub', 24, 46, 360, 18, '每月产品更新，不发垃圾邮件。', { size: 13, color: C.gray }),
      wtext('邮箱', 24, 78, 300, 40, '你的邮箱地址'),
      wbutton('订阅', 332, 78, 124, 40, '订阅', { radius: 8 }),
      wlabel('Hint', 24, 128, 300, 14, '随时可退订。', { size: 11, color: C.grayLight })
    ]
    out.push(group('QXFormNewsletter', '邮件订阅', c, { subcategory: 'DForm' }))
  }

  // Filter panel
  {
    const c = [
      wbox('Panel', 0, 0, 260, 460, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 160, 20, '筛选条件', { size: 16, bold: true }),
      wlabel('Clear', 188, 22, 52, 16, '全部清除', { size: 12, color: C.primary, align: 'right' }),
      hdivider(20, 48, 220),
      wlabel('Cat', 20, 64, 200, 16, '分类', { size: 13, bold: true }),
      wcheck('C1', 20, 88, 220, 24, '运动鞋', true),
      wcheck('C2', 20, 118, 220, 24, '靴子'),
      wcheck('C3', 20, 148, 220, 24, '凉鞋'),
      wcheck('C4', 20, 178, 220, 24, '乐福鞋'),
      hdivider(20, 212, 220),
      wlabel('Price', 20, 228, 200, 16, '价格区间', { size: 13, bold: true }),
      wtext('最小', 20, 252, 100, 36, '最小', { size: 13 }),
      wlabel('Dash', 128, 260, 24, 16, '—', { size: 13, color: C.grayLight, align: 'center' }),
      wtext('最大', 140, 252, 100, 36, '最大', { size: 13 }),
      hdivider(20, 304, 220),
      wlabel('评分', 20, 320, 200, 16, '评分', { size: 13, bold: true }),
      wdropdown('Rating D', 20, 344, 220, 36, ['4 星及以上', '3 星及以上', '任意评分']),
      hdivider(20, 396, 220),
      wbutton('重置', 20, 412, 100, 36, '重置', { bg: C.white, color: C.gray, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('应用', 128, 412, 112, 36, '应用筛选', { radius: 8 })
    ]
    out.push(group('QXFormFilter', '筛选面板', c, { subcategory: 'DForm' }))
  }

  // Contact form
  {
    const c = [
      wbox('Card', 0, 0, 420, 500, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, '联系我们', { size: 20, bold: true }),
      wlabel('Sub', 32, 58, 340, 18, '我们通常会在 24 小时内回复。', { size: 13, color: C.gray }),
      wlabel('N1L', 32, 96, 200, 14, '名', { size: 12, color: C.gray }),
      wtext('N1', 32, 114, 170, 38, 'Jane'),
      wlabel('N2L', 218, 96, 200, 14, '姓', { size: 12, color: C.gray }),
      wtext('N2', 218, 114, 170, 38, 'Doe'),
      wlabel('EL', 32, 166, 200, 14, '邮箱', { size: 12, color: C.gray }),
      wtext('E', 32, 184, 356, 38, 'jane@company.com'),
      wlabel('SL', 32, 236, 200, 14, '主题', { size: 12, color: C.gray }),
      wdropdown('S', 32, 254, 356, 38, ['一般咨询', '销售', '支持', '合作']),
      wlabel('ML', 32, 306, 200, 14, '消息', { size: 12, color: C.gray }),
      wtext('M', 32, 324, 356, 96, '我们能帮什么忙？', { type: 'TextArea' }),
      wcheck('Agree', 32, 436, 340, 22, '给我发送一份此消息的副本'),
      wbutton('Send', 32, 452, 140, 40, '发送消息', { radius: 8 })
    ]
    out.push(group('QXFormContact', '联系表单', c, { subcategory: 'DForm' }))
  }

  // Settings form
  {
    const c = [
      wbox('Card', 0, 0, 520, 560, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, '账号设置', { size: 20, bold: true }),
      avatar(32, 72, 64),
      wbutton('Change Avatar', 112, 96, 120, 32, '更换照片', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 6, size: 13 }),
      wlabel('Name L', 32, 168, 200, 14, '姓名', { size: 12, color: C.gray }),
      wtext('Name', 32, 186, 456, 38, 'Klaus Huber'),
      wlabel('Email L', 32, 238, 200, 14, '邮箱', { size: 12, color: C.gray }),
      wtext('邮箱', 32, 256, 456, 38, 'klaus@quant-ux.com'),
      wlabel('TZ L', 32, 308, 200, 14, '时区', { size: 12, color: C.gray }),
      wdropdown('TZ', 32, 326, 456, 38, ['柏林 (GMT+1)', '纽约 (GMT-5)', '上海 (GMT+8)']),
      wlabel('Notif', 32, 384, 300, 18, '通知', { size: 14, bold: true }),
      wlabel('N1L', 32, 412, 340, 16, '邮件通知', { size: 13 }),
      wswitch('N1', 456, 406, 48, 24, true),
      wlabel('N2L', 32, 444, 340, 16, '产品更新', { size: 13 }),
      wswitch('N2', 456, 438, 48, 24),
      wlabel('N3L', 32, 476, 340, 16, '每周摘要', { size: 13 }),
      wswitch('N3', 456, 470, 48, 24, true),
      hdivider(32, 504, 456),
      wbutton('取消', 300, 516, 88, 36, '取消', { bg: C.white, color: C.gray, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('Save', 400, 516, 88, 36, '保存更改', { radius: 8 })
    ]
    out.push(group('QXFormSettings', '设置表单', c, { subcategory: 'DForm' }))
  }

  // Signup extended
  {
    const c = [
      wbox('Card', 0, 0, 400, 600, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 24, '创建你的账号', { size: 20, bold: true }),
      wlabel('Sub', 32, 58, 320, 18, '开始 14 天免费试用。', { size: 13, color: C.gray }),
      wlabel('Name L', 32, 96, 200, 14, '姓名', { size: 12, color: C.gray }),
      wtext('Name', 32, 114, 336, 38, 'Jane Doe'),
      wlabel('Email L', 32, 166, 200, 14, '邮箱', { size: 12, color: C.gray }),
      wtext('邮箱', 32, 184, 336, 38, 'jane@company.com'),
      wlabel('Pw L', 32, 236, 200, 14, '密码', { size: 12, color: C.gray }),
      wtext('Pw', 32, 254, 336, 38, '至少 8 个字符', { type: '密码', cleartext: true }),
      wlabel('Pw2 L', 32, 306, 200, 14, '确认密码', { size: 12, color: C.gray }),
      wtext('Pw2', 32, 324, 336, 38, '再次输入密码', { type: '密码' }),
      wicon('Pw Hint Ic', 344, 260, 16, 'mdi-lock', { color: C.grayLight }),
      wcheck('条款', 32, 380, 336, 22, '我同意服务条款和隐私政策'),
      wbutton('Create', 32, 416, 336, 44, '创建账号', { radius: 8 }),
      hdivider(32, 484, 336),
      wlabel('Or', 160, 498, 80, 14, '或使用以下方式', { size: 12, color: C.grayLight, align: 'center' }),
      wbutton('Google', 32, 528, 160, 40, 'Google', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('GitHub', 208, 528, 160, 40, 'GitHub', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 })
    ]
    out.push(group('QXFormSignup', '注册表单', c, { subcategory: 'DForm' }))
  }

  // Address form
  {
    const c = [
      wbox('Card', 0, 0, 420, 440, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 22, '收货地址', { size: 18, bold: true }),
      wlabel('SL', 32, 64, 200, 14, '街道地址', { size: 12, color: C.gray }),
      wtext('S', 32, 82, 356, 38, '示例路 12 号'),
      wlabel('CL', 32, 134, 200, 14, '城市', { size: 12, color: C.gray }),
      wtext('C', 32, 152, 200, 38, '柏林'),
      wlabel('ZL', 244, 134, 120, 14, '邮编', { size: 12, color: C.gray }),
      wtext('Z', 244, 152, 144, 38, '10115'),
      wlabel('CoL', 32, 204, 200, 14, '国家', { size: 12, color: C.gray }),
      wdropdown('Co', 32, 222, 356, 38, ['德国', '奥地利', '瑞士', '中国', '美国']),
      wlabel('PhL', 32, 274, 200, 14, '电话', { size: 12, color: C.gray }),
      wtext('Ph', 32, 292, 356, 38, '+49 30 12345678'),
      wcheck('Default', 32, 348, 356, 22, '设为我的默认地址'),
      wbutton('Save', 32, 384, 356, 40, '保存地址', { radius: 8 })
    ]
    out.push(group('QXFormAddress', '地址表单', c, { subcategory: 'DForm' }))
  }

  // Payment form
  {
    const c = [
      wbox('Card', 0, 0, 400, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 32, 28, 300, 22, '支付信息', { size: 18, bold: true }),
      wicon('Visa', 276, 30, 28, 'mdi-credit-card', { color: C.primary }),
      wicon('MC', 310, 30, 28, 'mdi-credit-card-outline', { color: C.gray }),
      wicon('PP', 344, 30, 24, 'mdi-currency-usd', { color: C.grayLight }),
      wlabel('NumL', 32, 72, 200, 14, '卡号', { size: 12, color: C.gray }),
      wtext('Num', 32, 90, 336, 38, '4242 4242 4242 4242'),
      wlabel('NameL', 32, 142, 200, 14, '持卡人姓名', { size: 12, color: C.gray }),
      wtext('Name', 32, 160, 336, 38, 'KLAUS HUBER'),
      wlabel('ExpL', 32, 212, 120, 14, '有效期', { size: 12, color: C.gray }),
      wtext('Exp', 32, 230, 156, 38, '月 / 年'),
      wlabel('CvcL', 212, 212, 120, 14, 'CVC', { size: 12, color: C.gray }),
      wtext('Cvc', 212, 230, 156, 38, '123'),
      wcheck('Save', 32, 286, 300, 22, '保存此卡用于后续支付'),
      wbutton('Pay', 32, 322, 336, 44, '支付 $129.00', { radius: 8, bold: true })
    ]
    out.push(group('QXFormPayment', '支付表单', c, { subcategory: 'DForm' }))
  }

  // Login compact
  {
    const c = [
      wbox('Card', 0, 0, 320, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 28, 28, 260, 22, '欢迎回来', { size: 18, bold: true }),
      wlabel('Sub', 28, 54, 260, 16, '登录以继续', { size: 13, color: C.gray }),
      wlabel('EL', 28, 92, 200, 14, '邮箱', { size: 12, color: C.gray }),
      wtext('E', 28, 110, 264, 38, 'you@company.com'),
      wlabel('PL', 28, 162, 200, 14, '密码', { size: 12, color: C.gray }),
      wtext('P', 28, 180, 264, 38, '••••••••', { type: '密码', cleartext: true }),
      wcheck('Remember', 28, 232, 140, 22, '记住我'),
      wlabel('Forgot', 192, 235, 100, 16, '忘记密码？', { size: 12, color: C.primary, align: 'right' }),
      wbutton('Login', 28, 264, 264, 40, '登录', { radius: 8, bold: true })
    ]
    out.push(group('QXFormLoginCompact', '紧凑登录框', c, { subcategory: 'DForm' }))
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
      wlabel('Title', 0, 8, 300, 28, '数据分析概览', { size: 22, bold: true }),
      wlabel('Sub', 0, 42, 400, 16, '数据范围：2026 年 1 月 1 日 – 1 月 31 日', { size: 13, color: C.gray }),
      wdropdown('Range', 700, 12, 160, 36, ['近 30 天', '近 7 天', '今年']),
      wbutton('导出', 872, 12, 64, 36, '', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 }),
      wicon('Export Ic', 896, 22, 16, 'mdi-download', { color: C.gray }),
      wbutton('添加', 936, 12, 104, 36, '+ 新建报表')
    ]
    out.push(group('QXDashHeader', '仪表盘顶栏', c, { subcategory: 'EDash' }))
  }

  // KPI row
  {
    const kpi = (x, label, value, delta, up, icon) => [
      wbox(`Card ${x}`, x, 0, 240, 130, { bg: C.white, radius: 12 }),
      wicon(`Icon ${x}`, x + 192, 16, 24, icon, { color: C.primary }),
      wlabel(`Label ${x}`, x + 20, 18, 150, 14, label, { size: 12, color: C.gray }),
      wlabel(`Value ${x}`, x + 20, 38, 170, 30, value, { size: 24, bold: true }),
      ...chip(`Delta ${x}`, x + 20, 78, `${up ? '▲' : '▼'} ${delta}`, { bg: up ? C.successSoft : C.dangerSoft, color: up ? C.success : C.danger }),
      wlabel(`Since ${x}`, x + 104, 81, 120, 14, '较上月', { size: 11, color: C.grayLight })
    ]
    const c = [
      ...kpi(0, '收入', '$48.2k', '12.5%', true, 'mdi-currency-usd'),
      ...kpi(268, '活跃用户', '8,421', '3.2%', true, 'mdi-account-group'),
      ...kpi(536, '流失率', '2.1%', '0.4%', false, 'mdi-chart-line'),
      ...kpi(804, 'NPS', '62', '5.0', true, 'mdi-heart')
    ]
    out.push(group('QXDashKPIRow', 'KPI 指标行', c, { subcategory: 'EDash' }))
  }

  // Chart card
  {
    const c = [
      wbox('Card', 0, 0, 480, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 220, 20, '每周会话', { size: 15, bold: true }),
      ...chip('Delta', 24, 48, '▲ 8.1%'),
      wdropdown('Range', 348, 16, 108, 32, ['本周', '本月'], { size: 12 }),
      wbar('Chart', 24, 88, 432, 200, [['120'], ['180'], ['90'], ['220'], ['310'], ['260'], ['340']])
    ]
    out.push(group('QXDashBarCard', '柱状图卡片', c, { subcategory: 'EDash' }))
  }

  // Line chart card
  {
    const c = [
      wbox('Card', 0, 0, 480, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 240, 20, '转化率', { size: 15, bold: true }),
      ...chip('Delta', 24, 48, '▲ 2.4%', { bg: C.successSoft, color: C.success }),
      wdropdown('Range', 348, 16, 108, 32, ['30 天', '90 天'], { size: 12 }),
      wbar('Chart', 24, 88, 432, 200, [['2.1'], ['2.4'], ['2.2'], ['2.8'], ['3.0'], ['2.9'], ['3.4']], { line: true })
    ]
    out.push(group('QXDashLineCard', '折线图卡片', c, { subcategory: 'EDash' }))
  }

  // Ring card with legend
  {
    const c = [
      wbox('Card', 0, 0, 320, 300, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '流量来源', { size: 15, bold: true }),
      wring('Ring', 36, 64, 140, 140, 62),
      wlabel('Ring Value', 76, 118, 60, 24, '62%', { size: 20, bold: true, align: 'center' }),
      ...[['自然搜索', '2,845', C.primary], ['直接访问', '1,120', C.success], ['引荐', '645', C.warning], ['社交', '312', C.grayLight]].flatMap((r, i) => [
        dot(196, 74 + i * 40, r[2]),
        wlabel(`LL ${i}`, 212, 70 + i * 40, 100, 16, r[0], { size: 12 }),
        wlabel(`LV ${i}`, 212, 88 + i * 40, 100, 16, r[1], { size: 13, bold: true })
      ])
    ]
    out.push(group('QXDashRingCard', '环形图卡片', c, { subcategory: 'EDash' }))
  }

  // Pie card
  {
    const c = [
      wbox('Card', 0, 0, 320, 280, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '设备分布', { size: 15, bold: true }),
      wpie('Pie', 40, 60, 160, 160, [45, 30, 25]),
      ...[['桌面端', '45%', C.primary], ['移动端', '30%', C.success], ['平板', '25%', C.warning]].flatMap((r, i) => [
        dot(216, 92 + i * 44, r[2]),
        wlabel(`LL ${i}`, 232, 86 + i * 44, 80, 15, r[0], { size: 12 }),
        wlabel(`LV ${i}`, 232, 102 + i * 44, 80, 16, r[1], { size: 13, bold: true })
      ])
    ]
    out.push(group('QXDashPieCard', '饼图卡片', c, { subcategory: 'EDash' }))
  }

  // Table card
  {
    const c = [
      wbox('Card', 0, 0, 720, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 20, 240, 20, '最近订单', { size: 15, bold: true }),
      wbox('搜索', 480, 14, 130, 32, { bg: C.lighter, radius: 6, borderColor: C.border }),
      wicon('Search Ic', 492, 22, 16, 'mdi-magnify', { color: C.grayLight }),
      wbutton('筛选', 624, 14, 72, 32, '筛选', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6, size: 13 }),
      wtable('Table', 24, 60, 672, 260,
        ['Order', 'Customer', 'Date', '状态', '合计'],
        [
          ['#10248', 'Anna Müller', '2026-1-12', '已支付', '$129.00'],
          ['#10247', 'Peter Simmons', '2026-1-11', '待支付', '$89.00'],
          ['#10246', 'Julia Chen', '2026-1-10', '已支付', '$249.00'],
          ['#10245', 'Klaus Huber', '2026-1-8', '已退款', '$59.00'],
          ['#10244', 'Maria Silva', '2026-1-6', '已支付', '$179.00']
        ]),
      wlabel('Count', 24, 340, 200, 16, '显示第 1–5 条，共 128 条', { size: 12, color: C.grayLight }),
      wbutton('Prev', 540, 332, 32, 32, '<', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 }),
      wbox('Page', 580, 332, 32, 32, { bg: C.primarySoft, radius: 6, borderColor: C.primarySoft }),
      wlabel('Page L', 580, 340, 32, 16, '1', { size: 13, bold: true, color: C.primary, align: 'center' }),
      wbutton('Next', 620, 332, 32, 32, '>', { bg: C.white, color: C.gray, borderColor: C.border, radius: 6 })
    ]
    out.push(group('QXDashTableCard', '表格卡片', c, { subcategory: 'EDash' }))
  }

  // Progress panel
  {
    const rows = [['设计系统', 82], ['移动应用', 54], ['网站', 96], ['API 文档', 28]]
    const c = [
      wbox('Card', 0, 0, 320, 280, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '项目进度', { size: 15, bold: true }),
      ...rows.flatMap((r, i) => [
        wlabel(`PL ${i}`, 20, 60 + i * 52, 180, 16, r[0], { size: 13 }),
        wlabel(`PV ${i}`, 260, 60 + i * 52, 40, 16, `${r[1]}%`, { size: 13, bold: true, align: 'right' }),
        wprogress(`P ${i}`, 20, 82 + i * 52, 280, 8, r[1])
      ])
    ]
    out.push(group('QXDashProgress', '进度面板', c, { subcategory: 'EDash' }))
  }

  // Activity feed
  {
    const acts = [
      ['mdi-comment-text', C.primarySoft, C.primary, 'Anna 评论了“结算流程”', '10:42'],
      ['mdi-file-document-outline', C.successSoft, C.success, 'Peter 上传了“Brand-assets-v3.zip”', '09:15'],
      ['mdi-account-plus', C.warningSoft, C.warning, 'Maria 邀请了 2 位新成员', '昨天'],
      ['mdi-check-circle', C.successSoft, C.success, 'Sprint 24 目标已完成', '昨天'],
      ['mdi-cog', C.light, C.gray, '集成设置已变更', '周一']
    ]
    const c = [
      wbox('Card', 0, 0, 360, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '动态', { size: 15, bold: true }),
      wlabel('See All', 288, 23, 52, 14, '查看全部', { size: 12, color: C.primary, align: 'right' }),
      ...acts.flatMap((a, i) => [
        wbox(`Ic Bg ${i}`, 20, 56 + i * 64, 36, 36, { bg: a[1], radius: 18, borderColor: a[1] }),
        wicon(`Ic ${i}`, 28, 64 + i * 64, 20, a[0], { color: a[2] }),
        wlabel(`T ${i}`, 68, 58 + i * 64, 268, 34, a[3], { size: 13, lineHeight: 1.3 }),
        wlabel(`Time ${i}`, 68, 78 + i * 64, 200, 13, a[4], { size: 11, color: C.grayLight })
      ])
    ]
    out.push(group('QXDashActivity', '动态信息流', c, { subcategory: 'EDash' }))
  }

  // Calendar
  {
    const days = ['一', '二', '三', '四', '五', '六', '日']
    const c = [
      wbox('Card', 0, 0, 320, 340, { bg: C.white, radius: 12 }),
      wlabel('Month', 20, 20, 160, 20, '2026 年 1 月', { size: 15, bold: true }),
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
    out.push(group('QXDashCalendar', '月历', c, { subcategory: 'EDash' }))
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
      wlabel('Title', 0, 0, 160, 20, '进行中', { size: 14, bold: true }),
      wbox('Count', 92, 2, 24, 18, { bg: C.primarySoft, radius: 9, borderColor: C.primarySoft }),
      wlabel('Count L', 92, 5, 24, 13, '3', { size: 11, bold: true, color: C.primary, align: 'center' }),
      wicon('添加', 224, 0, 20, 'mdi-plus', { color: C.gray }),
      ...task(32, '修复 Safari 登录跳转', '缺陷', C.danger, C.dangerSoft, '1 月 14 日', '#fee2e2'),
      ...task(140, '更新定价页文案', '内容', C.primary, C.primarySoft, '1 月 16 日', '#dbeafe'),
      ...task(248, '为端到端测试搭建 CI', '运维', C.warning, C.warningSoft, '1 月 18 日', '#fef3c7'),
      wbox('Add Card', 12, 356, 232, 44, { bg: C.white, radius: 8, borderColor: C.border, borderWidth: 1 }),
      wlabel('Add L', 12, 370, 232, 16, '+ 添加卡片', { size: 13, color: C.gray, align: 'center' })
    ]
    out.push(group('QXDashKanban', '看板列', c, { subcategory: 'EDash' }))
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
      ['Anna Müller', 'v3 设计评审笔记', '9:24', true, true],
      ['GitHub', '[quant-ux] PR #482 已合并', '8:51', true, false],
      ['Julia Chen', '回复：合同更新', '昨天', false, false],
      ['邮件订阅', '每周设计摘要', '周二', false, true],
      ['Peter Simmons', '明天一起午饭？', '周一', false, false]
    ]
    const c = [
      wbox('Panel', 0, 0, 520, 400, { bg: C.white, radius: 12 }),
      wcheck('All', 20, 20, 24, 22, '', false),
      wicon('Archive', 56, 22, 20, 'mdi-archive-outline'),
      wicon('删除', 84, 22, 20, 'mdi-delete'),
      wlabel('Title', 420, 22, 80, 18, '收件箱（2）', { size: 14, bold: true, align: 'right' }),
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
    out.push(group('QXListInbox', '收件箱列表', c, { subcategory: 'FList' }))
  }

  // Chat window
  {
    const c = [
      wbox('Window', 0, 0, 400, 480, { bg: C.lighter, radius: 12 }),
      wbox('Header', 0, 0, 400, 60, { bg: C.white, borderColor: C.border, radius: 0 }),
      avatar(16, 14, 32),
      wlabel('Name', 60, 14, 160, 18, 'Anna Müller', { size: 14, bold: true }),
      wlabel('状态', 60, 34, 160, 14, '● 在线', { size: 11, color: C.success }),
      wicon('Call', 340, 18, 20, 'mdi-phone'),
      wicon('More', 368, 18, 20, 'mdi-dots-vertical'),
      wbox('Msg 1', 16, 76, 200, 40, { bg: C.white, radius: 12, borderColor: C.border }),
      wlabel('Msg 1 T', 28, 88, 176, 16, '嗨！改版进展如何？', { size: 13 }),
      wbox('Msg 2', 184, 128, 200, 68, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Msg 2 T', 196, 140, 176, 44, '很顺利！今天完成了仪表盘页面 ✨', { size: 13, color: C.white, lineHeight: 1.4 }),
      wbox('Msg 3', 16, 208, 160, 40, { bg: C.white, radius: 12, borderColor: C.border }),
      wlabel('Msg 3 T', 28, 220, 136, 16, '能发我看看吗？', { size: 13 }),
      wbox('Msg 4', 248, 258, 136, 40, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Msg 4 T', 260, 270, 112, 16, '好，稍等！', { size: 13, color: C.white }),
      wlabel('Typing', 16, 306, 200, 14, 'Anna 正在输入...', { size: 11, color: C.grayLight }),
      wbox('Input', 16, 408, 320, 44, { bg: C.white, radius: 999, borderColor: C.border }),
      wlabel('Input PH', 36, 422, 240, 16, '输入消息...', { size: 13, color: C.grayLight }),
      wicon('Attach', 300, 422, 18, 'mdi-attachment', { color: C.grayLight }),
      wbox('Send Btn', 348, 408, 44, 44, { bg: C.primary, radius: 22, borderColor: C.primary }),
      wicon('Send Ic', 361, 421, 18, 'mdi-send', { color: C.white })
    ]
    out.push(group('QXListChat', '聊天窗口', c, { subcategory: 'FList' }))
  }

  // Notifications panel
  {
    const notifs = [
      ['mdi-account-plus', C.primarySoft, C.primary, '新成员', 'Maria Silva 加入了你的工作区', '2 分钟'],
      ['mdi-comment-text', C.successSoft, C.success, '新评论', 'Peter 评论了“首页”', '1 小时'],
      ['mdi-alert-circle', C.warningSoft, C.warning, '存储已用 90%', '考虑升级你的方案', '3h'],
      ['mdi-check-circle', C.primarySoft, C.primary, '部署完成', 'v4.0.2 已上线', '昨天']
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 400, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '通知', { size: 15, bold: true }),
      wlabel('Mark', 224, 23, 116, 14, '全部标为已读', { size: 12, color: C.primary, align: 'right' }),
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
      wlabel('页脚', 0, 372, 360, 16, '查看全部通知', { size: 13, color: C.primary, align: 'center' })
    ]
    out.push(group('QXListNotifications', '通知面板', c, { subcategory: 'FList' }))
  }

  // Social feed item
  {
    const c = [
      wbox('Card', 0, 0, 480, 200, { bg: C.white, radius: 12 }),
      avatar(20, 20, 40),
      wlabel('Name', 72, 22, 220, 18, 'Julia Chen', { size: 14, bold: true }),
      wlabel('Handle', 72, 42, 220, 14, '@juliadesign · 3 小时', { size: 12, color: C.grayLight }),
      wicon('More', 444, 22, 18, 'mdi-dots-horizontal'),
      wlabel('Text', 20, 76, 440, 40, '新设计系统刚刚上线 🎉 40+ 组件，文档齐全，欢迎反馈！', { size: 14, lineHeight: 1.4 }),
      hdivider(20, 128, 440),
      wicon('Like', 28, 144, 20, 'mdi-heart-outline', { color: C.danger }),
      wlabel('Like C', 54, 147, 40, 14, '128', { size: 12, color: C.gray }),
      wicon('Comment Ic', 116, 144, 20, 'mdi-comment-outline'),
      wlabel('Comment C', 142, 147, 40, 14, '32', { size: 12, color: C.gray }),
      wicon('分享', 204, 144, 20, 'mdi-share-variant'),
      wicon('Bookmark', 444, 144, 20, 'mdi-bookmark-outline')
    ]
    out.push(group('QXListFeed', '动态条目', c, { subcategory: 'FList' }))
  }

  // Team list
  {
    const members = [
      ['Klaus Huber', '所有者', C.primarySoft, C.primary],
      ['Anna Müller', '管理员', C.successSoft, C.success],
      ['Peter Simmons', '可编辑', C.warningSoft, C.warning],
      ['Julia Chen', '可编辑', C.warningSoft, C.warning],
      ['Maria Silva', '只读', C.light, C.gray]
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 360, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '团队成员', { size: 15, bold: true }),
      wlabel('Invite', 280, 23, 60, 14, '+ 邀请', { size: 13, color: C.primary, align: 'right' }),
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
    out.push(group('QXListTeam', '团队列表', c, { subcategory: 'FList' }))
  }

  // Todo list
  {
    const todos = [
      ['评审拉取请求 #482', true],
      ['准备 Sprint 演示幻灯片', false],
      ['更新组件库文档', false],
      ['安排可用性测试场次', false],
      ['修复移动端导航溢出', false]
    ]
    const c = [
      wbox('Panel', 0, 0, 360, 380, { bg: C.white, radius: 12 }),
      wlabel('Title', 20, 20, 200, 20, '我的任务', { size: 15, bold: true }),
      ...chip('Badge', 90, 20, '1 / 5', { h: 20 }),
      wbox('Input', 20, 52, 240, 36, { bg: C.lighter, radius: 8, borderColor: C.border }),
      wlabel('Input PH', 32, 62, 200, 16, '添加新任务...', { size: 13, color: C.grayLight }),
      wbox('Add Btn', 268, 52, 72, 36, { bg: C.primary, radius: 8, borderColor: C.primary }),
      wlabel('Add L', 268, 62, 72, 16, '+ 添加', { size: 13, color: C.white, align: 'center', bold: true }),
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
      wlabel('页脚', 20, 352, 200, 16, '剩余 4 个任务', { size: 12, color: C.grayLight }),
      wlabel('Clear', 260, 352, 80, 16, '清除已完成', { size: 12, color: C.primary, align: 'right' })
    ]
    out.push(group('QXListTodo', '待办列表', c, { subcategory: 'FList' }))
  }

  // Comment thread
  {
    const c = [
      wlabel('Title', 0, 0, 200, 20, '评论（3）', { size: 15, bold: true }),
      hdivider(0, 32, 560),
      avatar(0, 48, 36),
      wlabel('N1', 48, 48, 200, 17, 'Anna Müller', { size: 14, bold: true }),
      wlabel('T1', 48, 68, 200, 14, '2 小时前', { size: 12, color: C.grayLight }),
      wlabel('B1', 48, 90, 512, 40, '主视觉区的间距现在好多了。CTA 按钮要不要再放大一点？', { size: 14, lineHeight: 1.4 }),
      wlabel('Reply 1', 48, 134, 80, 14, '↩ 回复', { size: 12, color: C.primary }),
      avatar(0, 172, 36, { bg: '#dcfce7' }),
      wlabel('N2', 48, 172, 200, 17, 'Peter Simmons', { size: 14, bold: true }),
      wlabel('T2', 48, 192, 200, 14, '1 小时前', { size: 12, color: C.grayLight }),
      wlabel('B2', 48, 214, 512, 20, '同意，+2px 内边距效果不错。', { size: 14, lineHeight: 1.4 }),
      wlabel('Reply 2', 48, 240, 80, 14, '↩ 回复', { size: 12, color: C.primary }),
      avatar(0, 292, 36, { bg: '#fef3c7' }),
      wbox('Reply Input', 48, 292, 512, 44, { bg: C.lighter, radius: 999, borderColor: C.border }),
      wlabel('Reply PH', 68, 306, 400, 16, '输入回复...', { size: 13, color: C.grayLight }),
      wicon('Send', 528, 306, 18, 'mdi-send', { color: C.primary })
    ]
    out.push(group('QXListThread', '评论串', c, { subcategory: 'FList' }))
  }

  // Search results
  {
    const results = [
      ['设计系统文档 – Quant-UX 帮助', 'docs.quant-ux.com/design-systems', '了解如何创建、管理和发布设计系统组件...'],
      ['原型入门', 'docs.quant-ux.com/prototypes', '几分钟构建交互原型，添加转场、逻辑和...'],
      ['设计令牌指南', 'blog.quant-ux.com/tokens', '颜色、间距与排版令牌保持产品一致性...']
    ]
    const c = [
      wbox('搜索', 0, 0, 560, 44, { bg: C.white, radius: 999, borderColor: C.primary }),
      wicon('Ic', 16, 12, 20, 'mdi-magnify', { color: C.primary }),
      wlabel('Query', 48, 14, 400, 16, '设计系统', { size: 14 }),
      wlabel('Meta', 0, 60, 400, 14, '约 1,240 条结果（0.42 秒）', { size: 12, color: C.grayLight }),
      ...results.flatMap((r, i) => {
        const y = 92 + i * 100
        return [
          wlabel(`T ${i}`, 0, y, 520, 20, r[0], { size: 16, color: C.primary }),
          wlabel(`U ${i}`, 0, y + 24, 400, 15, r[1], { size: 12, color: C.success }),
          wlabel(`S ${i}`, 0, y + 44, 540, 40, r[2], { size: 13, color: C.gray, lineHeight: 1.4 })
        ]
      })
    ]
    out.push(group('QXListSearchResults', '搜索结果', c, { subcategory: 'FList' }))
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
      wbutton(`Add ${x} ${y}`, x + 140, y + 244, 72, 28, '添加', { radius: 6, size: 13 })
    ]
    const cells = []
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 3; col++) {
        cells.push([col * 248, r * 296])
      }
    }
    const prods = [
      ['Runner Pro X1', '运动鞋', '$129', true],
      ['经典皮鞋', '靴子', '$189', false],
      ['夏日清风', '凉鞋', '$79', false],
      ['城市乐福鞋', '乐福鞋', '$149', false],
      ['越野先锋', '徒步', '$169', true],
      ['环保一脚蹬', '运动鞋', '$99', false]
    ]
    const c = cells.flatMap((pos, i) => prod(pos[0], pos[1], prods[i][0], prods[i][1], prods[i][2], prods[i][3]))
    out.push(group('QXShopGrid', '商品网格', c, { subcategory: 'GShop' }))
  }

  // Cart item
  {
    const c = [
      ...imagePlaceholder('Thumb', 0, 0, 80, 80, { radius: 8 }),
      wlabel('Name', 96, 8, 260, 18, 'Runner Pro X1', { size: 15, bold: true }),
      wlabel('Variant', 96, 30, 260, 14, '42 码 · 黑色', { size: 12, color: C.grayLight }),
      wlabel('Stock', 96, 50, 260, 14, '有货', { size: 12, color: C.success }),
      wicon('删除', 520, 8, 20, 'mdi-close', { color: C.grayLight }),
      wbox('Qty', 96, 44 + 24, 88, 28, { bg: C.white, radius: 6, borderColor: C.border }),
      wlabel('Qty L', 96 + 36, 44 + 32, 16, 16, '1', { size: 13, align: 'center' }),
      wicon('Minus', 96 + 8, 44 + 30, 14, 'mdi-minus', { color: C.gray }),
      wicon('Plus', 96 + 66, 44 + 30, 14, 'mdi-plus', { color: C.gray }),
      wlabel('Price', 464, 48, 88, 20, '$129.00', { size: 16, bold: true, align: 'right' })
    ]
    out.push(group('QXShopCartItem', '购物车条目', c, { subcategory: 'GShop' }))
  }

  // Cart summary
  {
    const rows = [['小计（2 件商品）', '$218.00'], ['配送', '$6.90'], ['税费（19%）', '$41.42']]
    const c = [
      wbox('Card', 0, 0, 320, 320, { bg: C.white, radius: 12 }),
      wlabel('Title', 24, 24, 200, 20, '订单汇总', { size: 16, bold: true }),
      ...rows.flatMap((r, i) => [
        wlabel(`RL ${i}`, 24, 60 + i * 28, 200, 16, r[0], { size: 13, color: C.gray }),
        wlabel(`RV ${i}`, 204, 60 + i * 28, 92, 16, r[1], { size: 13, align: 'right' })
      ]),
      hdivider(24, 148, 272),
      wlabel('Total L', 24, 164, 120, 20, '合计', { size: 16, bold: true }),
      wlabel('Total V', 164, 164, 132, 20, '$266.32', { size: 18, bold: true, align: 'right' }),
      wbox('Promo', 24, 200, 180, 38, { bg: C.lighter, radius: 8, borderColor: C.border }),
      wlabel('Promo PH', 36, 211, 140, 16, '优惠码', { size: 13, color: C.grayLight }),
      wbutton('应用', 212, 200, 84, 38, '应用', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 8 }),
      wbutton('结算', 24, 256, 272, 44, '去结算', { radius: 8, bold: true })
    ]
    out.push(group('QXShopSummary', '订单汇总', c, { subcategory: 'GShop' }))
  }

  // Category tiles
  {
    const cats = [['mdi-tshirt-crew', '时尚'], ['mdi-cellphone', '数码'], ['mdi-sofa', '家居生活'], ['mdi-dumbbell', '运动']]
    const c = cats.flatMap((cat, i) => {
      const x = i * 148
      return [
        wbox(`Tile ${i}`, x, 0, 132, 132, { bg: C.white, radius: 12 }),
        wbox(`Ic Bg ${i}`, x + 42, 20, 48, 48, { bg: C.primarySoft, radius: 24, borderColor: C.primarySoft }),
        wicon(`Ic ${i}`, x + 54, 32, 24, cat[0], { color: C.primary }),
        wlabel(`L ${i}`, x, 84, 132, 16, cat[1], { size: 13, bold: true, align: 'center' }),
        wlabel(`S ${i}`, x, 102, 132, 13, '128 件商品', { size: 11, color: C.grayLight, align: 'center' })
      ]
    })
    out.push(group('QXShopCategories', '分类磁贴', c, { subcategory: 'GShop' }))
  }

  // Promo banner
  {
    const c = [
      wbox('Bg', 0, 0, 720, 160, { bg: C.primary, borderColor: C.primary, radius: 12 }),
      wlabel('Eyebrow', 40, 32, 300, 16, '限时活动', { size: 12, color: '#bfdbfe', bold: true }),
      wlabel('Title', 40, 56, 420, 32, '夏日特惠 — 最低 5 折', { size: 26, bold: true, color: C.white }),
      wlabel('Sub', 40, 96, 380, 16, '1 月 31 日截止，售完即止。', { size: 13, color: '#dbeafe' }),
      wbox('Code', 520, 58, 180, 44, { bg: C.white, radius: 8, borderColor: C.white }),
      wlabel('Code L', 520, 64, 180, 16, '使用优惠码', { size: 10, color: C.grayLight, align: 'center', bold: true }),
      wlabel('Code V', 520, 80, 180, 18, 'SUMMER50', { size: 16, bold: true, align: 'center' }),
      wicon('Copy', 664, 104, 16, 'mdi-content-copy', { color: C.white })
    ]
    out.push(group('QXShopPromo', '促销横幅', c, { subcategory: 'GShop' }))
  }

  // Product detail
  {
    const c = [
      ...imagePlaceholder('Main', 0, 0, 360, 360, { radius: 12 }),
      ...imagePlaceholder('T1', 0, 372, 108, 88, { radius: 8 }),
      ...imagePlaceholder('T2', 120, 372, 108, 88, { radius: 8 }),
      ...imagePlaceholder('T3', 240, 372, 108, 88, { radius: 8 }),
      wbox('T Active', 240, 372, 108, 88, { radius: 8, borderColor: C.primary, borderWidth: 2 }),
      wlabel('Cat', 408, 0, 200, 14, '运动鞋', { size: 12, color: C.grayLight }),
      wlabel('Title', 408, 20, 300, 28, 'Runner Pro X1', { size: 24, bold: true }),
      wrating('评分', 408, 56, 110, 20, 4),
      wlabel('Reviews', 526, 60, 160, 14, '4.8（128 条评价）', { size: 12, color: C.grayLight }),
      wlabel('Price', 408, 88, 120, 28, '$129', { size: 24, bold: true }),
      wlabel('Price Old', 492, 96, 60, 16, '$159', { size: 13, color: C.grayLight }),
      ...chip('Save', 556, 92, '省 19%', { bg: C.dangerSoft, color: C.danger }),
      wlabel('Size L', 408, 136, 200, 14, '尺码', { size: 12, color: C.gray, bold: true }),
      wsegment('Sizes', 408, 156, 240, 36, ['40', '41', '42', '43', '44'], '42'),
      wlabel('Color L', 408, 208, 200, 14, '颜色', { size: 12, color: C.gray, bold: true }),
      wbox('Col 1', 408, 228, 28, 28, { bg: '#111827', radius: 14, borderColor: C.primary, borderWidth: 2 }),
      wbox('Col 2', 444, 228, 28, 28, { bg: C.white, radius: 14 }),
      wbox('Col 3', 480, 228, 28, 28, { bg: '#2563eb', radius: 14 }),
      wbox('Col 4', 516, 228, 28, 28, { bg: C.danger, radius: 14 }),
      wlabel('Qty L', 408, 272, 100, 14, '数量', { size: 12, color: C.gray, bold: true }),
      wbox('Qty', 408, 292, 96, 40, { bg: C.white, radius: 8, borderColor: C.border }),
      wicon('Minus', 424, 306, 16, 'mdi-minus', { color: C.gray }),
      wlabel('Qty V', 448, 304, 16, 16, '1', { size: 14, align: 'center', bold: true }),
      wicon('Plus', 472, 306, 16, 'mdi-plus', { color: C.gray }),
      wbutton('添加', 516, 292, 196, 40, '加入购物车', { radius: 8 }),
      wbutton('Buy', 408, 344, 304, 44, '立即购买', { bg: C.dark, borderColor: C.dark, hoverBg: '#000000', radius: 8, bold: true }),
      hdivider(408, 404, 304),
      wlabel('Sku', 408, 420, 120, 14, 'SKU：RPX1-001', { size: 12, color: C.grayLight }),
      wlabel('Ship', 408, 440, 240, 14, '免运费 · 30 天退换', { size: 12, color: C.grayLight })
    ]
    out.push(group('QXShopProductDetail', '商品详情', c, { subcategory: 'GShop' }))
  }

  // Order card
  {
    const c = [
      wbox('Card', 0, 0, 560, 120, { bg: C.white, radius: 12 }),
      wlabel('Id', 24, 20, 160, 18, '订单 #10248', { size: 15, bold: true }),
      wlabel('Date', 24, 42, 200, 14, '2026 年 1 月 12 日 · 3 项', { size: 12, color: C.grayLight }),
      ...chip('状态', 460, 20, '已支付', { bg: C.successSoft, color: C.success }),
      wlabel('Items', 24, 72, 400, 14, 'Runner Pro X1 ×1、经典皮鞋 ×2', { size: 13, color: C.gray }),
      wlabel('合计', 440, 66, 96, 22, '$347.00', { size: 18, bold: true, align: 'right' }),
      wlabel('Action', 452, 92, 84, 14, '查看详情 →', { size: 12, color: C.primary, align: 'right' })
    ]
    out.push(group('QXShopOrder', '订单卡片', c, { subcategory: 'GShop' }))
  }

  // Checkout steps
  {
    const steps = ['购物车', '配送', '支付', '已完成']
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
    out.push(group('QXShopSteps', '结算步骤', c, { subcategory: 'GShop' }))
  }

  // Rating breakdown
  {
    const rows = [[5, 72], [4, 18], [3, 6], [2, 3], [1, 1]]
    const c = [
      wbox('Card', 0, 0, 400, 260, { bg: C.white, radius: 12 }),
      wlabel('Avg', 24, 32, 100, 44, '4.8', { size: 38, bold: true }),
      wrating('Stars', 24, 84, 110, 20, 5),
      wlabel('Count', 24, 110, 140, 14, '128 条评价', { size: 12, color: C.grayLight }),
      ...rows.flatMap((r, i) => [
        wlabel(`SL ${i}`, 160, 30 + i * 40, 14, 15, String(r[0]), { size: 12, color: C.grayLight }),
        wprogress(`SP ${i}`, 182, 35 + i * 40, 150, 8, r[1]),
        wlabel(`SV ${i}`, 344, 30 + i * 40, 36, 15, `${r[1]}%`, { size: 12, color: C.gray, align: 'right' })
      ])
    ]
    out.push(group('QXShopRating', '评分分布', c, { subcategory: 'GShop' }))
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
    out.push(group('QXMobileStatus', '手机状态栏', c, { subcategory: 'HMobile' }))
  }

  // Mobile header
  {
    const c = [
      wicon('Back', 16, 16, 24, 'mdi-arrow-left', { color: C.dark }),
      wlabel('Title', 87, 18, 200, 20, '商品详情', { size: 16, bold: true, align: 'center' }),
      wicon('购物车', 328, 16, 24, 'mdi-cart-outline', { color: C.dark }),
      wbox('Badge', 344, 12, 14, 14, { bg: C.danger, radius: 7, borderColor: C.danger }),
      wlabel('Badge L', 344, 14, 14, 11, '2', { size: 9, color: C.white, align: 'center', bold: true })
    ]
    out.push(group('QXMobileHeader', '手机顶栏', c, { subcategory: 'HMobile' }))
  }

  // Mobile tab bar
  {
    const tabs = [['mdi-home', '首页', true], ['mdi-magnify', '搜索', false], ['mdi-heart-outline', '已保存', false], ['mdi-account', '个人资料', false]]
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
    out.push(group('QXMobileTabBar', '手机标签栏', c, { subcategory: 'HMobile' }))
  }

  // Mobile list
  {
    const rows = [
      ['Anna Müller', '产品设计师', '#dbeafe'],
      ['Peter Simmons', '开发者', '#dcfce7'],
      ['Julia Chen', '研究员', '#fef3c7'],
      ['Maria Silva', '市场', '#fce7f3'],
      ['Klaus Huber', '所有者', '#e0e7ff']
    ]
    const c = [
      wbox('搜索', 16, 0, 343, 40, { bg: C.light, radius: 10, borderColor: C.light }),
      wicon('Search Ic', 28, 12, 18, 'mdi-magnify', { color: C.grayLight }),
      wlabel('Search PH', 54, 12, 240, 16, '搜索联系人', { size: 13, color: C.grayLight }),
      wlabel('Section', 16, 60, 200, 14, '最近', { size: 11, color: C.grayLight, bold: true }),
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
    out.push(group('QXMobileList', '手机列表', c, { subcategory: 'HMobile' }))
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
      ...card(0, '设计评审：Q1 目标', 'Anna Müller · 3 分钟阅读', '设计', C.primary, C.primarySoft),
      ...card(196, 'Sprint 25 复盘', '团队 · 5 分钟阅读', '团队', C.success, C.successSoft)
    ]
    out.push(group('QXMobileCards', '手机文章卡', c, { subcategory: 'HMobile' }))
  }

  // Mobile profile
  {
    const c = [
      wbox('Cover', 0, 0, 375, 140, { bg: C.primarySoft, borderColor: C.primarySoft, radius: 0 }),
      avatar(143, 96, 88, { bg: C.white }),
      wicon('Avatar Ic', 167, 120, 40, 'mdi-account', { color: C.grayLight }),
      wicon('编辑', 328, 16, 20, 'mdi-pencil', { color: C.dark }),
      wlabel('Name', 0, 196, 375, 22, 'Anna Müller', { size: 20, bold: true, align: 'center' }),
      wlabel('Handle', 0, 222, 375, 16, '@annamueller · 产品设计师', { size: 13, color: C.gray, align: 'center' }),
      wlabel('Bio', 48, 248, 280, 36, '设计直觉化产品。咖啡爱好者，现居柏林。', { size: 13, color: C.gray, align: 'center', lineHeight: 1.4 }),
      wlabel('SV1', 80, 296, 60, 20, '142', { size: 17, bold: true, align: 'center' }),
      wlabel('SL1', 80, 318, 60, 13, '帖子', { size: 11, color: C.grayLight, align: 'center' }),
      wlabel('SV2', 158, 296, 60, 20, '8.4k', { size: 17, bold: true, align: 'center' }),
      wlabel('SL2', 158, 318, 60, 13, '粉丝', { size: 11, color: C.grayLight, align: 'center' }),
      wlabel('SV3', 236, 296, 60, 20, '312', { size: 17, bold: true, align: 'center' }),
      wlabel('SL3', 236, 318, 60, 13, '正在关注', { size: 11, color: C.grayLight, align: 'center' }),
      wbutton('关注', 48, 344, 155, 40, '关注', { radius: 999, bold: true }),
      wbutton('消息', 172 + 0, 344, 155, 40, '消息', { bg: C.white, color: C.dark, borderColor: C.border, hoverBg: C.light, radius: 999 }),
      ...imagePlaceholder('G1', 16, 400, 111, 111, { radius: 8 }),
      ...imagePlaceholder('G2', 132, 400, 111, 111, { radius: 8 }),
      ...imagePlaceholder('G3', 248, 400, 111, 111, { radius: 8 })
    ]
    out.push(group('QXMobileProfile', '手机个人页', c, { subcategory: 'HMobile' }))
  }

  // Mobile bottom sheet
  {
    const options = [
      ['mdi-camera', '拍照'],
      ['mdi-image', '从相册选择'],
      ['mdi-file-document-outline', '添加附件'],
      ['mdi-link', '添加链接']
    ]
    const c = [
      wbox('Sheet', 0, 0, 375, 340, { bg: C.white, radius: 16, borderColor: C.border }),
      wbox('Grabber', 160, 12, 56, 4, { bg: C.border, borderColor: C.border, radius: 2 }),
      wlabel('Title', 24, 32, 280, 20, '添加附件', { size: 16, bold: true }),
      wicon('Close', 336, 32, 20, 'mdi-close', { color: C.grayLight }),
      ...options.flatMap((o, i) => {
        const y = 72 + i * 56
        return [
          wbox(`Row ${i}`, 16, y, 343, 48, { bg: C.lighter, radius: 10, borderColor: C.lighter }),
          wicon(`Ic ${i}`, 32, y + 14, 20, o[0], { color: C.primary }),
          wlabel(`L ${i}`, 64, y + 15, 240, 17, o[1], { size: 14 })
        ]
      }),
      wbutton('取消', 16, 288, 343, 40, '取消', { bg: C.light, color: C.gray, borderColor: C.light, radius: 10 })
    ]
    out.push(group('QXMobileSheet', '手机底部弹层', c, { subcategory: 'HMobile' }))
  }

  // Onboarding
  {
    const c = [
      wlabel('跳过', 304, 16, 56, 16, '跳过', { size: 14, color: C.gray, align: 'right' }),
      wbox('Illu Bg', 88, 80, 200, 200, { bg: C.primarySoft, radius: 100, borderColor: C.primarySoft }),
      wicon('Illu', 148, 140, 80, 'mdi-vector-square', { color: C.primary, factor: 2 }),
      wlabel('Title', 40, 320, 296, 26, '轻松设计', { size: 22, bold: true, align: 'center' }),
      wlabel('Text', 48, 356, 280, 44, '用智能组件和模板，几分钟创建精美原型。', { size: 14, color: C.gray, align: 'center', lineHeight: 1.5 }),
      wbox('D1', 168, 424, 8, 8, { bg: C.primary, radius: 4, borderColor: C.primary }),
      wbox('D2', 184, 424, 8, 8, { bg: C.border, radius: 4, borderColor: C.border }),
      wbox('D3', 200, 424, 8, 8, { bg: C.border, radius: 4, borderColor: C.border }),
      wbutton('Next', 48, 460, 280, 48, '开始使用', { radius: 999, bold: true })
    ]
    out.push(group('QXMobileOnboarding', '引导页', c, { subcategory: 'HMobile' }))
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

  card('QXChartBar', '图表卡片', '周收入', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['4'], ['6'], ['5'], ['8'], ['7'], ['9'], ['12']])
  ])

  card('QXChartBar2', '双系列图表卡', '注册 vs 升级', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['4', '1'], ['6', '2'], ['5', '2'], ['8', '3'], ['7', '3'], ['9', '4'], ['12', '5']])
  ])

  card('QXChartLine', '折线图卡片', '活跃用户', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['12'], ['18'], ['15'], ['22'], ['28'], ['25'], ['34']], { line: true })
  ])

  card('QXChartHorizontal', '横向条形图卡', '热门页面', (x, y) => [
    wbar('Chart', x, y, 312, 160, [['/home', '840'], ['/pricing', '520'], ['/docs', '380'], ['/blog', '260'], ['/about', '140']], { horizontal: true })
  ])

  card('QXChartPie', '饼图卡片', '设备分布', (x, y) => [
    wpie('Chart', x + 60, y, 160, 160, [45, 30, 25]),
    dot(x + 20, y + 16, C.primary), wlabel('L1', x + 34, y + 12, 80, 14, '桌面端', { size: 11 }),
    dot(x + 20, y + 40, C.success), wlabel('L2', x + 34, y + 36, 80, 14, '移动端', { size: 11 }),
    dot(x + 20, y + 64, C.warning), wlabel('L3', x + 34, y + 60, 80, 14, '平板', { size: 11 })
  ])

  card('QXChartRing', '环形图卡片', '目标完成率', (x, y) => [
    wring('Chart', x + 60, y, 160, 160, 68),
    wlabel('Value', x + 116, y + 66, 48, 26, '68%', { size: 20, bold: true, align: 'center' }),
    wlabel('Sub', x, y + 166, 312, 14, '1,020 / 1,500 次会话', { size: 11, color: C.grayLight, align: 'center' })
  ])

  card('QXChartLegend', '带图例图表卡', '各地区收入', (x, y) => [
    wbar('Chart', x, y, 312, 120, [['4', '2'], ['6', '3'], ['5', '2'], ['8', '4'], ['7', '3']]),
    ...[['#2563eb', '欧洲/中东/非洲'], ['#93c5fd', '美洲'], ['#10b981', '亚太']].flatMap((l, i) => [
      dot(x + 60 + i * 80, y + 136, l[0]),
      wlabel(`L ${i}`, x + 74 + i * 80, y + 132, 60, 14, l[1], { size: 11, color: C.gray })
    ])
  ])

  card('QXChartSpark', '迷你图表卡', '今日访问', (x, y) => [
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
