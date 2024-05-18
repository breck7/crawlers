import { MeasurementsCrawler } from "../MeasurementsCrawler"

import { parse } from "yaml"
const { Utils } = require("jtree/products/Utils.js")
const { Disk } = require("jtree/products/Disk.node.js")

const cachePath = __dirname + "/cache/riju/langs/"

const scopeName = "rijuRepl"

class RijuImporter extends MeasurementsCrawler {
  writeLinksToDatabaseCommand() {
    this.matches.forEach(match => {
      match.ConceptFile.set(scopeName, `https://riju.codes/${match.yaml.id}`)
      match.ConceptFile.prettifyAndSave()
    })
  }

  get yamlFiles() {
    return Disk.getFullPaths(cachePath).map(path => parse(Disk.read(path)))
  }

  get matches() {
    return this.yamlFiles
      .map(yaml => {
        const { id } = yaml
        const match = this.searchForConcept(id)
        if (match)
          return {
            ConceptFile: this.getFile(match),
            yaml
          }
      })
      .filter(i => i)
  }

  listMissingCommand() {
    this.missing.map(yaml => console.log(`Missing language: ${yaml.id}`))
  }

  get missing() {
    return this.yamlFiles.filter(yaml => !this.searchForConcept(yaml.id))
  }

  addMissingCommand() {
    this.missing.forEach(yaml => {
      const type = yaml.info?.category === "esoteric" ? "esolang" : "pl"
      this.createFile(
        `title ${yaml.name}
type ${type}`,
        yaml.id
      )
    })
  }

  mergeOne(match) {
    const { ConceptFile, yaml } = match
    const object = ConceptFile.toObject()
    const { info } = yaml

    const node = ConceptFile.getNode(scopeName)

    if (yaml.template) node.appendLineAndChildren("example", yaml.template)

    if (info) {
      if (info.desc) node.set("description", info.desc)
      if (info.year && !object.appeared)
        ConceptFile.set("appeared", info.year.toString())

      if (info.web?.esolang && !object.esolang)
        ConceptFile.set("esolang", info.web?.esolang)

      if (info.ext)
        node.set(
          "fileExtensions",
          info.ext.join ? info.ext.join(" ") : info.ext
        )

      if (info.web.home) node.set("website", info.web.home)

      if (info.web.source) node.set("githubRepo", info.web.source)
    }

    ConceptFile.prettifyAndSave()
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
