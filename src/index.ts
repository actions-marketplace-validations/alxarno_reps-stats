import { GithubScraper } from "./scaper";
import { CSVWriter } from "./csv";
import { FileDumper } from "./file";
import { S3Dumper } from "./s3";
const core = require("@actions/core");

async function run() {
  const token = core.getInput("token");
  const aws_access_key_id = core.getInput("aws-access-key-id");
  const aws_secret_access_key = core.getInput("aws-secret-access-key");
  const bucket = core.getInput("aws-s3-bucket");
  const path = core.getInput("aws-s3-path");
  const org = core.getInput("org-name");
  const days = core.getInput("days") || 1;
  const stale = core.getInput("stale") || 0;
  const old = core.getInput("old") || 0;

  let s3Dumper = new S3Dumper(
    aws_access_key_id,
    aws_secret_access_key,
    bucket,
    path
  );
  let scraper = new GithubScraper(token, org);
  let csvWriter = new CSVWriter();

  let to = new Date();
  let from = new Date();

  let startTimeString = to.toISOString().substring(0, 19);

  from.setDate(to.getDate() - days);
  console.log(from, to);
  let scrapedData = await scraper.scrape(from, to, stale, old);

  let csvBuff = await csvWriter.ToCSV(scrapedData);
  await s3Dumper.Write(csvBuff, `${startTimeString}.csv`);
  return "Done good";
}

run().then(
  (response) => {
    console.log(`Finished running: ${response}`);
  },
  (error) => {
    console.log(`ERROR ${error}`);
    process.exit(1);
  }
);
