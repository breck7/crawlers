import { MeasurementsCrawler } from "../MeasurementsCrawler"

const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")

const lodash = require("lodash")
const dayjs = require("dayjs")
const path = require("path")
const { Disk } = require("jtree/products/Disk.node.js")

const cacheDir = __dirname + "/cache/"

const pyplKey = "pypl"

const langPath = path.join(
  __dirname,
  "cache",
  "pypl.github.io",
  "PYPL",
  "All.js"
)

class ConceptFileWithPypl {
  constructor(file: any, lang) {
    this.file = file
    this.lang = lang
  }

  lang: any
  file: any

  get node() {
    return this.file.getNode(pyplKey)
  }

  writeInfo() {
    const { file, node, lang } = this

    file.prettifyAndSave()
    return this
  }
}

class PyplImporter extends MeasurementsCrawler {
  init() {
    Disk.write(
      langPath,
      Disk.read(langPath).replace("graphData", "module.exports")
    )
  }

  get languages() {
    const data = require(langPath)
    const names = data[0].slice(1)
    const years = data.slice(1)
    const all = names.map((name, index) => {
      const obj = {
        name
      }

      years.forEach(year => {
        const key = dayjs(year[0]).format("MM/YYYY")
        obj[key] = lodash.round(year[index + 1] * 100, 2)
      })
      return obj
    })

    // Manually copy c/cpp into 2 langs.
    const cpp = all.find(lang => lang.name === "C/C++")
    const c = Object.assign({}, cpp)
    cpp.name = "C++"
    c.name = "C"
    all.push(c)

    return all
  }

  get pairs() {
    return Object.values(this.languages).map((lang: any) => {
      const id = this.searchForConcept(lang.name)
      return { file: this.getFile(id), lang }
    })
  }

  get matched() {
    return this.pairs.filter(row => row.file)
  }

  get unmatched() {
    return this.pairs
      .filter(row => row.file === undefined)
      .map(item => item.lang)
  }

  listUnmatchedLangsCommand() {
    const missingPath = path.join(cacheDir, "missingLangs.json")
    Disk.write(missingPath, JSON.stringify(this.unmatched, null, 2))
    console.log(`Wrote ${this.unmatched.length} missing to: ${missingPath}`)
  }

  dumpAllLangsCommand() {
    Disk.write(
      path.join(cacheDir, "langs.json"),
      JSON.stringify(this.languages, null, 2)
    )
  }

  writeDataCommand() {
    this.matched.forEach(pair =>
      new ConceptFileWithPypl(pair.file, pair.lang).writeInfo()
    )
  }

  async writeLinksCommand() {
    this.matched.forEach(match => {
      const { file, lang } = match
      const { name } = lang
      const node = file.touchNode(pyplKey)
      if (!node.content) {
        node.setContent(name)
        file.prettifyAndSave()
      }
    })
  }
}

export { PyplImporter }
