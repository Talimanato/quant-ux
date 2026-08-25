import { createApp } from 'vue';
import registry from './registry';

/**
 * Vue 3 flushes mounted() hooks in a microtask after app.mount(), but the
 * dojo-style widgets expect attach points (this.cntr, this.domNode, ...) and
 * dojo listeners to be ready as soon as $new() returns — Vue 2 ran mounted
 * synchronously, which is what this code base was written against. Run the
 * DojoWidget lifecycle synchronously here. DojoWidget.mounted() skips the
 * repeated part later via the dojoInited flag.
 */
export function initDojoWidget (instance) {
  if (instance && !instance.dojoInited && instance.initDojoListeners) {
    instance.initDojoListeners();
    instance.initLogger();
    instance.initDomNodes();
    registry.add(instance);
    instance.startup();
    instance.postCreate();
    instance.dojoInited = true;
  }
  return instance;
}

function collectDeclaredProps (cls, out = new Set()) {
  if (!cls) {
    return out;
  }
  if (Array.isArray(cls.props)) {
    cls.props.forEach(p => out.add(p));
  } else if (cls.props) {
    Object.keys(cls.props).forEach(p => out.add(p));
  }
  (cls.mixins || []).forEach(m => collectDeclaredProps(m, out));
  return out;
}

/**
 * Vue 2 ignored propsData entries that the component did not declare as
 * props. Vue 3 instead renders undeclared root props as fall-through DOM
 * attributes, which throws for object/array values ("Cannot convert object
 * to primitive value"). Keep the Vue 2 behavior: drop object valued
 * params unless the component declares them as props.
 */
function filterRootProps (cls, params) {
  if (!params || typeof params !== 'object') {
    return params;
  }
  const declared = collectDeclaredProps(cls);
  const filtered = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (declared.has(key) || value === null || typeof value !== 'object') {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function $new(cls, params) {
  try {
    const el = document.createElement('div');
    const app = createApp(cls, filterRootProps(cls, params) || {});
    const instance = app.mount(el);
    initDojoWidget(instance);
    return instance;
  } catch (err) {
    console.error('DojoUtil.$new() > Error', err, cls);
    throw err;
  }
}
