import { TrueBaseCrawler } from "../TrueBaseCrawler"

import { parse } from "yaml"
const { Utils } = require("jtree/products/Utils.js")
const { Disk } = require("jtree/products/Disk.node.js")

const cachePath = __dirname + "/cache/riju/langs/"

const scopeName = "rijuRepl"

class RijuImporter extends TrueBaseCrawler {
  writeLinksToDatabaseCommand() {
    this.matches.forEach(match => {
      match.trueBaseFile.set(scopeName, `https://riju.codes/${match.yaml.id}`)
      match.trueBaseFile.prettifyAndSave()
    })
  }

  get yamlFiles() {
    return Disk.getFullPaths(cachePath).map(path => parse(Disk.read(path)))
  }

  get matches() {
    return this.yamlFiles
      .map(yaml => {
        const { id } = yaml
        const match = this.base.searchForEntity(id)
        if (match)
          return {
            trueBaseFile: this.base.getFile(match),
            yaml
          }
      })
      .filter(i => i)
  }

  listMissingCommand() {
    this.missing.map(yaml => console.log(`Missing language: ${yaml.id}`))
  }

  get missing() {
    return this.yamlFiles.filter(yaml => !this.base.searchForEntity(yaml.id))
  }

  addMissingCommand() {
    this.missing.forEach(yaml => {
      const type = yaml.info?.category === "esoteric" ? "esolang" : "pl"
      this.base.createFile(
        `title ${yaml.name}
type ${type}`,
        yaml.id
      )
    })
  }

  mergeOne(match) {
    const { trueBaseFile, yaml } = match
    const object = trueBaseFile.toObject()
    const { info } = yaml

    const node = trueBaseFile.getNode(scopeName)

    if (yaml.template) node.appendLineAndChildren("example", yaml.template)

    if (info) {
      if (info.desc) node.set("description", info.desc)
      if (info.year && !object.appeared)
        trueBaseFile.set("appeared", info.year.toString())

      if (info.web?.esolang && !object.esolang)
        trueBaseFile.set("esolang", info.web?.esolang)

      if (info.ext)
        node.set(
          "fileExtensions",
          info.ext.join ? info.ext.join(" ") : info.ext
        )

      if (info.web.home) node.set("website", info.web.home)

      if (info.web.source) node.set("githubRepo", info.web.source)
    }

    trueBaseFile.prettifyAndSave()
  }

  mergeInfoCommand() {
    this.matches.forEach(match => {
      try {
        this.mergeOne(match)
      } catch (err) {
        console.error(match.yaml.id, err)
      }
    })
  }
}

export { RijuImporter }
