<script>
import on from 'dojo/on'
import lang from 'dojo/_base/lang'
import css from 'dojo/css'
import { setDefaultValues, COMPONENT_MIME } from 'canvas/toolbar/components/ComponentData'

/**
 * Handles HTML5 drag & drop from the ComponentPanel onto the canvas.
 * The panel items set a custom mime type so we can distinguish them
 * from file drops (Upload) and layer tree reorder drags.
 */
export default {
	name: 'ComponentDrop',
	data: function () {
		return {
			componentDropMinSize: { w: 40, h: 20 }
		}
	},
	methods: {

		initComponentDrop () {
			this._componentDragItem = null
			/**
			 * Register BEFORE initUpload() is called so we can intercept
			 * component drags with stopImmediatePropagation() and the
			 * upload DnD does not show its drop hint.
			 */
			this.own(on(this.domNode, 'dragenter', lang.hitch(this, 'onComponentDragEnter')))
			this.own(on(this.domNode, 'dragover', lang.hitch(this, 'onComponentDragOver')))
			this.own(on(this.domNode, 'dragleave', lang.hitch(this, 'onComponentDragLeave')))
			this.own(on(this.domNode, 'drop', lang.hitch(this, 'onComponentDrop')))
		},

		/**
		 * Called by Design.vue when a component panel item drag starts
		 * or ends. The payload is passed outside of dataTransfer because
		 * dataTransfer.getData() is protected during dragover.
		 */
		setComponentDragItem (item) {
			this._componentDragItem = item
			if (!item) {
				this.cleanUpComponentDrop()
			}
		},

		isComponentDrag (e) {
			if (e && e.dataTransfer && e.dataTransfer.types) {
				const types = e.dataTransfer.types
				for (let i = 0; i < types.length; i++) {
					if (types[i] === COMPONENT_MIME) {
						return true
					}
				}
			}
			return false
		},

		stopComponentDragEvent (e) {
			if (e.preventDefault) {
				e.preventDefault()
			}
			/**
			 * Block the upload DnD handlers that are registered
			 * after ours on the same node.
			 */
			if (e.stopImmediatePropagation) {
				e.stopImmediatePropagation()
			}
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy'
			}
		},

		onComponentDragEnter (e) {
			if (!this.isComponentDrag(e)) {
				return
			}
			this.stopComponentDragEvent(e)
		},

		onComponentDragOver (e) {
			if (!this.isComponentDrag(e)) {
				return
			}
			this.stopComponentDragEvent(e)

			const item = this._componentDragItem
			if (!item || !this.model) {
				return
			}
			const box = this.getComponentDropBox(item, e)
			this.updateComponentDropBox(box)
		},

		onComponentDragLeave (e) {
			if (!this.isComponentDrag(e)) {
				return
			}
			/**
			 * dragleave also fires when the pointer crosses child nodes.
			 * Only clean up when we really leave the canvas.
			 */
			if (e.relatedTarget && this.domNode && this.domNode.contains && this.domNode.contains(e.relatedTarget)) {
				return
			}
			this.cleanUpComponentDrop()
		},

		onComponentDrop (e) {
			if (!this.isComponentDrag(e)) {
				return false
			}
			this.stopComponentDragEvent(e)

			let item = this._getDroppedComponentItem(e)
			if (!item || !this.model || !this.controller) {
				this.cleanUpComponentDrop()
				return false
			}

			/**
			 * Compute the snapped position before the clean up removes
			 * the alignment tool.
			 */
			const box = this.getComponentDropBox(item, e)
			this.cleanUpComponentDrop()

			const w = this.getZoomed(this.canvasPos.w, this.zoom)
			const h = this.getZoomed(this.canvasPos.h, this.zoom)
			if (box.x <= 0 || box.y <= 0 || box.x >= w || box.y >= h) {
				this.logger.log(-1, 'onComponentDrop', 'not placed in canvas', box)
				this.showError('Please place the element in the canvas')
				return false
			}

			this.dispatchComponentItem(item, box)
			return false
		},

		_getDroppedComponentItem (e) {
			try {
				const data = e.dataTransfer.getData(COMPONENT_MIME) || e.dataTransfer.getData('text/plain')
				if (data) {
					return JSON.parse(data)
				}
			} catch (err) {
				this.logger.log(-1, '_getDroppedComponentItem', 'parse error', err)
			}
			return this._componentDragItem
		},

		/**
		 * Returns the zoomed drop box (centered under the cursor and
		 * snapped to the grid / other widgets).
		 */
		getComponentDropBox (item, e) {
			const size = this.getComponentItemSize(item)
			const z = this.getZoomFactor()
			const zw = this.getZoomed(size.w, z)
			const zh = this.getZoomed(size.h, z)

			let pos = this.getCanvasMousePosition(e)
			pos.w = zw
			pos.h = zh
			pos.x -= Math.round(zw / 2)
			pos.y -= Math.round(zh / 2)

			if (!this._componentAlignmentInited) {
				this.alignmentStart(this.getComponentAlignmentType(item), pos, 'All')
				this._componentAlignmentInited = true
			}
			pos = this.allignPosition(pos, e)
			return pos
		},

		getComponentAlignmentType (item) {
			if (item._type === 'Screen') {
				return 'screen'
			}
			if (item._type === 'Group' || item._type === 'ScreenAndWidget') {
				return 'boundingbox'
			}
			return 'widget'
		},

		getComponentItemSize (item) {
			/**
			 * Theme sizes can be design token references ('@box-width-l')
			 * that only the QSS render pipeline can resolve. Treat them as
			 * unknown here so the ghost falls back to a sane default.
			 */
			const toNumber = v => {
				const n = Number(v)
				return isFinite(n) && n > 0 ? n : null
			}
			let w = toNumber(item.w)
			let h = toNumber(item.h)
			if ((!w || !h) && item.children && item.children.length > 0) {
				const bb = this.getBoundingBoxByBoxes(item.children)
				if (!w) {
					w = toNumber(bb.w)
				}
				if (!h) {
					h = toNumber(bb.h)
				}
			}
			return {
				w: Math.max(this.componentDropMinSize.w, w || 100),
				h: Math.max(this.componentDropMinSize.h, h || 40)
			}
		},

		updateComponentDropBox (box) {
			if (!this._componentDropNode) {
				const div = document.createElement('div')
				css.add(div, 'MatcComponentDropTarget')
				this.dndContainer.appendChild(div)
				this._componentDropNode = div
			}
			this._componentDropNode.style.width = Math.round(box.w) + 'px'
			this._componentDropNode.style.height = Math.round(box.h) + 'px'
			this.domUtil.setPos(this._componentDropNode, box)
		},

		cleanUpComponentDrop () {
			if (this._componentDropNode && this._componentDropNode.parentNode) {
				this._componentDropNode.parentNode.removeChild(this._componentDropNode)
			}
			this._componentDropNode = null
			if (this._componentAlignmentInited) {
				this.cleanUpAlignment()
				this._componentAlignmentInited = false
			}
		},

		/**
		 * Places a cloned item at the passed zoomed position. The dispatch
		 * mirrors Toolbar.onNewThemeObject() + the canvas Add callbacks,
		 * but places directly instead of starting the mouse DnD ghost.
		 */
		dispatchComponentItem (item, pos) {
			const obj = lang.clone(item)
			setDefaultValues(obj, this.model.screenSize)

			const isTemplate = obj._isTemplate === true
			const type = obj._type || obj.templateType

			delete obj._extends
			delete obj._type
			delete obj._group
			delete obj.category
			delete obj.subcategory
			delete obj._previewSize
			delete obj._isTemplate

			this.logger.log(0, 'dispatchComponentItem', 'enter', type, isTemplate)

			if (isTemplate && this.factory) {
				const model = this.factory.createTemplatedModel({ id: item.id })
				if (!model) {
					this.showError('No template with id ' + item.id)
					return
				}
				if (type === 'Group') {
					this.controller.addGroupByTemplate(model, pos)
				} else {
					this.addDroppedWidget(model, pos)
				}
				return
			}

			if (type === 'Screen') {
				this.controller.addScreen(obj, pos)
			} else if (type === 'Group') {
				this.controller.addGroupByTheme(obj, pos)
			} else if (type === 'ScreenAndWidget') {
				this.controller.addScreensAndWidgets(obj, pos)
			} else {
				this.addDroppedWidget(obj, pos)
			}
		},

		addDroppedWidget (model, pos) {
			const widget = this.controller.addWidget(model, pos)
			if (widget) {
				requestAnimationFrame(() => {
					this.onWidgetSelected(widget.id, true)
				})
			}
		},

		/**
		 * Click on a panel item: place the component in the center of the
		 * selected (or first) screen.
		 */
		addComponentAt (item) {
			if (!item || !this.model || !this.controller) {
				return
			}
			const size = this.getComponentItemSize(item)

			let screen = null
			if (this.getSelectedScreen) {
				screen = this.getSelectedScreen()
			}
			if (!screen) {
				const screens = Object.values(this.model.screens)
				if (screens.length > 0) {
					screen = screens[0]
				}
			}

			let x = 50
			let y = 50
			if (screen) {
				x = screen.x + Math.max(16, Math.round((screen.w - size.w) / 2))
				y = screen.y + Math.max(16, Math.round((screen.h - size.h) / 2))
			}

			const z = this.getZoomFactor()
			const pos = {
				x: this.getZoomed(x, z),
				y: this.getZoomed(y, z),
				w: this.getZoomed(size.w, z),
				h: this.getZoomed(size.h, z)
			}
			this.dispatchComponentItem(item, pos)
		}
	}
}
</script>
