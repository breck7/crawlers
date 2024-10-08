"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
exports.PygmentsImporter = void 0
const MeasurementsCrawler = require("../MeasurementsCrawler")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const cacheDir = __dirname + "/cache/"
const { Disk } = require("jtree/products/Disk.node.js")
const outputFile = cacheDir + "output.json"
class PygmentsImporter extends MeasurementsCrawler.MeasurementsCrawler {
  linkAllCommand() {
    this.matches.forEach(entry => {
      this.writeOne(entry.file, entry)
    })
  }
  extractDataCommand() {
    this.matches.forEach(entry => {
      this.extractData(entry.file, entry)
    })
  }
  extractData(file, entry) {
    if (!file.pygmentsHighlighter) return
    if (!file.keywords && entry.keywords.length)
      file.set("keywords", entry.keywords.join(" "))
    const nums = [
      "Octals",
      "Hexadecimals",
      "Floats",
      "Integers",
      "BinaryNumbers"
    ]
    nums.forEach(num => {
      const path = `features has${num}`
      const value = entry[num.toLowerCase()]
      const { lineCommentToken } = file
      if (file.get(path) === undefined && value) {
        file.set(path, "true")
        if (lineCommentToken)
          file.touchNode(path).setChildren(lineCommentToken + " " + value)
      }
    })
    const features = ["hasLineComments", "hasMultiLineComments"]
    features.forEach(feature => {
      const path = `features ${feature}`
      const value = entry[feature]
      const { lineCommentToken } = file
      if (file.get(path) === undefined && value) {
        file.set(path, "true")
      }
    })
    file.prettifyAndSave()
  }
  writeOne(file, entry) {
    if (file.pygmentsHighlighter) return
    file.set("pygmentsHighlighter", entry.name)
    file.set("pygmentsHighlighter filename", entry.filename)
    const extensions = entry.extensions.join(" ")
    if (extensions) file.set("pygmentsHighlighter fileExtensions", extensions)
    file.prettifyAndSave()
  }
  get data() {
    return Disk.readJson(outputFile)
  }
  get match() {
    return this.data.map(entry => {
      entry.extensions = entry.filenames.map(ext => ext.replace("*.", ""))
      entry.filename = entry.filename.split("/").pop()
      entry.conceptId =
        this.searchForConcept(entry.name) ||
        this.searchForConceptByFileExtensions(entry.extensions)
      if (entry.conceptId) entry.file = this.getFile(entry.conceptId)
      return entry
    })
  }
  get matches() {
    return this.match.filter(item => item.conceptId)
  }
  get misses() {
    return this.match.filter(item => !item.conceptId)
  }
  addMissesCommand() {
    this.misses
      .filter(hit => hit.url)
      .forEach(miss => {
        const website = miss.url.includes("github")
          ? `githubRepo ${miss.url}`
          : `website ${miss.url}`
        const newFile = this.createFile(`id ${miss.name}
tags pl
${website}`)
        this.writeOne(newFile, miss)
      })
  }
}
exports.PygmentsImporter = PygmentsImporter
