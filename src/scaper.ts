import { Octokit } from "@octokit/core";
import { IUserInfo } from "./interfaces";

type IActivity = {
  selfComments: number;
  notSelfComments: number;
  closedSelfIssues: number;
  closedNotSelfIssues: number;
  openAuthorIssues: number;
  openAssignIssues: number;
  staleIssues: number;
  oldIssues: number;
  codeLinesAdded: number;
  codeLinesRemoved: number;
};

export class GithubScraper {
  github_token: string;
  org: string;
  orgID: string;

  constructor(token: string, org: string) {
    this.github_token = token;
    this.org = org;
    this.orgID = "";
  }

  initAuthor(
    author: string,
    records: Record<string, IActivity>
  ): Record<string, IActivity> {
    records[author] = {
      notSelfComments: 0,
      selfComments: 0,
      closedNotSelfIssues: 0,
      closedSelfIssues: 0,
      openAssignIssues: 0,
      openAuthorIssues: 0,
      oldIssues: 0,
      staleIssues: 0,
      codeLinesAdded: 0,
      codeLinesRemoved: 0,
    };
    return records;
  }

  async pullCommitsStatistics(
    octokit: Octokit,
    from: Date,
    to: Date
  ): Promise<Record<string, IActivity>> {
    let repsPagination = null;
    let done = false;
    let commitsIds: string[] = [];
    // const dateOnlyDay = date.toISOString().substring(0, 10);
    let result: Record<string, IActivity> = {};
    const query = `
    query ($org: String! $repsPagination: String $since: GitTimestamp $until: GitTimestamp) {
      organization(login: $org ) {
        repositories(first: 5, after: $repsPagination) {
          nodes {
            refs(refPrefix: "refs/heads/", orderBy: {direction: DESC, field: TAG_COMMIT_DATE}, first: 15) {
              edges {
                node {
                  ... on Ref {
                    name
                    target {
                      ... on Commit {
                        history(first: 100, since: $since, until: $until) {
                          edges {
                            node {
                              ... on Commit {
                                abbreviatedOid
                                committedDate
                                author{
                                  user {
                                    login
                                  }
                                }
                                deletions
                                additions
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }`;

    let repsProcessed = 0;
    let requests = 0;
    do {
      let commitsInfo: any = await octokit.graphql({
        query,
        repsPagination,
        since: from,
        until: to,
        org: this.org,
      });

      commitsInfo.organization.repositories.nodes.forEach((v: any) => {
        let branches = v.refs.edges;
        branches.forEach((b: any) => {
          let branch = b.node;
          let branchHistory = branch.target.history.edges;

          // console.log(`Name: ${branch.name}`);
          branchHistory.forEach((bh: any) => {
            let commit = bh.node;
            let commitedDate = Date.parse(commit.committedDate);
            if (
              commit.author.user == null ||
              commitsIds.includes(commit.abbreviatedOid)
            ) {
              return;
            }
            let commitAuthor = commit.author.user.login;

            if (commitedDate < from.getTime() || commitedDate > to.getTime()) {
              return;
            }

            if (!(commitAuthor in result)) {
              result = this.initAuthor(commitAuthor, result);
            }

            result[commitAuthor].codeLinesAdded += commit.additions;
            result[commitAuthor].codeLinesRemoved += commit.deletions;
            commitsIds.push(commit.abbreviatedOid);
          });
        });
      });

      if (commitsInfo.organization.repositories.pageInfo.hasNextPage) {
        repsPagination =
          commitsInfo.organization.repositories.pageInfo.endCursor;
      } else {
        done = true;
      }
      repsProcessed += commitsInfo.organization.repositories.nodes.length;
      requests++;
    } while (!done);
    console.log(
      `Commits statistics processed ${repsProcessed} repositories, made ${requests} requests`
    );

    return result;
  }

