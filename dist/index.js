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
const s3_1 = require("./s3");
const core = require("@actions/core");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = core.getInput("token");
        const aws_access_key_id = core.getInput("aws-access-key-id");
        const aws_secret_access_key = core.getInput("aws-secret-access-key");
        const bucket = core.getInput("aws-s3-bucket");
        const path = core.getInput("aws-s3-path");
        const org = core.getInput("org-name");
        const days = core.getInput("days") || 1;
        const stale = core.getInput("stale") || 0;
        const old = core.getInput("old") || 0;
        let s3Dumper = new s3_1.S3Dumper(aws_access_key_id, aws_secret_access_key, bucket, path);
        let scraper = new scaper_1.GithubScraper(token, org);
        let csvWriter = new csv_1.CSVWriter();
        let to = new Date();
        let from = new Date();
        let startTimeString = to.toISOString().substring(0, 19);
        from.setDate(to.getDate() - days);
        console.log(from, to);
        let scrapedData = yield scraper.scrape(from, to, stale, old);
        let csvBuff = yield csvWriter.ToCSV(scrapedData);
        yield s3Dumper.Write(csvBuff, `${startTimeString}.csv`);
        return "Done good";
    });
}
run().then((response) => {
    console.log(`Finished running: ${response}`);
}, (error) => {
    console.log(`ERROR ${error}`);
    process.exit(1);
});
