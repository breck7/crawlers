#!/usr/bin/env node

import { PoliteCrawler, MeasurementsCrawler } from "../MeasurementsCrawler"
const lodash = require("lodash")
const { Utils } = require("jtree/products/Utils.js")
const { ConceptFile } = require("jtree/products/trueBase.node.js")

const cacheDir = __dirname + "/cache/"

const { Disk } = require("jtree/products/Disk.node.js")

const wiki = require("wikijs").default
const pageviews = require("pageviews")

const JSDOM = require("jsdom").JSDOM
const jquery = require("jquery")(new JSDOM(`<!DOCTYPE html>`).window)

const yearRegex = /(released|started|began|published|designed|announced|developed|funded|created|introduced|produced) in ([12][890]\d\d)\D/gi
const yearRegexRelaxed = /\D(200\d|201\d|199\d|198\d|197\d|196\d|195\d)\D/g
const withContext = /(\D{3,18}[12][890]\d\d\D{1,18})/gi

Disk.mkdir(cacheDir)

class ConceptFileWithWikipedia {
  constructor(file: any) {
    this.file = file
  }

  file: any

  get conceptId() {
    return this.file.id
  }

  get cacheFilename() {
    return Utils.titleToPermalink(this.sourceId) + ".json"
  }

  get cachePath() {
    return cacheDir + this.cacheFilename
  }

  get wikipediaTitle() {
    return this.file
      .get("wikipedia")
      .replace("https://en.wikipedia.org/wiki/", "")
      .trim()
  }

  get isDownloaded() {
    return Disk.exists(this.cachePath)
  }
  get sourceId() {
    return this.wikipediaTitle
  }

  async fetch() {
    if (this.isDownloaded) return 1
    const { conceptId, sourceId } = this
    if (!sourceId) return 0
    console.log(`downloading page: '${sourceId}'`)
    let page
    try {
      page = await wiki().page(sourceId)
    } catch (err) {
      console.error(`Failed download for ${conceptId} '${sourceId}'`)
      console.error(err)
      const other = decodeURIComponent(sourceId)
      try {
        console.log(`Trying decodeURIComponent: ${other}`)
        page = await wiki().page(other)
      } catch (err2) {
        return {
          secondQuery: other,
          err: err,
          err2: err2,
          status: 0
        }
      }
    }

    const output: any = {}
    output.date = Date.now()
    output.raw = page.raw
    output.status = 1
    output.content = await page.content()
    output.html = await page.html()
    output.summary = await page.summary()
    output.rawInfo = await page.rawInfo()
    output.info = await page.info()
    output.images = await page.images()
    output.links = await page.links()
    output.backlinks = await page.backlinks()
    try {
      output.references = await page.references()
    } catch (err) {
      console.error(`Failed references for ${conceptId} ${sourceId}`)
    }
    //info = await article.getInfo(page)
    console.log(`Finished ${conceptId}`)

    Disk.write(this.cachePath, JSON.stringify(output, null, 2))
  }

  get object() {
    return JSON.parse(Disk.read(this.cachePath))
  }