  async pullOpenIssuesStatistics(
    octokit: Octokit,
    staleDays: number,
    oldDays: number
  ): Promise<Record<string, IActivity>> {
    let issuePagination = null;
    let done = false;
    let result: Record<string, IActivity> = {};
    const query = `
    query updatedIssues($issuePagination: String) {
      search(query: "org:1712n is:issue state:open", type: ISSUE, first: 25, after: $issuePagination) {
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        edges {
          node {
            ... on Issue {
              updatedAt
              author {
                login
              }
              assignees(first: 20) {
                nodes {
                  login
                }
              }
            }
          }
        }
      }
    }`;

    let issuesProcessed = 0;

    let increment = (
      author: string,
      stale: boolean,
      old: boolean,
      isAuthor: boolean
    ) => {
      if (!(author in result)) {
        result = this.initAuthor(author, result);
      }

      if (isAuthor) {
        result[author].openAuthorIssues++;
      } else {
        result[author].openAssignIssues++;

        if (stale) {
          result[author].staleIssues++;
        }

        if (old) {
          result[author].oldIssues++;
        }
      }
    };
    let requests = 0;
    do {
      let issuesInfo: any = await octokit.graphql({
        query,
        issuePagination,
      });
      requests++;
      issuesInfo.search.edges.forEach((v: any) => {
        let issue = v.node;
        let issueAuthor = issue.author.login;
        let assignesLogins = issue.assignees.nodes.map((l: any) => l.login);
        let MSSinceUpdate = new Date().getTime() - Date.parse(issue.updatedAt);
        let stale = MSSinceUpdate > staleDays * 1000 * 60 * 60 * 24;
        let old = MSSinceUpdate > oldDays * 1000 * 60 * 60 * 24;

        increment(issueAuthor, stale, old, true);

        assignesLogins.forEach((assign: string) => {
          increment(assign, stale, old, false);
        });
      });

      if (issuesInfo.search.pageInfo.hasNextPage) {
        issuePagination = issuesInfo.search.pageInfo.endCursor;
      } else {
        done = true;
      }
      issuesProcessed += issuesInfo.search.edges.length;
    } while (!done);
    console.log(
      `Open Issues statistics processed ${issuesProcessed} issues, made ${requests} requests`
    );

    return result;
  }

  async pullCloseIssuesActivity(
    octokit: Octokit,
    from: Date,
    to: Date
  ): Promise<Record<string, IActivity>> {
    let issuePagination = null;
    let done = false;
    let result: Record<string, IActivity> = {};
    const fromISO = from.toISOString().substring(0, 19);
    const toISO = to.toISOString().substring(0, 19);
    const query = `
    query updatedIssues($issuePagination: String) {
      search(query: "org:1712n is:issue closed:${fromISO}..${toISO}", type: ISSUE, first: 25, after: $issuePagination) {
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        edges {
          node {
            ... on Issue {
              author {
                login
              }
              assignees(first: 20) {
                nodes {
                  login
                }
              }
              timelineItems(last: 10, itemTypes: [CLOSED_EVENT]) {
                nodes{
                  __typename
                  ... on ClosedEvent {
                    actor {
                      login
                    }
                    createdAt
                  }
                }
              }
            }
          }
        }
      }
    }`;

    let issuesProcessed = 0;
    let requests = 0;
    do {
      let issuesInfo: any = await octokit.graphql({
        query,
        issuePagination,
      });
      requests++;
      issuesInfo.search.edges.forEach((v: any) => {
        let issue = v.node;
        let issueAuthor = issue.author.login;
        let assignesLogins = issue.assignees.nodes.map((l: any) => l.login);

        // Have Processed All issues comments
        issue.timelineItems.nodes.forEach((closedItem: any) => {
          let closeAuthor = closedItem.actor.login;
          let closed = Date.parse(closedItem.createdAt);
          if (closed < from.getTime() || closed > to.getTime()) {
            return;
          }
          if (!(closeAuthor in result)) {
            result = this.initAuthor(closeAuthor, result);
          }

          if (issueAuthor == closeAuthor) {
            result[closeAuthor].closedSelfIssues++;
          } else if (assignesLogins.includes(closeAuthor)) {
            result[closeAuthor].closedNotSelfIssues++;
          }
        });
      });

      if (issuesInfo.search.pageInfo.hasNextPage) {
        issuePagination = issuesInfo.search.pageInfo.endCursor;
      } else {
        done = true;
      }
      issuesProcessed += issuesInfo.search.edges.length;
    } while (!done);
    console.log(
      `Closing Issues activity processed ${issuesProcessed} issues, made ${requests} requests`
    );

    return result;
  }

