
<template>
     <div class="MatcToolbarSelector">	
        <a :class="['MatcToolbarItem MatcToolbarToggleButton', {'MatcToolbarItemActive' : o.value == value}]" v-for="o in visibleOptions" :key="o.value" @click="onChange(o.value)">
            
            <QIcon :icon="o.icon " v-if="o.icon"></QIcon>
            <span v-if="o.label">{{ o.label }}</span>
        
        </a>
        
	</div>
</template>


<script>
import DojoWidget from 'dojo/DojoWidget'
import _Tooltip from 'common/_Tooltip'
import QIcon from 'page/QIcon'

export default {
    name: 'ToolbarSelector',
    mixins:[_Tooltip, DojoWidget],
    props: ['options', 'selected'],
    data: function () {
        return {
            value: false,
            allOptions: [],
            hidden: {}
        }
    },
    components: {
		'QIcon':QIcon
	},
    computed: {
        visibleOptions () {
            return this.allOptions.filter(o => this.hidden[o.value] !== true)
        }
    },
    methods: {
		setOptions (list){
            this.allOptions = list || []
		},

		setValue (value){
			this.value = value;
		},
		
		hideOption (value){
			this.hidden[value] = true
		},
		
		showOption (value){
			this.hidden[value] = false
		},
		
		getValue (){
			return this.value;
		},
		
		
		onChange (value){
			this.setValue(value);
			this.$emitDojo("change", value);
		}
    }, 
    mounted () {
		if (this.options) {
			this.setOptions(this.options)
		}
		if (this.selected) {
			this.setValue(this.selected)
		}
    }
}
</script>
