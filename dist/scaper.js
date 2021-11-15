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
exports.GithubScraper = void 0;
const core_1 = require("@octokit/core");
class GithubScraper {
    constructor(token, org) {
        this.github_token = token;
        this.org = org;
        this.orgID = "";
    }
    initAuthor(author, records) {
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
    pullCommitsStatistics(octokit, from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            let repsPagination = null;
            let done = false;
            // const dateOnlyDay = date.toISOString().substring(0, 10);
            let result = {};
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
            do {
                let commitsInfo = yield octokit.graphql({
                    query,
                    repsPagination,
                    since: from,
                    until: to,
                    org: this.org,
                });
                commitsInfo.organization.repositories.nodes.forEach((v) => {
                    let branches = v.refs.edges;
                    branches.forEach((b) => {
                        let branch = b.node;
                        let branchHistory = branch.target.history.edges;
                        // console.log(`Name: ${branch.name}`);
                        branchHistory.forEach((bh) => {
                            let commit = bh.node;
                            let commitedDate = Date.parse(commit.committedDate);
                            if (commit.author.user == null) {
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
                        });
                    });
                });
                if (commitsInfo.organization.repositories.pageInfo.hasNextPage) {
                    repsPagination =
                        commitsInfo.organization.repositories.pageInfo.endCursor;
                }
                else {
                    done = true;
                }
                repsProcessed += commitsInfo.organization.repositories.nodes.length;
            } while (!done);
            console.log(`Commits statistics processed ${repsProcessed} repositories`);
            return result;
        });
    }
    pullOpenIssuesStatistics(octokit, staleDays, oldDays) {
        return __awaiter(this, void 0, void 0, function* () {
            let issuePagination = null;
            let done = false;
            let result = {};
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
            let increment = (author, stale, old, isAuthor) => {
                if (!(author in result)) {
                    result = this.initAuthor(author, result);
                }
                if (isAuthor) {
                    result[author].openAuthorIssues++;
                }
                else {
                    result[author].openAssignIssues++;
                }
                if (stale) {
                    result[author].staleIssues++;
                }
                if (old) {
                    result[author].oldIssues++;
                }
            };
            do {
                let issuesInfo = yield octokit.graphql({
                    query,
                    issuePagination,
                });
                issuesInfo.search.edges.forEach((v) => {
                    let issue = v.node;
                    let issueAuthor = issue.author.login;
                    let assignesLogins = issue.assignees.nodes.map((l) => l.login);
                    let MSSinceUpdate = new Date().getTime() - Date.parse(issue.updatedAt);
                    let stale = MSSinceUpdate > staleDays * 1000 * 60 * 60 * 24;
                    let old = MSSinceUpdate > oldDays * 1000 * 60 * 60 * 24;
                    increment(issueAuthor, stale, old, true);
                    assignesLogins.forEach((assign) => {
                        increment(assign, stale, old, false);
                    });
                });
                if (issuesInfo.search.pageInfo.hasNextPage) {
                    issuePagination = issuesInfo.search.pageInfo.endCursor;
                }
                else {
                    done = true;
                }
                issuesProcessed += issuesInfo.search.edges.length;
            } while (!done);
            console.log(`Open Issues statistics processed ${issuesProcessed} issues`);
            return result;
        });
    }
    pullCloseIssuesActivity(octokit, from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            let issuePagination = null;
            let done = false;
            let result = {};
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
            do {
                let issuesInfo = yield octokit.graphql({
                    query,
                    issuePagination,
                });
                issuesInfo.search.edges.forEach((v) => {
                    let issue = v.node;
                    let issueAuthor = issue.author.login;
                    let assignesLogins = issue.assignees.nodes.map((l) => l.login);
                    // Have Processed All issues comments
                    issue.timelineItems.nodes.forEach((closedItem) => {
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
                        }
                        else if (assignesLogins.includes(closeAuthor)) {
                            result[closeAuthor].closedNotSelfIssues++;
                        }
                    });
                });
                if (issuesInfo.search.pageInfo.hasNextPage) {
                    issuePagination = issuesInfo.search.pageInfo.endCursor;
                }
                else {
                    done = true;
                }
                issuesProcessed += issuesInfo.search.edges.length;
            } while (!done);
            console.log(`Closing Issues activity processed ${issuesProcessed} issues`);
            return result;
        });
    }
    pullCommentsActivity(octokit, from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            let issuePagination = null;
            let commentPagination = null;
            let done = false;
            let result = {};
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
            do {
                let issuesInfo = yield octokit.graphql({
                    query,
                    issuePagination,
                    commentPagination,
                });
                issuesInfo.search.edges.forEach((v) => {
                    let issue = v.node;
                    let issueAuthor = issue.author.login;
                    let assignesLogins = issue.assignees.nodes.map((l) => l.login);
                    //Comments processing
                    issue.comments.nodes.forEach((comment) => {
                        let commentAuthor = comment.author.login;
                        let createdAt = Date.parse(comment.createdAt);
                        if (createdAt < from.getTime() || createdAt > to.getTime()) {
                            return;
                        }
                        if (!(commentAuthor in result)) {
                            result = this.initAuthor(commentAuthor, result);
                        }
                        if (commentAuthor == issueAuthor ||
                            assignesLogins.includes(commentAuthor)) {
                            result[commentAuthor].selfComments++;
                        }
                        else {
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
                }
                else {
                    done = true;
                }
                issuesProcessed++;
            } while (!done);
            console.log(`Issues Activity processed ${issuesProcessed} issues`);
            return result;
        });
    }
    pullAllUsersActivity(octokit, from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            let contribs = [];
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
            let getMemberResult = null;
            do {
                getMemberResult = yield octokit.graphql({
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
                    }
                    else {
                        paginationMember = null;
                    }
                    contribs.push({
                        Member: member.login,
                        CommitsCreated: member.contributionsCollection.totalCommitContributions,
                        IssuesCreated: member.contributionsCollection.totalIssueContributions,
                        PullRequestsOpened: member.contributionsCollection.totalPullRequestContributions,
                        PullRequestsReviewed: member.contributionsCollection.pullRequestReviewContributionsByRepository.reduce((v) => (v.contributions ? v.contributions.totalCount : 0), 0),
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
            console.log(`All Users Activity processed ${contribs.length} users`);
            return contribs;
        });
    }
    pullOrgID(octokit) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `query ($org: String!) {
      organization(login: $org) {
        id
      }
    }`;
            let getOrgIdResult = yield octokit.graphql({
                query,
                org: this.org,
            });
            this.orgID = getOrgIdResult.organization.id;
        });
    }
    scrape(from, to, stale, old) {
        return __awaiter(this, void 0, void 0, function* () {
            const octokit = new core_1.Octokit({ auth: this.github_token });
            yield this.pullOrgID(octokit);
            let [allUsersActivity, commitsStatistics, commentsActivity, closeActivity, openedIssuesActivity,] = yield Promise.all([
                this.pullAllUsersActivity(octokit, from, to),
                this.pullCommitsStatistics(octokit, from, to),
                this.pullCommentsActivity(octokit, from, to),
                this.pullCloseIssuesActivity(octokit, from, to),
                this.pullOpenIssuesStatistics(octokit, stale, old),
            ]);
            let result = allUsersActivity.map((v) => {
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
        });
    }
}
exports.GithubScraper = GithubScraper;
