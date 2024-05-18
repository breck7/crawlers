const lodash = require("lodash")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const { Disk } = require("jtree/products/Disk.node.js")

export declare type parsedConcept = any

class MeasurementsCrawler {
  constructor(concepts: parsedConcept[], dir: string) {
    this.concepts = concepts
    this.quickCache = {}
    this.dir
  }
  quickCache: any
  concepts: parsedConcept[]
  dir: string

  getFile(id: string) {
    return this.concepts.find(
      concept => concept.get("filename") === id + ".scroll"
    )
  }

  makeId(title: string) {
    let id = Utils.titleToPermalink(title)
    let newId = id
    if (!this.getFile(newId)) return newId

    throw new Error("Duplicate id: " + id)
  }

  createFile(content: string, id?: string) {
    if (id === undefined) {
      const title = new TreeNode(content).get("id")
      if (!title) throw new Error("title required for " + content)

      id = this.makeId(title)
    }
    Disk.write(this.makeFilePath(id), content)
    return this.appendLineAndChildren(id, content)
  }

  makeFilePath(id: string) {
    return path.join(this.dir, id + ".scroll")
  }

  get searchIndex() {
    if (!this.quickCache.searchIndex)
      this.quickCache.searchIndex = this.makeNameSearchIndex(this.concepts)
    return this.quickCache.searchIndex
  }

  makeNameSearchIndex(files: any[]) {
    const map = new Map<string, TreeNode>()
    files.forEach((file: any) => {
      const { id } = file
      this.makeNames(item).forEach(name => map.set(name.toLowerCase(), id))
    })
    return map
  }

  makeNames(item) {
    return [
      item.id,
      item.standsFor,
      item.githubLanguage,
      item.wikipediaTitle,
      item.aka
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