  async pullCommentsActivity(
    octokit: Octokit,
    from: Date,
    to: Date
  ): Promise<Record<string, IActivity>> {
    let issuePagination = null;
    let commentPagination = null;
    let done = false;
    let result: Record<string, IActivity> = {};
    // const dateOnlyDay = date.toISOString().substring(0, 10);

    // const commentsCreatedFilter = Date.parse(dateOnlyDay);
    const query = `
    query updatedIssues($issuePagination: String, $commentPagination: String) {
      search(query: "org:1712n is:issue updated:${from
        .toISOString()
        .substring(0, 19)}..${to
      .toISOString()
      .substring(0, 19)}", type: ISSUE, first: 1, after: $issuePagination) {
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        edges {
          node {
            ... on Issue {
              closed
              title
              author {
                login
              }
              assignees(first: 20) {
                nodes {
                  login
                }
              }
              timelineItems(last: 10, itemTypes: [CLOSED_EVENT]) {
                nodes{
                  __typename
                  ... on ClosedEvent {
                    actor {
                      login
                    }
                    createdAt
                  }
                }
              }
              comments (last: 10, before: $commentPagination) {
                nodes {
                  author {
                    login
                  }
                  createdAt
                }
                pageInfo {
                  startCursor
                  hasPreviousPage
                }
              }
            }
          }
        }
      }
    }`;

    let issuesProcessed = 0;
    let requests = 0;
    let objects = 0;
    let issuesInfo: any = null;
    do {
      try {
        issuesInfo = await octokit.graphql({
          query,
          issuePagination,
          commentPagination,
        });
        requests++;
      } catch (e) {
        console.log(
          `Issues Activity failed ${issuesProcessed} issues, made ${requests} requests`
        );
        throw e;
      }
      issuesInfo.search.edges.forEach((v: any) => {
        let issue = v.node;
        let issueAuthor = issue.author.login;
        let assignesLogins = issue.assignees.nodes.map((l: any) => l.login);

        //Comments processing
        issue.comments.nodes.forEach((comment: any) => {
          let commentAuthor = comment.author.login;
          let createdAt: number = Date.parse(comment.createdAt);
          if (createdAt < from.getTime() || createdAt > to.getTime()) {
            return;
          }
          if (!(commentAuthor in result)) {
            result = this.initAuthor(commentAuthor, result);
          }

          if (
            commentAuthor == issueAuthor ||
            assignesLogins.includes(commentAuthor)
          ) {
            result[commentAuthor].selfComments++;
          } else {
            result[commentAuthor].notSelfComments++;
          }
        });
      });
      if (issuesInfo.search.edges[0].node.hasPreviousPage) {
        commentPagination = issuesInfo.search.edges[0].node.startCursor;
        continue;
      }

      if (issuesInfo.search.pageInfo.hasNextPage) {
        issuePagination = issuesInfo.search.pageInfo.endCursor;
      } else {
        done = true;
      }
      issuesProcessed++;
    } while (!done);

    console.log(
      `Issues Activity processed ${issuesProcessed} issues, made ${requests} requests`
    );

    return result;
  }

  async pullRateLimits(octokit: Octokit) {
    let response = await octokit.request("GET /rate_limit");
    console.log("Rate limits");
    console.log(response.data.resources);
  }

