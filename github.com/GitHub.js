const { PoliteCrawler } = require("../PoliteCrawler.js")
const { Utils } = require("jtree/products/Utils.js")
const { TreeNode } = require("jtree/products/TreeNode.js")
const superagent = require("superagent")
const repoFirstCommit = require("repo-first-commit")
const dayjs = require("dayjs")
const path = require("path")
const YAML = require("yaml")
const { Disk } = require("jtree/products/Disk.node.js")
const cacheDir = path.join(__dirname, "cache")
const reposDir = path.join(cacheDir, "repos")
const repoCountCache = path.join(cacheDir, "repoCount")
const firstCommitCache = path.join(cacheDir, "firstCommits")
const credsPath = path.join(__dirname, "ignore", "creds.json")
const creds = JSON.parse(Disk.read(credsPath))
const { apiToken, apiUser } = creds
if (!apiToken) {
  console.error(`No GitHub token found`)
  process.exit()
}
const downloadJson = async (url, destination) => {
  const agent = superagent.agent()
  console.log(`downloading ${url}`)
  const res = await agent
    .get(url)
    .set("User-Agent", apiUser)
    .set("Authorization", `token ${apiToken}`)
  Disk.writeJson(destination, res.body || res.text || "")
}
Disk.mkdir(cacheDir)
Disk.mkdir(reposDir)
Disk.mkdir(firstCommitCache)
Disk.mkdir(repoCountCache)
class ConceptFileWithGitHub {
  constructor(file, scrollset) {
    this.file = file
    this.scrollset = scrollset
  }
  get id() {
    return this.file.id
  }
  get firstCommitResultPath() {
    return path.join(firstCommitCache, this.id + ".json")
  }
  async fetch() {
    await this.fetchFirstCommit()
    await this.downloadRepoInfo()
  }
  async downloadRepoInfo() {
    const { repoFilePath, userId, repoId } = this
    if (Disk.exists(repoFilePath)) return true
    try {
      await downloadJson(
        `https://api.github.com/repos/${userId}/${repoId}`,
        repoFilePath
      )
    } catch (err) {
      //Disk.write(repoFilePath, JSON.stringify(err))
      console.error(err)
    }
  }
  get githubLanguageId() {
    return this.languageNode.content
  }
  get repoCountPath() {
    return path.join(repoCountCache, `${this.githubLanguageId}.json`)
  }
  async fetchRepoCounts() {
    const { githubLanguageId, repoCountPath } = this
    if (Disk.exists(repoCountPath)) return
    try {
      await downloadJson(
        `https://api.github.com/search/repositories?q=language:${githubLanguageId}&per_page=1`,
        repoCountPath
      )
    } catch (err) {
      //Disk.write(repoFilePath, JSON.stringify(err))
      console.error(err)
    }
  }
  writeRepoCounts() {
    const { repoCountPath, languageNode, file } = this
    if (!Disk.exists(repoCountPath)) return this
    const obj = Disk.readJson(repoCountPath)
    languageNode.set("repos", obj.total_count.toString())
    file.prettifyAndSave()
  }
  get tree() {
    return this.scrollset.getParticle(this.file)
  }
  get githubNode() {
    return this.tree.getParticle("githubRepo")
  }
  get languageNode() {
    return this.tree.getParticle("githubLanguage")
  }
  get githubRepo() {
    return this.file.githubRepo.replace("https://github.com/", "")
  }
  async fetchTrending() {
    const { file, githubNode } = this
    const { fetchRepositories } = require("@huchenme/github-trending")
    const id = "todo" // this.get("github_githubUrlParam") // todo: what should this be?
    fetchRepositories({ language: id, since: "monthly" }).then(repositories => {
      // todo: can monthly be annually?
      console.log(id)
      console.log(repositories.length)
      const data = new TreeNode(repositories)
      data.forEach(row => {
        row.delete("builtBy")
        const desc = row.get("description")
        row.delete("description")
        row.set("description", desc)
      })
      githubNode.appendLineAndChildren("githubTrending", data.toSsv())
      //console.log(data.toSsv())
      file.prettifyAndSave()
    })
  }
  get userId() {
    return this.githubRepo.split("/")[0]
  }
  get repoId() {
    return this.githubRepo.split("/")[1]
  }
  get repoFilePath() {
    return path.join(reposDir, `${this.userId}-${this.repoId}.json`)
  }
  writeRepoInfoToDatabase() {
    const { repoFilePath, file, tree } = this
    if (!Disk.exists(repoFilePath)) return this
    const obj = Disk.readJson(repoFilePath)
    if (typeof obj === "string") throw new Error("string:" + obj)
    if (!file.website && obj.homepage) {
      this.scrollset.setAndSave(this.file, `website`, obj.homepage)
    }
    tree.getParticle("githubRepo").setProperties({
      stars: obj.stargazers_count.toString(),
      forks: obj.forks.toString(),
      subscribers: obj.subscribers_count.toString(),
      created: obj.created_at.substr(0, 4),
      updated: obj.updated_at.substr(0, 4),
      description: obj.description,
      issues: obj.open_issues_count.toString()
      // githubId: obj.id,
      // githubHomepage: obj.homepage,
      // githubLanguage: obj.language,
      // githubHasWiki: obj.hasWiki,
    })
    this.scrollset.formatAndSave(file, tree)
    return this
  }
  async fetchFirstCommit() {
    const { file } = this
    if (Disk.exists(this.firstCommitResultPath)) return
    console.log(`Fetching "${file.id}"`)
    const url = file.githubRepo
    const parts = url.split("/")
    const repoName = parts.pop()
    const owner = parts.pop()
    if (owner === "github.com") return 1
    try {
      const commit = await repoFirstCommit({
        owner,
        repo: repoName,
        token: apiToken
        //sha: "5.0"
      })
      console.log(`Success for "${file.id}"`)
      console.log(commit)
      Disk.write(this.firstCommitResultPath, JSON.stringify(commit, null, 2))
    } catch (err) {
      console.log(err)
      console.log(`Error for "${file.id}"`)
      Disk.write(this.firstCommitResultPath, `Error`)
    }
  }
  writeFirstCommitToDatabase() {
    const { file } = this
    if (file.githubRepo_firstCommit || !this.firstCommitFetched) return this
    try {
      const { firstCommit } = this
      const year = dayjs(firstCommit.commit.author.date).format("YYYY")
      this.scrollset.setAndSave(this.file, `githubRepo firstCommit`, year)
    } catch (err) {
      console.error(`Failed on ${file.id}`, err)
    }
    return this
  }
  get firstCommitFetched() {
    return Disk.exists(this.firstCommitResultPath)
  }
  get firstCommit() {
    return JSON.parse(Disk.read(this.firstCommitResultPath))
  }
  autocompleteCreators() {
    const { file } = this
    try {
      if (!file.creators && this.firstCommitFetched) {
        const { firstCommit } = this
        file.set("creators", firstCommit.commit.author.name)
        file.prettifyAndSave()
      }
    } catch (err) {
      console.error(err)
    }
    return this
  }
  autocompleteAppeared() {
    const { file } = this
    const year = file.githubRepo_firstCommit
    if (!file.appeared && year) {
      file.set("appeared", year)
      file.prettifyAndSave()
    }
    return this
  }
}
class GitHubImporter {
  constructor(scrollset) {
    this.scrollset = scrollset
  }

