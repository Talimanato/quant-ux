<template>
    <div
        class="MatcComponentPanelCategory"
        :class="{'MatcComponentPanelCategorySelected': selected}"
        @click.stop="onClick"
        :title="name">
        <i :class="['MatcComponentPanelCategoryIcon', icon]"></i>
        <span class="MatcComponentPanelCategoryLabel">{{name}}</span>
    </div>
</template>
<script>
import { getCategoryIcon, getCategoryName } from './ComponentData'

export default {
    name: 'ComponentPanelCategory',
    props: ['category', 'selected'],
    computed: {
        name () {
            return getCategoryName(this.category)
        },
        icon () {
            return getCategoryIcon(this.category)
        }
    },
    methods: {
        onClick () {
            this.$emit('select', this.category)
        }
    }
}
</script>