  // Todo. All of these could return matches. Use them for conflict resolution.
  getYear(json) {
    let year = json.info && json.info.year
    if (!year) year = json.info && json.info.yearStarted
    if (!year) year = json.info && json.info.released
    year = year && year.toString().match(/^\d{4}/) && year

    if (!year && json.rawInfo) {
      year = json.rawInfo.match(/\{\{Start (date|date and age)\|(\d{4})\D/i)
      if (year) year = year[2]
    }

    // This does not seem to hit at all
    if (!year) {
      year = json.rawInfo.match(/appeared\<\/th\>\<td\>.(\d{4})/)
      if (year) year = year[1]
    }

    if (!year) {
      let matches
      let years = []

      while ((matches = yearRegex.exec(json.summary))) {
        years.push(matches[2])
      }

      if (!years.length) {
        while ((matches = yearRegex.exec(json.content))) {
          years.push(matches[2])
        }
      }

      if (!years.length && false) {
        while ((matches = withContext.exec(json.summary))) {
          console.log(matches[1])
        }
        while ((matches = withContext.exec(json.content))) {
          console.log(matches[1])
        }
      }

      if (!years.length) {
        while ((matches = yearRegexRelaxed.exec(json.summary))) {
          years.push(matches[1])
        }

        if (!years.length) {
          while ((matches = yearRegexRelaxed.exec(json.content))) {
            years.push(matches[1])
          }

          //this was pretty inaccurate:
          let num
          if (!years.length) {
            while ((matches = yearRegexRelaxed.exec(json.rawInfo))) {
              num = parseInt(matches[1])
              if (!isNaN(num) && num < 2012) years.push(num)
            }

            while (
              (matches = yearRegexRelaxed.exec(Disk.stripHtml(json.html)))
            ) {
              num = parseInt(matches[1])
              if (!isNaN(num) && num < 2012) years.push(num)
            }
          }
        }
      }

      years = years.map(n => parseInt(n))
      years.sort()

      if (years.length) year = years[0].toString()
    }

    // if (year && parseInt(year) < 1995) year = undefined
    return year.substr(0, 4)

    //if (year) this.getBase().appendUniqueLine(lang, "wikipedia_year " + year.substr(0, 4))
  }

  get infoBox() {
    const { conceptId, file } = this

    if (!Disk.exists(this.cachePath)) {
      //console.log(`Wikipedia file for "${conceptId}" not yet downloaded.`)
      return 1
    }
    const { object } = this
    return object.info
  }

  writeToDb() {
    const { conceptId, file } = this
    try {
      if (!Disk.exists(this.cachePath)) {
        //console.log(`Wikipedia file for "${conceptId}" not yet downloaded.`)
        return 1
      }
      const { object } = this
      const { info } = object
      const { designer } = info
      const wpNode = this.file.getNode("wikipedia")

      try {
        const designerString = Array.isArray(designer)
          ? designer.map(name => name.trim()).join(" and ")
          : designer
              .split(",")
              .map(name => name.trim())
              .join(" and ")
        if (designer) console.log(designer)
        if (!file.has("creators")) file.set("creators", designerString)
      } catch (err) {
        console.error(`Error with creators for ${conceptId}`)
      }

      if (!file.has("appeared")) {
        const year = this.getYear(object)
        if (year) file.set("appeared", year)
      }

      file.prettifyAndSave()

      //
      // this.extractProperty(object, "license")
      // this.extractProperty(object, "status")
      // this.getCount(object, "references")
      // this.getCount(object, "backlinks")
      // this.getWebsite(object, "website", url =>
      //   url === "url" ? undefined : url.replace(/(\[|\])/g, "")
      // )
      // this.getPageId(object)
      // this.getDescription(object)
    } catch (err) {
      console.error(conceptId, err)
    }
  }
}

class WikipediaImporter extends MeasurementsCrawler {
  async fetchAllCommand() {
    const crawler = new PoliteCrawler()
    await crawler.fetchAll(
      this.linkedFiles.map(file => new ConceptFileWithWikipedia(file))
    )
  }

  async updateOneCommand(file: typeof ConceptFile) {
    if (!file.has("wikipedia")) return
    const wp = new ConceptFileWithWikipedia(file)
    await wp.fetch()
    wp.writeToDb()
  }

  writeToDatabaseCommand() {
    this.linkedFiles.forEach(file =>
      new ConceptFileWithWikipedia(file).writeToDb()
    )
  }

  get filesWithWikipediaPages() {
    return this.linkedFiles.map(file => new ConceptFileWithWikipedia(file))
  }

  get linkedFiles() {
    return this.base.filter(file => file.has("wikipedia"))
  }
}

export { WikipediaImporter }
