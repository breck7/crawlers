"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
exports.StackOverflowDeveloperSurveyImporter = void 0
const fs = require("fs")
const csv = require("fast-csv")
const ss = require("simple-statistics")
const MeasurementsCrawler = require("../MeasurementsCrawler")
const { TreeNode } = require("jtree/products/TreeNode.js")
const { Utils } = require("jtree/products/Utils.js")
const lodash = require("lodash")
const { Disk } = require("jtree/products/Disk.node.js")
const cachePath = __dirname + "/cache/stack-overflow-developer-survey-2021/"
const filepath = cachePath + "survey_results_public.csv"
const processedPath = cachePath + "processed.json"
// https://insights.stackoverflow.com/survey
class StackOverflowDeveloperSurveyImporter extends MeasurementsCrawler.MeasurementsCrawler {
  constructor() {
    super(...arguments)
    this.users = {}
    this.totalRows = 0
  }
  processCsvCommand() {
    fs.createReadStream(filepath)
      .pipe(csv.parse({ headers: true }))
      .on("error", error => console.error(error))
      .on("data", row => this.processRow(row))
      .on("end", rowCount => this.done(rowCount))
  }
  done(rowCount) {
    console.log(`Parsed ${rowCount} rows`)
    Object.values(this.users).forEach(row => {
      if (row.salaries.length)
        row.medianSalary = Math.round(ss.median(row.salaries))
      row.percentageUsing = lodash.round(row.users / this.totalRows, 2)
      delete row.salaries
    })
    delete this.users["NA"]
    Disk.write(processedPath, JSON.stringify(this.users, null, 2))
  }
  writeToDatabaseCommand() {
    const objects = JSON.parse(Disk.read(processedPath))
    Object.values(objects).forEach(row => {
      const file = this.getFile(row.conceptId)
      file.appendLineAndChildren(
        "stackOverflowSurvey",
        `2021
 users ${row.users}
 medianSalary ${row.medianSalary}
 fans ${row.fans}
 percentageUsing ${row.percentageUsing}`
      )
      file.prettifyAndSave()
    })
    /*
    stackOverflowSurvey
     2021
      users
      medianSalary
    */
  }
  processRow(row) {
    const { users } = this
    const {
      LanguageHaveWorkedWith, // C++;HTML/CSS;JavaScript;Objective-C;PHP;Swift
      LanguageWantToWorkWith, // C++;HTML/CSS;JavaScript;Objective-C;PHP;Swift
      ConvertedCompYearly
    } = row
    this.totalRows++
    const hardCodedIds = { "HTML/CSS": "html", "Bash/Shell": "bash" }
    const initLang = lang => {
      if (!users[lang])
        users[lang] = {
          lang,
          users: 0,
          salaries: [],
          fans: 0,
          conceptId: this.searchForConcept(lang) || hardCodedIds[lang]
        }
    }
    LanguageHaveWorkedWith.split(";").forEach(lang => {
      initLang(lang)
      users[lang].users++
      if (ConvertedCompYearly && ConvertedCompYearly.match(/^\d+$/))
        users[lang].salaries.push(parseInt(ConvertedCompYearly))
    })
    LanguageWantToWorkWith.split(";").forEach(lang => {
      initLang(lang)
      users[lang].fans++
    })
  }
}
exports.StackOverflowDeveloperSurveyImporter = StackOverflowDeveloperSurveyImporter
