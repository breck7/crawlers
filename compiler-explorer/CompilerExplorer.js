"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
exports.CompilerExplorerImporter = void 0
const MeasurementsCrawler = require("../MeasurementsCrawler")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const path = require("path")
const { Disk } = require("jtree/products/Disk.node.js")
const cacheDir = __dirname + "/cache/"
const compilerExplorerKey = "compilerExplorer"
const langPath = path.join(
  __dirname,
  "cache",
  "compiler-explorer",
  "out",
  "dist",
  "lib",
  "languages.js"
)
const prepLangFile = () => {
  // todo: path.join(__dirname + '/../../../examples', key, 'default' + lang.extensions[0]),
  const content =
    Disk.read(langPath)
      .replace(
        `import path from 'path';
import fs from 'fs-extra';
import _ from 'underscore';`,
        `const path = require('path');
const fs = require('fs-extra');
const _ = require('underscore');`
      )
      .replace("export const languages", "const languages") +
    `\nmodule.exports = {languages};`
  Disk.write(langPath, content)
}
class ConceptFileWithCompilerExplorer {
  constructor(file, lang) {
    this.file = file
    this.lang = lang
  }
  get compilerExplorerNode() {
    return this.file.getNode(compilerExplorerKey)
  }
  writeInfo() {
    const { file, compilerExplorerNode, lang } = this
    const { example } = lang
    if (example) compilerExplorerNode.touchNode("example").setChildren(example)
    file.prettifyAndSave()
    return this
  }
}
class CompilerExplorerImporter extends MeasurementsCrawler.MeasurementsCrawler {
  init() {
    prepLangFile()
  }
  get languages() {
    return require(langPath).languages
  }
  writeDataCommand() {
    this.matched.forEach(pair =>
      new ConceptFileWithCompilerExplorer(pair.file, pair.lang).writeInfo()
    )
  }
  async writeLinksCommand() {
    this.matched.forEach(match => {
      const { file, lang } = match
      const { name } = lang
      const node = file.touchNode(compilerExplorerKey)
      if (!node.content) {
        node.setContent(name)
        file.prettifyAndSave()
      }
    })
  }
  get pairs() {
    return Object.values(this.languages).map(lang => {
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
}
exports.CompilerExplorerImporter = CompilerExplorerImporter
