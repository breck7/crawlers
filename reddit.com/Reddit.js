"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedditImporter = void 0;
const MeasurementsCrawler_1 = require("../MeasurementsCrawler");
const path = require("path");
const dayjs = require("dayjs");
const { Utils } = require("jtree/products/Utils.js");
const { Disk } = require("jtree/products/Disk.node.js");
const cachePath = path.join(__dirname, "cache");
Disk.mkdir(cachePath);
const getTitle_1 = require("./getTitle");
const subredditKeyword = "subreddit";
const year = "2024";
class RedditImporter extends MeasurementsCrawler_1.MeasurementsCrawler {
    writeToDatabaseCommand() {
        this.matches.forEach(file => {
            try {
                this.writeOne(file);
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    getCachePath(file) {
        return path.join(cachePath, this.getSubredditId(file) + ".json");
    }
    writeOne(file) {
        const cachePath = this.getCachePath(file);
        if (!Disk.exists(cachePath))
            return;
        const parsed = Disk.readJson(cachePath);
        const members = parsed.data.children[0].data.subscribers;
        const key = `${subredditKeyword} memberCount ${year}`;
        if (!file.get(key)) {
            file.set(key, members.toString());
            file.prettifyAndSave();
        }
    }
    get matches() {
        return this.concepts.filter(file => file.has(subredditKeyword));
    }
    getSubredditId(file) {
        var _a;
        return (_a = file
            .get("subreddit")) === null || _a === void 0 ? void 0 : _a.split("/").pop();
    }
    async fetchOne(file) {
        const cachePath = this.getCachePath(file);
        if (Disk.exists(cachePath))
            return this;
        const url = `https://www.reddit.com/subreddits/search.json?q=${this.getSubredditId(file)}`;
        console.log(`downloading ${url}`);
        await Disk.downloadJson(url, cachePath);
    }
    get announcements() {
        console.log(this.posts);
        return this.posts.filter(post => post.link_flair_text === "Language announcement");
    }
    findLangsCommand() { }
    get posts() {
        return Disk.getFullPaths(path.join(cachePath, "ProgrammingLanguages"))
            .filter(name => name.endsWith(".json"))
            .map(name => Disk.readJson(name).data.children)
            .flat();
    }
    printAnnouncementsCommand() {
        this.announcements.forEach(post => {
            if (!getTitle_1.handTitles[post.permalink])
                getTitle_1.handTitles[post.permalink] = post.title;
        });
        console.log(JSON.stringify(getTitle_1.handTitles, null, 2));
    }
    createFromAnnouncementsCommand() {
        console.log(1);
        this.announcements.forEach((post, index) => {
            console.log(index);
            const { url, created_utc, permalink, title } = post;
            const handTitle = (0, getTitle_1.getTitle)(post);
            if (!handTitle)
                return;
            const hit = this.searchForConcept(handTitle);
            if (hit)
                return;
            const type = "pl";
            const appeared = dayjs(created_utc * 1000).format("YYYY");
            let link = "";
            if (url.includes("github.com"))
                link = `githubRepo ${url}`;
            else if (!url.includes(permalink))
                link = `reference ${url}`;
            this.createFile(`id ${handTitle}
conceptDescription ${title}
tags ${type}
appeared ${appeared}
reference https://reddit.com${permalink}
${link}
`);
        });
    }
    async fetchAllCommand() {
        await Promise.all(this.matches.map(file => this.fetchOne(file)));
    }
}
exports.RedditImporter = RedditImporter;
