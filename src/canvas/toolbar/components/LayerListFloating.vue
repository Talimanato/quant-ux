<template>
    <div
        class="MatcLayerListFloating"
        v-show="visible"
        :style="style"
        :aria-hidden="!visible">
        <div class="MatcLayerListFloatingHeader" @mousedown.stop="onDragStart">
            <i class="MatcLayerListFloatingDragHandle mdi mdi-drag"></i>
            <span class="MatcLayerListFloatingTitle">{{getNLS('toolbar.floatingLayer.title')}}</span>
            <div class="MatcLayerListFloatingActions">
                <button
                    class="MatcLayerListFloatingAction MatcLayerListFloatingToggle"
                    :class="{'mdi': true, 'mdi-chevron-up': !collapsed, 'mdi-chevron-down': collapsed}"
                    @mousedown.stop
                    @click.stop="onToggle"
                    :title="getNLS('toolbar.floatingLayer.toggle')">
                </button>
                <button
                    class="MatcLayerListFloatingAction MatcLayerListFloatingClose mdi mdi-close"
                    @mousedown.stop
                    @click.stop="onClose"
                    :title="getNLS('btn.close')">
                </button>
            </div>
        </div>
        <div class="MatcLayerListFloatingContent" v-show="!collapsed" ref="content">
        </div>
        <div class="MatcLayerListFloatingResize" @mousedown.stop="onResizeStart" v-if="!collapsed"></div>
    </div>
</template>
<script>
import NLS from 'common/NLS'
import {onStartDND} from '../../../util/DND'

const STORAGE_KEY = 'quxLayerFloating'

export default {
    name: 'LayerListFloating',
    mixins: [NLS],
    data: function () {
        return {
            visible: false,
            /**
             * Collapsed by default so the floating window does not cover
             * the canvas on first use. The state is persisted in save().
             */
            collapsed: true,
            x: 0,
            y: 64,
            w: 272,
            h: 0,
            layerList: null
        }
    },
    computed: {
        style () {
            return {
                position: 'fixed',
                top: this.y + 'px',
                left: this.x + 'px',
                width: this.w + 'px',
                height: this.collapsed ? '40px' : this.h + 'px'
            }
        }
    },
    methods: {
        setLayerList (layerList) {
            if (this.layerList && this.layerList.$el && this.layerList.$el.parentNode) {
                this.layerList.$el.parentNode.removeChild(this.layerList.$el)
            }
            this.layerList = layerList
            if (this.layerList && this.$refs.content) {
                this.$refs.content.appendChild(this.layerList.$el)
            }
            this.visible = true
        },
        setVisible (v) {
            this.visible = v
            if (v && this.h === 0) {
                this.h = Math.round(window.innerHeight * 0.7)
            }
        },
        onClose () {
            this.visible = false
            this.$emit('close')
        },
        onToggle () {
            this.collapsed = !this.collapsed
            this.save()
        },
        onDragStart (e) {
            const pos = this.$el.getBoundingClientRect()
            const start = { x: pos.left, y: pos.top }
            onStartDND(e, d => {
                const x = start.x + d.x
                const y = start.y + d.y
                this.x = Math.max(0, Math.min(window.innerWidth - 60, x))
                this.y = Math.max(48, Math.min(window.innerHeight - 60, y))
            }, () => {
                this.save()
            })
        },
        onResizeStart (e) {
            const start = { w: this.w, h: this.h }
            const minW = 220
            const maxW = 400
            const minH = 240
            const maxH = Math.round(window.innerHeight * 0.8)
            onStartDND(e, d => {
                this.w = Math.min(Math.max(minW, start.w + d.x), maxW)
                this.h = Math.min(Math.max(minH, start.h + d.y), maxH)
            }, () => {
                this.save()
            })
        },
        save () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    x: this.x,
                    y: this.y,
                    w: this.w,
                    h: this.h,
                    collapsed: this.collapsed
                }))
            } catch (err) {
                console.warn('LayerListFloating.save() > Error', err)
            }
        },
        load () {
            try {
                const raw = localStorage.getItem(STORAGE_KEY)
                if (raw) {
                    const v = JSON.parse(raw)
                    if (v && v.w && !isNaN(v.w * 1)) {
                        this.x = v.x
                        this.y = v.y
                        this.w = v.w
                        this.h = v.h
                        if (v.collapsed === true || v.collapsed === false) {
                            this.collapsed = v.collapsed
                        }
                        return
                    }
                }
            } catch (err) {
                console.warn('LayerListFloating.load() > Error', err)
            }
            this.setDefaultPosition()
        },
        setDefaultPosition () {
            const vw = window.innerWidth
            this.w = 272
            this.h = Math.round(window.innerHeight * 0.7)
            this.x = Math.max(280, vw - 246 - this.w)
            this.y = 64
        }
    },
    mounted () {
        this.load()
    }
}
</script>
