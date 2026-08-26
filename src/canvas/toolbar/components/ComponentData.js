import lang from 'dojo/_base/lang'
import SymbolService from 'services/SymbolService'

export const CATEGORY_ORDER = ['WireFrame', 'Advanced', 'Composite', 'Survey', 'Material', 'IOS', 'Charts']

export const CATEGORY_NAMES = {
    'WireFrame': 'Wireframe',
    'Advanced': 'Advanced',
    'Composite': 'Templates',
    'Survey': 'Survey',
    'Material': 'Material',
    'IOS': 'iOS',
    'Charts': 'Charts',
    'Template': 'My Components'
}

export const CATEGORY_ICONS = {
    'WireFrame': 'mdi mdi-vector-square',
    'Advanced': 'mdi mdi-cube-scan',
    'Composite': 'mdi mdi-view-grid',
    'Survey': 'mdi mdi-form-select',
    'Material': 'mdi mdi-material-design',
    'IOS': 'mdi mdi-apple',
    'Charts': 'mdi mdi-chart-bar',
    'Template': 'mdi mdi-cube'
}

export const COMPONENT_MIME = 'application/qux-component'

const COMPONENT_ICONS = {
    'Button': 'mdi mdi-gesture-tap-button',
    'Label': 'mdi mdi-format-title',
    'TextBox': 'mdi mdi-form-textbox',
    'TextArea': 'mdi mdi-form-textarea',
    'CheckBox': 'mdi mdi-checkbox-marked-outline',
    'CheckBoxGroup': 'mdi mdi-checkbox-multiple-marked-outline',
    'RadioBox': 'mdi mdi-radiobox-marked',
    'RadioGroup': 'mdi mdi-radiobox-multiple-marked',
    'DropDown': 'mdi mdi-menu-down',
    'Slider': 'mdi mdi-tune',
    'Switch': 'mdi mdi-toggle-switch-outline',
    'Stepper': 'mdi mdi-numeric',
    'Icon': 'mdi mdi-emoticon-outline',
    'SVGIcon': 'mdi mdi-svg',
    'Image': 'mdi mdi-image-outline',
    'Box': 'mdi mdi-crop-square',
    'ScreenAndWidget': 'mdi mdi-crop-landscape',
    'Group': 'mdi mdi-vector-union',
    'Chart': 'mdi mdi-chart-bar',
    'Table': 'mdi mdi-table',
    'Tab': 'mdi mdi-tab',
    'Tree': 'mdi mdi-file-tree',
    'Repeater': 'mdi mdi-view-list',
    'Upload': 'mdi mdi-upload',
    'UploadPreview': 'mdi mdi-image-search',
    'Camera': 'mdi mdi-camera',
    'ProgressBar': 'mdi mdi-timer-sand',
    'RingChart': 'mdi mdi-chart-donut',
    'Pie': 'mdi mdi-chart-pie',
    'Bar': 'mdi mdi-chart-bar',
    'Legend': 'mdi mdi-chart-legend',
    'GridContainer': 'mdi mdi-grid-large',
    'AudioLogic': 'mdi mdi-volume-high',
    'AudioPlayer': 'mdi mdi-volume-high',
    'Script': 'mdi mdi-script',
    'Rest': 'mdi mdi-web',
    'LogicOr': 'mdi mdi-math-integral',
    'LogicAnd': 'mdi mdi-math-integral',
    'LogicAB': 'mdi mdi-call-split',
    'Hotspot': 'mdi mdi-cursor-default-click-outline',
    'Vector': 'mdi mdi-vector-curve',
    'SVGPaths': 'mdi mdi-vector-combine',
    'SegmentButton': 'mdi mdi-segmented',
    'IconToggleButton': 'mdi mdi-toggle-switch',
    'IconButton': 'mdi mdi-gesture-tap-button',
    'Paging': 'mdi mdi-page-next',
    'ImagePaging': 'mdi mdi-page-next',
    'TimeSpinner': 'mdi mdi-clock',
    'TypeAhead': 'mdi mdi-format-list-bulleted',
    'Volume': 'mdi mdi-volume-medium',
    'NavBar': 'mdi mdi-page-layout-header',
    'NavMenu': 'mdi mdi-menu',
    'GeoLocation': 'mdi mdi-map-marker',
    'ImageGrid': 'mdi mdi-view-grid',
    'iFrame': 'mdi mdi-application',
    'Card': 'mdi mdi-card-outline',
    'Dropbox': 'mdi mdi-dropbox',
    'LockSlider': 'mdi mdi-lock-open',
    'VisualPicker': 'mdi mdi-eye-outline',
    'CountingStepper': 'mdi mdi-numeric',
    'ScreenSegment': 'mdi mdi-crop-landscape',
    'WebLink': 'mdi mdi-link'
}

export function getCategoryName (category) {
    return CATEGORY_NAMES[category] || category
}

export function getCategoryIcon (category) {
    return CATEGORY_ICONS[category] || 'mdi mdi-cube'
}

