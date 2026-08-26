import Logger from 'common/Logger'
import Services from 'services/Services'
import {
  extractPageData,
  buildModel
} from 'services/AxureParser'

/**
 * Imports an Axure RP 9/10 HTML export (as zip file) into the current app.
 *
 * Axure exports contain a `pages/<page>/data.js` per page which is parsed
 * by AxureParser. Images referenced by the pages are uploaded to the
 * quant-ux image backend and attached as widget background images.
 */
class AxureService {

  constructor () {
    this.logger = new Logger('AxureService')
  }

  async parse (zipFile, appID, onProgress) {
    this.logger.log(-1, 'parse', 'enter', zipFile && zipFile.name)

    const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default
    const zip = new JSZip()
    await zip.loadAsync(zipFile)

    /**
     * Collect all page data.js files. The export might be wrapped in an
     * additional folder, so match `pages/<page>/data.js` anywhere.
     */
    const pagePaths = []
    zip.forEach((relPath, file) => {
      if (!file.dir && /(^|\/)pages\/[^/]+\/data\.js$/.test(relPath)) {
        pagePaths.push(relPath)
      }
    })
    if (pagePaths.length === 0) {
      this.logger.error('parse', 'no pages found')
      throw new Error('axure.no.pages')
    }
    pagePaths.sort()

    const pages = []
    for (const path of pagePaths) {
      const entry = zip.file(path)
      if (!entry) {
        continue
      }
      try {
        const text = await entry.async('string')
        const data = extractPageData(text)
        if (data) {
          pages.push({ path, data })
        }
      } catch (err) {
        this.logger.error('parse', 'Could not parse', path, err)
      }
    }
    if (pages.length === 0) {
      throw new Error('axure.no.pages')
    }
    this.logger.log(2, 'parse', 'pages', pages.length)

    const model = buildModel(pages)
    this.logger.log(2, 'parse', 'widgets', model.widgets.length, 'images', model.imageRefs.length)

    /**
     * Upload all images and attach them to the widgets.
     */
    const imageRefs = model.imageRefs
    delete model.imageRefs
    if (onProgress) {
      onProgress(10, pages.length, 0)
    }

    const imageService = Services.getImageService()
    const uploadURL = '/rest/images/' + appID
    let done = 0
    for (const ref of imageRefs) {
      try {
        const upload = await this.uploadImage(zip, ref, uploadURL, imageService)
        const widget = model.widgets.find(w => w.id === ref.widgetId)
        if (upload && widget) {
          widget.style.backgroundImage = {
            name: upload.name,
            url: upload.url,
            w: upload.width,
            h: upload.height
          }
          widget.has.backgroundImage = true
        }
      } catch (err) {
        this.logger.error('parse', 'Could not upload image', ref.url, err)
      }
      done++
      if (onProgress) {
        onProgress(10 + Math.round((done / Math.max(1, imageRefs.length)) * 80), pages.length, done)
      }
    }

    if (onProgress) {
      onProgress(100, pages.length, imageRefs.length)
    }
    return model
  }

  /**
   * Finds the zip entry of an Axure image url. Urls are relative to the
   * page folder (`pages/<page>/files/...`) but might also be absolute
   * inside the export (`files/...`).
   */
  findImageEntry (zip, ref) {
    const pageDir = (ref.pagePath || '').replace(/[^/]*$/, '')
    const cleanUrl = ref.url.split('?')[0].split('#')[0]
    const candidates = [
      pageDir + cleanUrl,
      cleanUrl,
      cleanUrl.replace(/^\.\//, ''),
      pageDir + cleanUrl.replace(/^\.\//, '')
    ]
    // also try from the zip root (strip a potential wrapper folder)
    const rootPrefix = pageDir.indexOf('pages/') > 0 ? pageDir.substring(0, pageDir.indexOf('pages/')) : ''
    if (rootPrefix) {
      candidates.push(rootPrefix + cleanUrl)
    }
    for (const candidate of candidates) {
      const entry = zip.file(candidate)
      if (entry) {
        return entry
      }
    }
    return null
  }

  async uploadImage (zip, ref, uploadURL, imageService) {
    const entry = this.findImageEntry(zip, ref)
    if (!entry) {
      this.logger.warn('uploadImage', 'image not found in zip', ref.url)
      return null
    }
    const blob = await entry.async('blob')
    const parts = ref.url.split('/')
    const filename = 'axure_' + parts[parts.length - 1].replace(/[^a-zA-Z0-9._-]/g, '_')
    const mime = this.getMime(filename)
    const file = new Blob([blob], { type: mime })
    const formData = new FormData()
    formData.append('file', file, filename)
    const response = await imageService.upload(uploadURL, formData)
    const parsed = typeof response === 'string' ? JSON.parse(response) : response
    return parsed && parsed.uploads ? parsed.uploads[0] : null
  }

  getMime (filename) {
    const lower = filename.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.svg')) return 'image/svg+xml'
    if (lower.endsWith('.webp')) return 'image/webp'
    return 'image/jpeg'
  }

}

export default new AxureService()
