import github from "@actions/github";
import Octokit from "@octokit/types";

export class GithubScraper {
  github_token: string;
  reps: string[];
  ordID: string;

  constructor(token: string, reps: string[], orgID: string) {
    this.github_token = token;
    this.reps = reps;
    this.ordID = orgID;
  }

  async scrape() {
    const octokit = github.getOctokit(this.github_token);
    let contribs = [];
    const query = `query ($org: String! $orgid: ID $cursorID: String $from: DateTime, $to: DateTime) {
      organization(login: $org ) {
        membersWithRole(first: 25, after: $cursorID) {
          nodes {
            login
            contributionsCollection (organizationID: $orgid, from: $from, to: $to) {
              hasAnyContributions
              totalCommitContributions
              totalIssueContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              totalRepositoriesWithContributedIssues
              totalRepositoriesWithContributedCommits
              totalRepositoriesWithContributedPullRequests
              totalRepositoriesWithContributedPullRequestReviews
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }`;

    let hasNextPageMember = false;
    let getMemberResult = null;

    do {
      getMemberResult = await octokit.graphql({
        query,
        org,
        orgid,
        from,
        to,
        cursorID: paginationMember,
      });

      const membersObj = getMemberResult.organization.membersWithRole.nodes;
      hasNextPageMember =
        getMemberResult.organization.membersWithRole.pageInfo.hasNextPage;

      for (const member of membersObj) {
        if (hasNextPageMember) {
          paginationMember =
            getMemberResult.organization.membersWithRole.pageInfo.endCursor;
        } else {
          paginationMember = null;
        }

        const userName = member.login;
        const activeContrib =
          member.contributionsCollection.hasAnyContributions;
        const commitContrib =
          member.contributionsCollection.totalCommitContributions;
        const issueContrib =
          member.contributionsCollection.totalIssueContributions;
        const prContrib =
          member.contributionsCollection.totalPullRequestContributions;
        const prreviewContrib =
          member.contributionsCollection.totalPullRequestReviewContributions;
        const repoIssueContrib =
          member.contributionsCollection.totalRepositoriesWithContributedIssues;
        const repoCommitContrib =
          member.contributionsCollection
            .totalRepositoriesWithContributedCommits;
        const repoPullRequestContrib =
          member.contributionsCollection
            .totalRepositoriesWithContributedPullRequests;
        const repoPullRequestReviewContrib =
          member.contributionsCollection
            .totalRepositoriesWithContributedPullRequestReviews;

        // Push all member contributions from query to array
        contribs.push({
          userName,
          activeContrib,
          commitContrib,
          issueContrib,
          prContrib,
          prreviewContrib,
          repoIssueContrib,
          repoCommitContrib,
          repoPullRequestContrib,
          repoPullRequestReviewContrib,
        });
        console.log(userName);
      }
    } while (hasNextPageMember);
  }

  membersActivitys() {}
}
