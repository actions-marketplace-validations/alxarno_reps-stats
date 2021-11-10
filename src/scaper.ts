import { Octokit } from "@octokit/core"
import { IUserInfo } from "./interfaces";


export class GithubScraper {
  github_token: string;
  org: string;
  orgID: string;

  constructor(token: string, org: string) {
    this.github_token = token;
    this.org = org;
    this.orgID = ""
  }

  async pullOrgID(octokit: Octokit) {
    const query = `query ($org: String!) {
      organization(login: $org) {
        id
      }
    }`

    let getOrgIdResult: any = await octokit.graphql({
      query,
      org: this.org
    })

    this.orgID = getOrgIdResult.organization.id
  }

  async scrape() {
    const octokit = new Octokit({auth: this.github_token, })
    await this.pullOrgID(octokit)

    let contribs: IUserInfo[] = [];
    let paginationMember = null

 

    const query = `query ($org: String! $orgid: ID $cursorID: String $from: DateTime, $to: DateTime) {
      organization(login: $org ) {
        membersWithRole(first: 1, after: $cursorID) {
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
    let getMemberResult: any = null;

    let to = new Date()
    let from = new Date()

    from.setDate(to.getDate() - 7)
    console.log(from, to)

    do {
      getMemberResult = await octokit.graphql({
        query,
        org: this.org,
        orgid: this.orgID,
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

        contribs.push({
          Member: member.login,
          HasActiveContributions: member.contributionsCollection.hasAnyContributions,
          CommitsCreated: member.contributionsCollection.totalCommitContributions,
        })

      //   const userName = member.login;
      //   const activeContrib =
      //     member.contributionsCollection.hasAnyContributions;
      //   const commitContrib =
      //     member.contributionsCollection.totalCommitContributions;
      //   const issueContrib =
      //     member.contributionsCollection.totalIssueContributions;
      //   const prContrib =
      //     member.contributionsCollection.totalPullRequestContributions;
      //   const prreviewContrib =
      //     member.contributionsCollection.totalPullRequestReviewContributions;
      //   const repoIssueContrib =
      //     member.contributionsCollection.totalRepositoriesWithContributedIssues;
      //   const repoCommitContrib =
      //     member.contributionsCollection
      //       .totalRepositoriesWithContributedCommits;
      //   const repoPullRequestContrib =
      //     member.contributionsCollection
      //       .totalRepositoriesWithContributedPullRequests;
      //   const repoPullRequestReviewContrib =
      //     member.contributionsCollection
      //       .totalRepositoriesWithContributedPullRequestReviews;

      //   // Push all member contributions from query to array
      //   contribs.push({
      //     userName,
      //     activeContrib,
      //     commitContrib,
      //     issueContrib,
      //     prContrib,
      //     prreviewContrib,
      //     repoIssueContrib,
      //     repoCommitContrib,
      //     repoPullRequestContrib,
      //     repoPullRequestReviewContrib,
      //   });
      //   console.log(userName, contribs[0]);
      }
    // }
    } while (hasNextPageMember);
    contribs.forEach(v => {
      console.log(v)
    })
  }

  membersActivitys() {}
}
