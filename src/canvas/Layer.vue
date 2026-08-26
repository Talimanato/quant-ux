<script>
import LayerList from 'canvas/toolbar/LayerList'

export default {
    name: 'Layer',
	data: function () {
        return {
			layerListWidth: 256,
			floatingLayerList: null
        }
    },
    methods: {
    	initLayer (){
			this.logger.log(2,"initLayer", "entry");
			const w = localStorage.getItem('quxLayerListWidth')
			if (w && !isNaN(w * 1)) {
				this.setLayerListWidth( w * 1)				
			}
			try{
				if (this.getSettings().layerListVisible){
					this.buildLayerList()
				}
			} catch (e){
				this.logger.error('initLayer', 'Could not build layer list', e)
			}
		},

		setLayerListWidth(w) {
			this.layerListWidth = w
			if (this.toolbar) {
				this.toolbar.setLayerListWidth(w)
			}
		},

		setFloatingLayerListContainer (container){
			this.floatingLayerList = container
		},

		setLayerVisibility (v){
			this.logger.log(-1,"setLayerVisibility", "enter", v);
			delete this.selectionListener;
			if (v){
				this.buildLayerList();
			}
			if (this.floatingLayerList){
				this.floatingLayerList.setVisible(v)
			}
			this.setSettings({layerListVisible: v})
		},

		buildLayerList (){
			if (!this.layerList) {
				this.layerList = this.$new(LayerList, {layerListWidth: this.layerListWidth});
				if (this.toolbar && this.controller){
					this.layerList.setToolbar(this.toolbar);
					this.layerList.setController(this.controller);
					this.layerList.setCanvas(this);
					this.layerList.on("onWidthChange", width => this.onChangeLayerListWidth(width))
				} else {
					this.logger.log(-1,"buildLayerList", "no toolbar", this); // expect in init
				}
			}
			if (this.floatingLayerList){
				this.floatingLayerList.setLayerList(this.layerList)
			}
			this.selectionListener = this.layerList;
		},

		onChangeLayerListWidth(width) {
			this.logger.log(2,"onChangeLayerListWidth", "enter", width);
			localStorage.setItem('quxLayerListWidth', this.layerListWidth)
			this.setLayerListWidth(width)	
		},

		renderLayerList (model){
			if (this.layerList){
				requestAnimationFrame(() => {
					this.layerList.render(model);
				})
			}
		}
    },
    mounted () {
    }
}
</script>
