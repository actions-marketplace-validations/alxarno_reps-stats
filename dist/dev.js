"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const scaper_1 = require("./scaper");
const csv_1 = require("./csv");
const core = require("@actions/core");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = "***";
        let scraper = new scaper_1.GithubScraper(token, "1712n");
        let csvWriter = new csv_1.CSVWriter();
        // let s3Dumper = new S3Dumper("***", "***", "github-metrics", "github-metrics");
        let to = new Date();
        let from = new Date();
        let startTimeString = to.toISOString().substring(0, 19);
        from.setDate(to.getDate() - 1);
        console.log(from, to);
        let scrapedData = yield scraper.scrape(from, to, 14, 120);
        let csvBuff = yield csvWriter.ToCSV(scrapedData);
        // await s3Dumper.Write(csvBuff, `${startTimeString}.csv`);
        return "Done good";
    });
}
run().then((response) => {
    console.log(`Finished running: ${response}`);
}, (error) => {
    console.log(`ERROR ${error}`);
    process.exit(1);
});