export function getComponentIcon (child) {
    if (child && child.style && child.style.icon) {
        return child.style.icon
    }
    if (child._isTemplate) {
        return 'mdi mdi-cube'
    }
    if (child.type === 'Group' || child._type === 'Group') {
        return 'mdi mdi-vector-union'
    }
    if (child.type === 'ScreenAndWidget') {
        return 'mdi mdi-crop-landscape'
    }
    return COMPONENT_ICONS[child.type] || 'mdi mdi-crop-square'
}

/**
 * Resolves placeholders like $screenwidth, $25% etc. that are used in the
 * theme JSON files. This is a shared helper also used by CreateButton.
 */
export function setDefaultValues (box, screenSize) {
    if (!box || !screenSize) {
        return
    }

    if (box.w === '$screenwidth') {
        box.w = screenSize.w
    }
    if (box.h === '$screenheight') {
        box.h = screenSize.h
    }

    if (typeof box.w === 'string' && box.w.indexOf('%') > 0) {
        const pct = parseInt(box.w.replace('%', '').replace('$', '')) / 100
        if (!isNaN(pct)) {
            box.w = Math.round(screenSize.w * pct)
        }
    }

    if (typeof box.h === 'string' && box.h.indexOf('%') > 0) {
        const pct = parseInt(box.h.replace('%', '').replace('$', '')) / 100
        if (!isNaN(pct)) {
            box.h = Math.round(screenSize.h * pct)
        }
    }

    if (box.children) {
        box.children.forEach(child => setDefaultValues(child, screenSize))
    }
    if (box.screens) {
        for (let id in box.screens) {
            setDefaultValues(box.screens[id], screenSize)
        }
    }
    if (box.widgets) {
        for (let id in box.widgets) {
            setDefaultValues(box.widgets[id], screenSize)
        }
    }
}

/**
 * Merges theme objects with their parent objects referenced by _extends.
 * This mirrors the logic in CreateButton.onThemesLoaded() so the same
 * data can be reused by the component panel and other future consumers.
 */
export function mergeThemeExtensions (categories, temp) {
    for (let id in temp) {
        const theme = temp[id]
        if (theme._extends) {
            const parent = temp[theme._extends]
            if (parent) {
                const merged = lang.mixin(lang.clone(parent), theme)
                merged.props = lang.mixin(lang.clone(parent.props || {}), theme.props || {})
                merged.style = lang.mixin(lang.clone(parent.style || {}), theme.style || {})
                merged.has = lang.mixin(lang.clone(parent.has || {}), theme.has || {})
                if (parent._preview) {
                    merged._preview = lang.mixin(lang.clone(parent._preview), theme._preview || {})
                }
                if (parent.error) {
                    merged.error = lang.mixin(lang.clone(parent.error), theme.error || {})
                }
                if (parent.focus) {
                    merged.focus = lang.mixin(lang.clone(parent.focus), theme.focus || {})
                }
                if (parent.hover) {
                    merged.hover = lang.mixin(lang.clone(parent.hover), theme.hover || {})
                }
                if (parent.checked) {
                    merged.checked = lang.mixin(lang.clone(parent.checked), theme.checked || {})
                }

                const cat = merged.category || theme.category
                if (categories[cat]) {
                    categories[cat][id] = merged
                }
                temp[id] = merged
            }
        }
    }
    return categories
}

/**
 * Groups the raw core themes into a map of categories.
 */
export function groupCoreThemes (themes, screenSize) {
    const categories = {}
    const temp = {}

    if (!themes) {
        return categories
    }

    for (let i = 0; i < themes.length; i++) {
        const theme = themes[i]
        if (!theme || !theme.id) {
            continue
        }
        const category = theme.category
        if (!category) {
            continue
        }
        if (!categories[category]) {
            categories[category] = {}
        }
        if (!categories[category][theme.id]) {
            const clone = lang.clone(theme)
            setDefaultValues(clone, screenSize)
            categories[category][theme.id] = clone
            temp[theme.id] = clone
        }
    }

    return mergeThemeExtensions(categories, temp)
}

/**
 * Converts the model templates into component panel elements.
 */
export function getTemplateElements (model) {
    const elements = []
    if (model && model.templates) {
        for (let tid in model.templates) {
            let t = model.templates[tid]
            if (t.visible) {
                t = lang.clone(t)
                t._type = t.templateType
                t._isTemplate = true
                t.category = 'Template'
                elements.push(t)
            }
        }
    }
    return elements
}

/**
 * Loads all component data needed for the component panel: core themes
 * from SymbolService and the model's templates.
 */
export async function loadComponentData (model) {
    const themes = await SymbolService.getCore()
    const screenSize = model ? model.screenSize : { w: 375, h: 667 }
    const categories = groupCoreThemes(themes, screenSize)

    const templates = getTemplateElements(model)
    if (templates.length > 0) {
        categories['Template'] = {}
        templates.forEach(t => {
            categories['Template'][t.id] = t
        })
    }

    return categories
}
