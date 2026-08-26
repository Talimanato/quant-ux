/**
 * Maps a language tag (stored preference, browser language, ...) to one of
 * the i18n locales registered in main.js. Unknown or missing tags fall back
 * to Chinese, which is the product default language.
 */
export function resolveLocale (language) {
  if (!language) {
    return 'cn'
  }
  const lang = String(language).toLowerCase()
  if (lang.indexOf('zh') === 0) {
    return 'cn'
  }
  if (lang.indexOf('de') === 0) {
    return 'de'
  }
  if (lang.indexOf('pt') === 0) {
    return 'pt-br'
  }
  if (lang.indexOf('en') === 0) {
    return 'en'
  }
  return 'cn'
}
