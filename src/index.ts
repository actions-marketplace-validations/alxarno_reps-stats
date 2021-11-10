import github from "@actions/github";
import core from "@actions/core";
import { graphql } from "@octokit/graphql";

async function run() {
  const token = core.getInput("action-token");
  const aws_access_key_id = core.getInput("aws-access-key-id");
  const aws_secret_access_key = core.getInput("aws-secret-access-key");
  const projectUrl = core.getInput("project-url");
  const columnName = core.getInput("column-name");
  const labelName = core.getInput("label-name");
  const milestoneName = core.getInput("milestone-name");
  const ignoreList = core.getInput("columns-to-ignore");
  const octokit = github.getOctokit(token);
  const context = github.context;
  console.log(graphql);
}

run().then(
  (response) => {
    console.log(`Finished running: ${response}`);
  },
  (error) => {
    console.log(`#ERROR# ${error}`);
    process.exit(1);
  }
);
