<template>
  <img class="MatcAppList" />
</template>
<script>
import DojoWidget from 'dojo/DojoWidget'
import Logger from 'common/Logger'

export default {
  name: "QRCode",
  mixins: [DojoWidget],
  props: ['hash', 'debug', 'live', 'log'],
  data: function() {
    return {
    };
  },
  components: {},
  methods: {
  },
  mounted() {
    this.log = new Logger("QRCode");
    this.log.log(2, 'mounted', 'enter')
  }
};
</script>