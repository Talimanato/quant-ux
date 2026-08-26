<template>
    <div
        class="MatcToolbarItem MatcToolbarPrimaryItem MatcToolbarIconButton MatcLayerTreeToggle"
        :class="{'MatcToolbarItemSelected': active}"
        @click.stop="onClick">
        <QIcon icon="Layer" :tooltip="getNLS('tooltip.layerTree')" attachToParent />
    </div>
</template>
<script>
import NLS from 'common/NLS'
import QIcon from 'page/QIcon'

export default {
    name: 'LayerTreeToggle',
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
