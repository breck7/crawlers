import { TreeBaseCrawler } from "../TreeBaseCrawler"
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const cacheDir = __dirname + "/cache/"

const { Disk } = require("jtree/products/Disk.node.js")
const outputFile = cacheDir + "output.json"

class PygmentsImporter extends TreeBaseCrawler {
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
    if (!file.has("pygmentsHighlighter")) return
    if (!file.has("keywords") && entry.keywords.length)
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
    if (file.has("pygmentsHighlighter")) return

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
      entry.treeBaseId =
        this.base.searchForEntity(entry.name) ||
        this.base.searchForEntityByFileExtensions(entry.extensions)

      if (entry.treeBaseId) entry.file = this.base.getFile(entry.treeBaseId)
      return entry
    })
  }

  get matches() {
    return this.match.filter(item => item.treeBaseId)
  }

  get misses() {
    return this.match.filter(item => !item.treeBaseId)
  }

  addMissesCommand() {
    this.misses
      .filter(hit => hit.url)
      .forEach(miss => {
        const website = miss.url.includes("github")
          ? `githubRepo ${miss.url}`
          : `website ${miss.url}`
        const newFile = this.base.createFile(`title ${miss.name}
type pl
${website}`)
        this.writeOne(newFile, miss)
      })
  }
}

export { PygmentsImporter }