  async pullAllUsersActivity(
    octokit: Octokit,
    from: Date,
    to: Date
  ): Promise<IUserInfo[]> {
    let contribs: IUserInfo[] = [];
    let paginationMember = null;

    const query = `query ($org: String! $orgid: ID $cursorID: String $from: DateTime, $to: DateTime) {
      organization(login: $org ) {
        membersWithRole(first: 25, after: $cursorID) {
          nodes {
            login
            contributionsCollection (organizationID: $orgid, from: $from, to: $to) {
              totalCommitContributions
              totalIssueContributions
              totalPullRequestContributions
              pullRequestReviewContributionsByRepository(maxRepositories: 100) {
                contributions {
                  totalCount
                }
              }
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
    let requests = 0;
    do {
      getMemberResult = await octokit.graphql({
        query,
        org: this.org,
        orgid: this.orgID,
        from,
        to,
        cursorID: paginationMember,
      });
      requests++;
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
          CommitsCreated:
            member.contributionsCollection.totalCommitContributions,
          IssuesCreated: member.contributionsCollection.totalIssueContributions,
          PullRequestsOpened:
            member.contributionsCollection.totalPullRequestContributions,
          PullRequestsReviewed:
            member.contributionsCollection.pullRequestReviewContributionsByRepository.reduce(
              (v: any) => (v.contributions ? v.contributions.totalCount : 0),
              0
            ),
          From: from.toISOString().substring(0, 19),
          To: to.toISOString().substring(0, 19),
          ClosedNotSelfIssues: 0,
          ClosedSelfIssues: 0,
          CodeLinesAdded: 0,
          CodeLinesRemoved: 0,
          CommentsInNotSelfIssues: 0,
          CommentsInOpenedAssignedIssues: 0,
          OldIssues: 0,
          OpenIssuesAssign: 0,
          OpenIssuesAuthor: 0,
          StaleIssues: 0,
        });
      }
    } while (hasNextPageMember);
    console.log(
      `All Users Activity processed ${contribs.length} users, made ${requests} requests`
    );
    return contribs;
  }

  async pullOrgID(octokit: Octokit) {
    const query = `query ($org: String!) {
      organization(login: $org) {
        id
      }
    }`;

    let getOrgIdResult: any = await octokit.graphql({
      query,
      org: this.org,
    });

    this.orgID = getOrgIdResult.organization.id;
  }

  async scrape(
    from: Date,
    to: Date,
    stale: number,
    old: number
  ): Promise<IUserInfo[]> {
    const octokit = new Octokit({ auth: this.github_token });
    await this.pullOrgID(octokit);
    await this.pullRateLimits(octokit);
    let [
      allUsersActivity,
      commitsStatistics,
      commentsActivity,
      closeActivity,
      openedIssuesActivity,
    ] = await Promise.all([
      this.pullAllUsersActivity(octokit, from, to),
      this.pullCommitsStatistics(octokit, from, to),
      this.pullCommentsActivity(octokit, from, to),
      this.pullCloseIssuesActivity(octokit, from, to),
      this.pullOpenIssuesStatistics(octokit, stale, old),
    ]);
    await this.pullRateLimits(octokit);

    let result: IUserInfo[] = allUsersActivity.map((v: IUserInfo) => {
      let login = v.Member;

      if (login in commitsStatistics) {
        v.CodeLinesAdded = commitsStatistics[login].codeLinesAdded;
        v.CodeLinesRemoved = commitsStatistics[login].codeLinesRemoved;
      }

      if (login in commentsActivity) {
        v.CommentsInNotSelfIssues = commentsActivity[login].notSelfComments;
        v.CommentsInOpenedAssignedIssues = commentsActivity[login].selfComments;
      }

      if (login in closeActivity) {
        v.ClosedSelfIssues = closeActivity[login].closedSelfIssues;
        v.ClosedNotSelfIssues = closeActivity[login].closedNotSelfIssues;
      }

      if (login in openedIssuesActivity) {
        v.OpenIssuesAuthor = openedIssuesActivity[login].openAuthorIssues;
        v.OpenIssuesAssign = openedIssuesActivity[login].openAssignIssues;
        v.StaleIssues = openedIssuesActivity[login].staleIssues;
        v.OldIssues = openedIssuesActivity[login].oldIssues;
      }

      return v;
    });

    return result;
  }
}
