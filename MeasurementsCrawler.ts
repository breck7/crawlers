const lodash = require("lodash")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const { Disk } = require("jtree/products/Disk.node.js")
const path = require("path")

export declare type parsedConcept = any

class MeasurementsCrawler {
  constructor(concepts: parsedConcept[], dir: string) {
    this.concepts = concepts
    this.quickCache = {}
    this.dir = dir
  }
  quickCache: any
  concepts: parsedConcept[]
  dir: string

  getFile(filename: string) {
    return this.concepts.find(
      concept => concept.filename === filename + ".scroll"
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
    return new TreeNode(content)
  }

  makeFilePath(id: string) {
    return path.join(this.dir, id.replace(".scroll", "") + ".scroll")
  }

  getTree(file: parsedConcept) {
    return new TreeNode(Disk.read(this.makeFilePath(file.filename)))
  }

  setAndSave(
    file: parsedConcept,
    measurementPath: string,
    measurementValue: string
  ) {
    const tree = this.getTree(file)
    tree.set(measurementPath, measurementValue)
    return this.save(file, tree)
  }

  save(file: parsedConcept, tree: typeof TreeNode) {
    return Disk.write(this.makeFilePath(file.filename), tree.toString())
  }

  get searchIndex() {
    if (!this.quickCache.searchIndex)
      this.quickCache.searchIndex = this.makeNameSearchIndex(this.concepts)
    return this.quickCache.searchIndex
  }

  makeNameSearchIndex(files: parsedConcept[]) {
    const map = new Map<string, parsedConcept>()
    files.forEach((parsedConcept: parsedConcept) => {
      const id = parsedConcept.filename.replace(".scroll", "")
      this.makeNames(parsedConcept).forEach(name =>
        map.set(name.toLowerCase(), id)
      )
    })
    return map
  }

  makeNames(concept: parsedConcept) {
    return [
      concept.filename.replace(".scroll", ""),
      concept.id,
      concept.standsFor,
      concept.githubLanguage,
      concept.wikipediaTitle,
      concept.aka
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
