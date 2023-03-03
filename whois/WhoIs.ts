import { TrueCrawler } from "../TrueCrawler"
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")

const whois = require("whois-json")
const lodash = require("lodash")

const cacheDir = __dirname + "/cache/"

const { Disk } = require("jtree/products/Disk.node.js")
Disk.mkdir(cacheDir)

class WhoIsImporter extends TrueCrawler {
  extractDomain(file) {
    if (file.get("domainName")) return this
    const website = file.get("website")
    if (!website) return this
    const uri = new URL(website)
    let webDomain = uri.hostname
    const path = uri.pathname
    // todo: handle foreign domains
    const isDomainForTheLanguage = path.length < 2
    if (isDomainForTheLanguage) {
      webDomain = webDomain.replace(/^www\./, "")
      file.set(`domainName`, webDomain)
      file.prettifyAndSave()
    }
  }

  makePath(id) {
    return `${cacheDir}${id}.json`
  }

  async fetchData(file) {
    if (file.get("domainName registered")) return 1
    const { id } = file
    const domainName = file.get("domainName")

    const path = this.makePath(id)
    if (Disk.exists(path)) return 1

    const results = await whois(domainName, { follow: 10, verbose: true })
    console.log(`fetched ${domainName}`)
    Disk.writeJson(path, results)
  }

  writeData(file) {
    const { id } = file
    const domainName = file.get("domainName")
    const path = this.makePath(id)
    if (!Disk.exists(path)) return 1
    const results = Disk.readJson(path)
    let year = results.domainName
      ? results.creationDate || results.domainRegistered
      : results[0].data.creationDate

    year = year.match(/(198\d|199\d|200\d|201\d|202\d)/)[1]
    file.set("domainName registered", year)
    //if (!file.has("appeared")) file.set("appeared", year)
    file.prettifyAndSave()
  }

  async updateOne(file) {
    try {
      this.extractDomain(file)
      if (!file.get("domainName")) return
      await this.fetchData(file)
      this.writeData(file)
    } catch (err) {
      console.log(`Error for ${file.get("domainName")}`)
      console.log(err)
    }
  }

  async updateOneCommand(id) {
    this.updateOne(this.base.getFile(id))
  }

  async updateAllCommand() {
    lodash
      .shuffle(this.base.filter(file => file.has("website")))
      .forEach(async file => this.updateOne(file))
  }
}

export { WhoIsImporter }
