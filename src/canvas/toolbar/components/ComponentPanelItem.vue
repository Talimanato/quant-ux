<template>
    <div
        class="MatcComponentPanelItem"
        :class="{
            'MatcComponentPanelItemSelected': selected,
            'MatcComponentPanelItemDragging': dragging
        }"
        :draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @click.stop="onClick">
        <i :class="['MatcComponentPanelItemIcon', icon]"></i>
        <span class="MatcComponentPanelItemLabel">{{label}}</span>
    </div>
</template>
<script>
import { getComponentIcon, COMPONENT_MIME } from './ComponentData'

export default {
    name: 'ComponentPanelItem',
    props: ['item', 'selected'],
    /**
     * Without this declaration the parent @dragstart listener would also
     * fall through as a NATIVE dragstart listener on the root element and
     * forward the raw DragEvent up the chain, overwriting the dragged
     * item passed via $emit.
     */
    emits: ['select', 'dragstart', 'dragend'],
    data () {
        return {
            dragging: false
        }
    },
    computed: {
        label () {
            if (this.item && this.item.name) {
                return this.item.name
            }
            return ''
        },
        icon () {
            if (this.item) {
                return getComponentIcon(this.item)
            }
            return 'mdi mdi-crop-square'
        }
    },
    methods: {
        onClick () {
            this.$emit('select', this.item)
        },
        onDragStart (e) {
            if (e && e.dataTransfer) {
                try {
                    const data = JSON.stringify(this.item)
                    e.dataTransfer.setData(COMPONENT_MIME, data)
                    e.dataTransfer.setData('text/plain', data)
                } catch (err) {
                    console.warn('ComponentPanelItem.onDragStart() > Could not set drag data', err)
                }
                e.dataTransfer.effectAllowed = 'copy'
            }
            this.$emit('dragstart', this.item)
            this.dragging = true
        },
        onDragEnd () {
            this.dragging = false
            this.$emit('dragend', this.item)
        }
    }
}
</script>
