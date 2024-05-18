const lodash = require("lodash")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")

export declare type parsedConcept = Object

class MeasurementsCrawler {
  constructor(concepts: parsedConcept[]) {
    this.concepts = concepts
    this.quickCache = {}
  }
  quickCache: any
  concepts: parsedConcept[]

  getFile(id: string) {
    return this.concepts.find(
      concept => concept.get("filename") === id + ".scroll"
    )
  }

  createFile() {}

  get searchIndex() {
    if (!this.quickCache.searchIndex)
      this.quickCache.searchIndex = this.makeNameSearchIndex(this.concepts)
    return this.quickCache.searchIndex
  }

  makeNameSearchIndex(files: TreeNode[]) {
    const map = new Map<string, TreeNode>()
    files.forEach((file: TreeNode) => {
      const { id } = file
      file.names.forEach(name => map.set(name.toLowerCase(), id))
    })
    return map
  }

  get names() {
    return [
      this.id,
      this.title,
      this.get("standsFor"),
      this.get("githubLanguage"),
      this.wikipediaTitle,
      ...this.getAll("aka")
    ].filter(i => i)
  }

  // Specific for PLDB:
  searchForConcept(query: string) {
    if (query === undefined || query === "") return
    const { searchIndex } = this
    return (
      searchIndex.get(query) ||
      searchIndex.get(query.toLowerCase()) ||
      searchIndex.get(Utils.titleToPermalink(query))
    )
  }

  searchForConceptByFileExtensions(extensions = []) {
    const { extensionsMap } = this
    const hit = extensions.find(ext => extensionsMap.has(ext))
    return extensionsMap.get(hit)
  }

  get extensionsMap() {
    if (this.quickCache.extensionsMap) return this.quickCache.extensionsMap
    this.quickCache.extensionsMap = new Map()
    const extensionsMap = this.quickCache.extensionsMap
    this.concepts.forEach(concept =>
      concept.extensions
        .split(" ")
        .forEach(ext => extensionsMap.set(ext, concept.id))
    )

    return extensionsMap
  }
}

interface PoliteCrawlerJob {
  fetch: Function
}

class PoliteCrawler {
  running = 0
  async _fetchQueue(methodName = "fetch") {
    if (!this.downloadQueue.length) return

    await this.awaitScheduledTime()

    const nextItem = this.downloadQueue.pop()
    if (!nextItem) return
    await nextItem[methodName]()
    return this._fetchQueue(methodName)
  }

  async awaitScheduledTime() {
    if (!this.msDelayBetweenRequests) return

    if (!this._nextOpenTime) {
      this._nextOpenTime = Date.now() + this.msDelayBetweenRequests
      return
    }

    const awaitTimeInMs = this._nextOpenTime - Date.now()
    if (awaitTimeInMs < 1) {
      this._nextOpenTime = Date.now() + this.msDelayBetweenRequests
      return
    }
    this._nextOpenTime = this._nextOpenTime + this.msDelayBetweenRequests
    await new Promise(r => setTimeout(r, awaitTimeInMs))
  }

  _nextOpenTime = 0
  msDelayBetweenRequests = 0
  maxConcurrent = 10
  downloadQueue: PoliteCrawlerJob[] = []
  randomize = false // Can randomize the queue so dont get stuck on one
  async fetchAll(jobs, methodName = "fetch") {
    this.downloadQueue = this.randomize ? lodash.shuffle(jobs) : jobs
    const threads = lodash
      .range(0, this.maxConcurrent, 1)
      .map(i => this._fetchQueue(methodName))
    await Promise.all(threads)
  }
}

export { PoliteCrawler, MeasurementsCrawler }
