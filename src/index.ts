import github from "@actions/github";
import core from "@actions/core";
import { graphql } from "@octokit/graphql";
import { GithubScraper } from "./scaper";

async function run() {
  // const token = core.getInput("action-token");
  // const aws_access_key_id = core.getInput("aws-access-key-id");
  // const aws_secret_access_key = core.getInput("aws-secret-access-key");
  // const reps = core.getInput("reps");
  // const octokit = github.getOctokit(token);
  // const context = github.context;
  // console.log(graphql);
  let scraper = new GithubScraper(token, "1712n");
  let to = new Date();
  let from = new Date();

  from.setDate(to.getDate() - 7);
  console.log(from, to);
  await scraper.scrape(from, to, 14, 120);
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