  async fetchAllRepoDataCommand() {
    console.log(`Fetching all...`)
    const crawler = new PoliteCrawler()
    crawler.maxConcurrent = 2
    await crawler.fetchAll(
      this.linkedFiles
        //.filter(file => !file.githubRepo_stars)
        .map(file => new ConceptFileWithGitHub(file, this.scrollset))
    )
  }
  get githubOfficiallySupportedLanguages() {
    // https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml
    return this.scrollset.concepts
      .filter(file => file.githubLanguage)
      .map(file => new ConceptFileWithGitHub(file, this.scrollset))
      .reverse()
  }
  async fetchAllRepoCountsCommand() {
    const { githubOfficiallySupportedLanguages } = this
    console.log(
      `Fetching repo counts for all ${githubOfficiallySupportedLanguages.length} languages supported by GitHub...`
    )
    const crawler = new PoliteCrawler()
    crawler.maxConcurrent = 1
    crawler.msDelayBetweenRequests = 100
    await crawler.fetchAll(
      githubOfficiallySupportedLanguages,
      "fetchRepoCounts"
    )
  }
  writeAllRepoCountsCommand() {
    this.githubOfficiallySupportedLanguages.forEach(file =>
      file.writeRepoCounts()
    )
  }
  writeAllRepoDataCommand() {
    this.linkedFiles.forEach(file => {
      new ConceptFileWithGitHub(file, this.scrollset)
        //.writeFirstCommitToDatabase()
        .writeRepoInfoToDatabase()
        .autocompleteAppeared()
      //.autocompleteCreators()
    })
  }
  get langs() {
    const map = this.yamlMap
    return Object.keys(map).map(key => {
      const value = map[key]
      value.title = key
      return value
    })
  }
  get yamlMap() {
    return YAML.parse(Disk.read(path.join(cacheDir, "languages.yml")))
  }
  async writeLanguageDataCommand() {
    this.matched.forEach(match => {
      const { file, lang } = match
      const {
        type,
        title,
        extensions,
        group,
        filenames,
        aliases,
        interpreters
      } = lang
      const ghNode = file.touchNode("githubLanguage")
      if (!ghNode.content) ghNode.setContent(title)
      ghNode.set("type", type)
      if (extensions)
        ghNode.set("fileExtensions", extensions.join(" ").replace(/\./g, ""))
      if (filenames) ghNode.set("filenames", filenames.join(" "))
      if (interpreters) ghNode.set("interpreters", interpreters.join(" "))
      if (aliases) {
        ghNode.delete("aliases")
        const delimiter = " or "
        Utils.ensureDelimiterNotFound(aliases, delimiter)
        ghNode.set("aliases", aliases.join(delimiter))
      }
      "ace_mode,codemirror_mode,codemirror_mime_type,tm_scope,wrap"
        .split(",")
        .forEach(key => {
          const value = lang[key]
          if (value) ghNode.set(key, value.toString())
        })
      if (group) {
        ghNode.set("group", group)
        // const conceptId = this.searchForConcept(group)
        // if (conceptId) ghNode.set("groupPldbId", conceptId)
      }
      file.prettifyAndSave()
    })
  }
  async writeLinksCommand() {
    this.matched.forEach(match => {
      const { file, lang } = match
      const { type, title } = lang
      const ghNode = file.touchNode("githubLanguage")
      if (!ghNode.content) {
        ghNode.setContent(title)
        file.prettifyAndSave()
      }
    })
  }
  get pairs() {
    return this.langs.map(lang => {
      const id = this.searchForConcept(lang.title)
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
  listOutdatedLangsCommand() {
    const map = this.yamlMap
    this.scrollset.concepts.forEach(file => {
      const title = file.githubLanguage
      if (title && !map[title])
        console.log(`Outdated: "${file.id}" has "${title}"`)
    })
  }
  listUnmatchedLangsCommand() {
    const missingPath = path.join(cacheDir, "missingLangs.json")
    Disk.write(missingPath, JSON.stringify(this.unmatched, null, 2))
    console.log(`Wrote ${this.unmatched.length} missing to: ${missingPath}`)
  }
  get linkedFiles() {
    return this.scrollset.concepts.filter(file => file.githubRepo)
  }
  async runAll(file) {
    if (!file.githubRepo) return
    const gitFile = new ConceptFileWithGitHub(file, this.scrollset)
    await gitFile.fetch()
    gitFile
      //.writeFirstCommitToDatabase()
      .writeRepoInfoToDatabase()
      .autocompleteAppeared()
  }
}
exports.GitHubImporter = GitHubImporter
