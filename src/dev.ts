import { GithubScraper } from "./scaper";
import { CSVWriter } from "./csv";
import { S3Dumper } from "./s3";
const core = require("@actions/core");

async function run() {
  const token = "***";
  let scraper = new GithubScraper(token, "1712n");
  let csvWriter = new CSVWriter();
  // let s3Dumper = new S3Dumper("***", "***", "github-metrics", "github-metrics");

  let to = new Date();
  let from = new Date();

  let startTimeString = to.toISOString().substring(0, 19);

  from.setDate(to.getDate() - 7);
  console.log(from, to);
  let scrapedData = await scraper.scrape(from, to, 14, 120);

  let csvBuff = await csvWriter.ToCSV(scrapedData);
  // await s3Dumper.Write(csvBuff, `${startTimeString}.csv`);
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
