<template>
    <div
        class="MatcToolbarItem MatcToolbarPrimaryItem MatcToolbarIconButton MatcComponentPanelToggle"
        :class="{'MatcToolbarItemSelected': active}"
        @click.stop="onClick">
        <QIcon icon="Component" :tooltip="getNLS('tooltip.componentPanel')" attachToParent />
    </div>
</template>
<script>
import NLS from 'common/NLS'
import QIcon from 'page/QIcon'

export default {
    name: 'ComponentPanelToggle',
    mixins: [NLS],
    props: ['active'],
    components: {
        'QIcon': QIcon
    },
    methods: {
        onClick () {
            this.$emit('click')
        }
    }
}
</script>
