<template>
  <ZoomDialog ref="dialog">
    <div class="MatcDialog MatcResizeDialog">

      <h2 class="title">{{ $t('ui.prototype.title') }}</h2>

      <div class="form-group">
        <label>{{ $t('ui.prototype.name') }}</label>
        <input type="text" class="form-control" v-model="name" :placeholder="$t('ui.prototype.placeholder')" ref="inputName" />
        <div class="MatcErrorLabel">{{ errorMessageName }}</div>
      </div>

      <div class="form-group">
        <label>{{ $t('ui.prototype.screenSize') }}</label>
        <ScreenSizeSelector @change="setType" />
      </div>

      <p class="has-text-grey is-size-6 MatcMarginBottom">{{ $t('ui.prototype.screenSizeHint') }}</p>

      <div class="MatcButtonBar">
        <a class="MatcButton MatcButtonPrimary" @click="create">{{ $t('ui.prototype.create') }}</a>
        <a @click="close" class="MatcLinkButton">{{ $t('ui.prototype.cancel') }}</a>
      </div>


    </div>

  </ZoomDialog>
</template>
<script>
import Logger from "common/Logger";
import Services from "services/Services";
import ScreenSizeSelector from "page/ScreenSizeSelector";
import ModelFactory from "core/ModelFactory";
import ZoomDialog from 'common/ZoomDialog'

export default {
  name: "CreateAppDialog",
  props: ['pub'],
  mixins: [],
  data: function () {
    return {
      errorMessageName: '',
      name: "",
      type: null
    };
  },
  watch: {},
  components: {
    'ScreenSizeSelector': ScreenSizeSelector,
    'ZoomDialog': ZoomDialog
  },
  methods: {
    close() {
      this.$refs.dialog.close()
    },
    show(e) {
      this.$refs.dialog.show(e.target)
      setTimeout(() => {
        this.$refs.inputName.focus()
      },200)
    },
    setType(t) {
      this.type = t;
    },
    async create() {
      this.errorMessageName = ""
      if (!this.name) {
        this.$refs.dialog.shake()
        this.errorMessageName = "Please enter a name"
        return
      }

      if (this.$route.meta && this.$route.meta.isTryout) {
        this.logger.info("create", "enter > tryout");
        location.href = `#/apps/tryout2.html?w=${this.type.screenSize.w}&h=${this.type.screenSize.h}&t=${this.type.type}`;
      } else {
        this.logger.info("create", "enter > user");
        let fac = new ModelFactory();
        let model = fac.createAppModel(this.name, "", this.type);
        let app = await Services.getModelService().createApp(model);
        if (app && app.id) {
          location.href = "#/apps/" + app.id + "/create.html";
        } else {
          this.showError("Could not create app");
        }
      }
    }
  },
  async mounted() {
    this.logger = new Logger("CreateAppDialog");
    setTimeout(() => {
      if (this.$refs.inputName) {
        this.$refs.inputName.focus()
      }
    }, 50)
  }
};
</script>
  
  
  