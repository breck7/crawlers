"use strict";
// Docs: https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_get_paper_search
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticScholarImporter = void 0;
const TreeBaseCrawler_1 = require("../TreeBaseCrawler");
const { TreeNode } = require("jtree/products/TreeNode.js");
const { Utils } = require("jtree/products/Utils.js");
const { Disk } = require("jtree/products/Disk.node.js");
const lodash = require("lodash");
const cacheDir = __dirname + "/cache/";
const superagent = require("superagent");
const path = require("path");
const downloadJson = async (url, destination) => {
    const agent = superagent.agent();
    console.log(`downloading ${url}`);
    const res = await agent.get(url);
    Disk.writeJson(destination, res.body || res.text || "");
};
Disk.mkdir(cacheDir);
class TreeBaseFileForSemanticScholar {
    constructor(file) {
        this.file = file;
    }
    get cacheFilePath() {
        return path.join(cacheDir, `${this.filename}.json`);
    }
    get filename() {
        return Utils.titleToPermalink(this.query);
    }
    get query() {
        return this.file.title + " programming language";
    }
    get parsed() {
        return JSON.parse(Disk.read(this.cacheFilePath));
    }
    get exists() {
        return Disk.exists(this.cacheFilePath);
    }
    async fetch() {
        const { cacheFilePath } = this;
        if (this.exists)
            return true;
        const fields = `title,authors,abstract,year,citationCount,influentialCitationCount,publicationTypes,referenceCount,fieldsOfStudy,journal,externalIds`;
        try {
            await downloadJson(`http://api.semanticscholar.org/graph/v1/paper/search?query=${this.query}&limit=100&fields=${fields}`, cacheFilePath);
        }
        catch (err) {
            //Disk.write(repoFilePath, JSON.stringify(err))
            console.error(err);
        }
    }
    get hits() {
        const { file } = this;
        const langTitle = this.file.title.toLowerCase();
        return this.parsed.data.filter(paper => {
            var _a;
            const { title, abstract, citationCount, influentialCitationCount, year, externalIds } = paper;
            const titleContainsExactMatch = title
                .split(" ")
                .some(word => word.toLowerCase() === langTitle);
            if (!titleContainsExactMatch)
                return false;
            if (!citationCount)
                return false;
            if (!externalIds.DOI)
                return false;
            if (title.toLowerCase().includes("programming"))
                return true;
            if ((_a = paper.fieldsOfStudy) === null || _a === void 0 ? void 0 : _a.includes("Computer Science"))
                return true;
            const content = new TreeNode(paper).toString().toLowerCase();
            const isTechnical = content.includes("programming");
            return isTechnical;
        });
    }
    writePapers() {
        if (!this.exists)
            return true;
        const { hits, file } = this;
        const keyInfo = hits.map(paper => {
            const { title, year, externalIds, paperId, citationCount, influentialCitationCount, authors } = paper;
            return {
                year,
                title,
                doi: externalIds.DOI,
                citations: citationCount,
                influentialCitations: influentialCitationCount,
                authors: authors.map(author => author.name).join(" and "),
                paperId
            };
        });
        const count = hits.length;
        file.set("semanticScholar", `${count}`);
        const sorted = lodash.sortBy(keyInfo, ["citations"]).reverse();
        if (count)
            file
                .getNode("semanticScholar")
                .setChildren(new TreeNode(sorted).toDelimited("|"));
        file.prettifyAndSave();
    }
}
class SemanticScholarImporter extends TreeBaseCrawler_1.TreeBaseCrawler {
    async fetchAllCommand() {
        console.log(`Fetching all...`);
        const crawler = new TreeBaseCrawler_1.PoliteCrawler();
        crawler.maxConcurrent = 2;
        crawler.msDelayBetweenRequests = 3000;
        await crawler.fetchAll(this.unfetched);
    }
    get files() {
        return this.base.topLanguages.map(file => new TreeBaseFileForSemanticScholar(file));
    }
    get unfetched() {
        return this.files.filter(file => !file.exists).reverse();
    }
    writeAllCommand() {
        this.files.forEach(file => file.writePapers());
    }
}
exports.SemanticScholarImporter = SemanticScholarImporter;
