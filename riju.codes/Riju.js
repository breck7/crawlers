"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RijuImporter = void 0;
const TrueBaseCrawler_1 = require("../TrueBaseCrawler");
const yaml_1 = require("yaml");
const { Utils } = require("jtree/products/Utils.js");
const { Disk } = require("jtree/products/Disk.node.js");
const cachePath = __dirname + "/cache/riju/langs/";
const scopeName = "rijuRepl";
class RijuImporter extends TrueBaseCrawler_1.TrueBaseCrawler {
    writeLinksToDatabaseCommand() {
        this.matches.forEach(match => {
            match.trueBaseFile.set(scopeName, `https://riju.codes/${match.yaml.id}`);
            match.trueBaseFile.prettifyAndSave();
        });
    }
    get yamlFiles() {
        return Disk.getFullPaths(cachePath).map(path => (0, yaml_1.parse)(Disk.read(path)));
    }
    get matches() {
        return this.yamlFiles
            .map(yaml => {
            const { id } = yaml;
            const match = this.base.searchForEntity(id);
            if (match)
                return {
                    trueBaseFile: this.base.getFile(match),
                    yaml
                };
        })
            .filter(i => i);
    }
    listMissingCommand() {
        this.missing.map(yaml => console.log(`Missing language: ${yaml.id}`));
    }
    get missing() {
        return this.yamlFiles.filter(yaml => !this.base.searchForEntity(yaml.id));
    }
    addMissingCommand() {
        this.missing.forEach(yaml => {
            var _a;
            const type = ((_a = yaml.info) === null || _a === void 0 ? void 0 : _a.category) === "esoteric" ? "esolang" : "pl";
            this.base.createFile(`title ${yaml.name}
type ${type}`, yaml.id);
        });
    }
    mergeOne(match) {
        var _a, _b;
        const { trueBaseFile, yaml } = match;
        const object = trueBaseFile.toObject();
        const { info } = yaml;
        const node = trueBaseFile.getNode(scopeName);
        if (yaml.template)
            node.appendLineAndChildren("example", yaml.template);
        if (info) {
            if (info.desc)
                node.set("description", info.desc);
            if (info.year && !object.appeared)
                trueBaseFile.set("appeared", info.year.toString());
            if (((_a = info.web) === null || _a === void 0 ? void 0 : _a.esolang) && !object.esolang)
                trueBaseFile.set("esolang", (_b = info.web) === null || _b === void 0 ? void 0 : _b.esolang);
            if (info.ext)
                node.set("fileExtensions", info.ext.join ? info.ext.join(" ") : info.ext);
            if (info.web.home)
                node.set("website", info.web.home);
            if (info.web.source)
                node.set("githubRepo", info.web.source);
        }
        trueBaseFile.prettifyAndSave();
    }
    mergeInfoCommand() {
        this.matches.forEach(match => {
            try {
                this.mergeOne(match);
            }
            catch (err) {
                console.error(match.yaml.id, err);
            }
        });
    }
}
exports.RijuImporter = RijuImporter;
