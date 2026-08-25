// eslint-disable-next-line
<template>
	<div class="VommondCheckBoxWrapper">
		<div class="VommondCheckBox">
			<span class="VommondCheckBoxHook" data-dojo-attach-point="hook">
			</span>
		</div>
		<span class="VommondCheckBoxLabel" v-if="internalLabel">{{internalLabel}}</span>
	</div>
</template>

<style lang="scss">
 @import '../style/vommond.scss';
</style>

<script>
import DojoWidget from 'dojo/DojoWidget'
import css from 'dojo/css'
import touch from 'dojo/touch'
import lang from 'dojo/_base/lang'
import on from 'dojo/on'
import Logger from 'common/Logger'

export default {
  name: 'CheckBox',
  mixins: [DojoWidget],
  data: function () {
    return {
      checked: false,
      internalLabel: ''
    }
  },
  props: ['label', 'value'],
  components: {
  },
  methods: {
		postCreate (){
			this.log = new Logger('CheckBox')
			this.own(on(this.domNode, touch.press, lang.hitch(this, "onChange")));
			if(this.value || this.value === "true"){
				this.setValue(true);
			}
		},

		getValue (){
			return this.checked;
		},

		setValue (value){
			this.checked = value;
			if(value){
				css.add(this.domNode,"VommondCheckBoxChecked") ;
			} else {
				css.remove(this.domNode,"VommondCheckBoxChecked") ;
			}
		},

		setLabel (l){
			this.internalLabel = l
		},

		onChange (e){
			this.stopEvent(e)
			this.setValue(!this.checked);
			this.$emitDojo("change", this.checked );
			this.$emitDojo("input", this.checked );
		}
  },
  watch: {
		value (v) {
			this.setValue(v)
		}
  },
  mounted () {
      this.internalLabel = this.label || ''
      this.log.log(10, 'mounted', 'enter')
  }
}
</script>
