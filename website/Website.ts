const cheerio = require("cheerio")

import { TrueCrawler } from "../TrueCrawler"

const { Utils } = require("jtree/products/Utils.js")
const { TreeNode } = require("jtree/products/TreeNode.js")

const lodash = require("lodash")

const cacheDir = __dirname + "/cache/"

const { Disk } = require("jtree/products/Disk.node.js")
Disk.mkdir(cacheDir)

class Website {
  constructor(file) {
    this.file = file
  }

  file: any

  async update() {
    const { file } = this
    if (!file.has("website")) return this
    await this.download()

    if (!Disk.exists(this.cachePath)) return

    //this.extractText()
  }

  extractAll() {
    this.extractTwitter()
    this.extractPhoneNumber()
    this.extractGitHub()
    this.extractTitle()
    this.file.prettifyAndSave()
  }

  get cachePath() {
    return cacheDir + this.file.id + ".html"
  }

  async download() {
    const { cachePath } = this
    if (Disk.exists(cachePath)) return this

    try {
      console.log("downloading to " + cachePath)
      const result = await fetch(this.file.get("website"))
      const text = await result.text()
      Disk.write(cachePath, text)
    } catch (err) {
      console.error(err)
    }
  }

  get content() {
    return Disk.read(this.cachePath)
  }

  extractGitHub() {
    const { file } = this
    if (file.has("githubRepo")) return this

    let potentialHits = Utils.getLinks(this.content.toLowerCase()).filter(
      link => {
        link = link.trim()
        const path = new URL(link).pathname.split("/")
        return link.includes("https://github.com") && path.length === 3
      }
    )
    //todo: improve
    potentialHits = lodash.uniq(potentialHits)
    if (potentialHits.length === 1)
      file.set(`githubRepo`, potentialHits[0].trim())
    return this
  }

  extractTitle() {
    const { file, content } = this
    const cheer = cheerio.load(content)
    let title = ""
    cheer("title").each((i, elem) => {
      file.set("website title", cheer(elem).text())
    })
    return this
  }

  extractText() {
    // todo
  }

  extractPhoneNumber() {
    const { file } = this
    if (file.has("phoneNumber")) return
    if (!Disk.exists(this.cachePath)) return
    const matches = this.content.match(/(1-\d\d\d-\d\d\d-\d\d\d\d)/)
    if (matches) file.set("phoneNumber", matches[0])
    return this
  }

  extractTwitter() {
    const { file } = this
    if (file.has("twitter")) return
    const str = this.content.toLowerCase()
    const { id } = file
    if (str.includes("twitter")) {
      // todo: update
      const matches = str.match(/twitter\.com\/([^"\/ \?\']+)/g)

      if (matches) {
        matches
          .map(m => m.replace("twitter.com/", ""))
          .forEach(m => {
            if (
              m === id ||
              m.includes(id) ||
              id.includes(m) ||
              file.toString().includes(m)
            ) {
              file.set("twitter", `https://twitter.com/${m}`)
            }
          })
      }
      let out = ""
      if (matches) out = matches.join(" ")
      console.log(`${id} ${out}`)
    }
    return this
  }
}

class WebsiteImporter extends TrueCrawler {
  get matches() {
    return this.base
      .filter(file => file.has("website"))
      .map(file => new Website(file))
  }

  async downloadAllCommand() {
    await Promise.all(this.matches.map(file => file.download()))
  }

  async updateAllCommand() {
    lodash
      .shuffle(this.base.filter(file => file.has("website")))
      .forEach(async file => {
        try {
          await new Website(file).update()
        } catch (err) {
          console.error(err)
          console.log(`Error with ${file.id}`)
        }
      })
  }
}

export { WebsiteImporter }
