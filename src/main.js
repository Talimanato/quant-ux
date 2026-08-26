import { createApp } from 'vue'
import { configureCompat } from '@vue/compat'
import App from './App.vue'
import router from './router'
import { createI18n } from 'vue-i18n'

import Services from 'services/Services'
import { resolveLocale } from 'services/Locale'

// Configure Vue 3 compat mode. MODE: 3 emits deprecation warnings but keeps
// most Vue 2 features working while we migrate.
configureCompat({
  MODE: 3,
  GLOBAL_MOUNT: true,
  GLOBAL_EXTEND: true,
  GLOBAL_PROTOTYPE: true,
  CONFIG_OPTION_MERGE_STRATS: true,
  CONFIG_SILENT: true,
  CONFIG_DEVTOOLS: true,
  CONFIG_IGNORED_ELEMENTS: true,
  COMPILER_IS_ON_ELEMENT: true,
  COMPILER_V_BIND_SYNC: true,
  COMPILER_V_BIND_PROP: true,
  COMPILER_V_BIND_OBJECT: true,
  COMPILER_V_ON_NATIVE: true,
  COMPILER_V_FOR_TEMPLATE_KEY_PLACEMENT: true,
  COMPONENT_ASYNC: true,
  COMPONENT_FUNCTIONAL: true,
  COMPONENT_V_MODEL: true,
  RENDER_FUNCTION: true,
  FILTERS: true,
  INSTANCE_ATTRS_CLASS_STYLE: true,
  INSTANCE_SCOPED_SLOTS: true,
  INSTANCE_LISTENERS: true,
  INSTANCE_EVENT_EMITTER: true,
  INSTANCE_EVENT_HOOKS: true,
  INSTANCE_CHILDREN: true,
  INSTANCE_SET: true,
  OPTIONS_DATA_FN: true,
  OPTIONS_DATA_MERGE: true,
  OPTIONS_BEFORE_DESTROY: true,
  OPTIONS_DESTROYED: true,
  WATCH_ARRAY: true,
  CUSTOM_DIR: true
})

async function start() {
  await Services.initConfig()
  let conf = await Services.getConfig()
  if (conf.auth === 'keycloak') {
    const keycloakService = Services.getUserService()
    await keycloakService.setConf(conf)
    await keycloakService.init();
  }

  /**
   * Default to Chinese. A language picked in the UI (LanguagePicker ->
   * UserService.setLanguage) is persisted in localStorage and wins.
   */
  const storedLanguage = localStorage.getItem('quxLanguage')
  const initialLocale = storedLanguage ? resolveLocale(storedLanguage) : 'cn'

  const i18n = createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'en',
    messages: {
      'en': require('./nls/en.json'),
      'en-uk': require('./nls/en.json'),
      'en-us': require('./nls/en.json'),
      'cn': require('./nls/cn.json'),
      'zh': require('./nls/cn.json'),
      'zh-cn': require('./nls/cn.json'),
      'de': require('./nls/de.json'),
      'pt-br': require('./nls/pt_br.json'),
      'pt': require('./nls/pt_br.json')
    }
  })

  const app = createApp(App)
  app.use(router)
  app.use(i18n)
  app.config.productionTip = false
  app.config.globalProperties.$i18n = i18n.global
  app.config.globalProperties.$t = i18n.global.t
  app.mount('#app')
}

start()
