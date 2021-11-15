define("csv", ["require", "exports", "tslib"], function (require, exports, tslib_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CSVWriter = void 0;
    const ObjectsToCsv = require("objects-to-csv");
    class CSVWriter {
        constructor() { }
        ToCSV(data) {
            return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                const csv = new ObjectsToCsv(data);
                let csvString = yield csv.toString(true, true);
                console.log(csvString);
                return Buffer.from(csvString, "utf8");
            });
        }
    }
    exports.CSVWriter = CSVWriter;
});
define("interfaces", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("scaper", ["require", "exports", "tslib", "@octokit/core"], function (require, exports, tslib_2, core_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GithubScraper = void 0;
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_2.__awaiter)(this, void 0, void 0, function* () {
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
});
define("file", ["require", "exports", "tslib"], function (require, exports, tslib_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FileDumper = void 0;
    const fs = require("fs");
    class FileDumper {
        constructor() { }
        Write(buff) {
            return (0, tslib_3.__awaiter)(this, void 0, void 0, function* () {
                fs.writeFileSync("./test.csv", buff);
            });
        }
    }
    exports.FileDumper = FileDumper;
});
define("s3", ["require", "exports", "tslib", "aws-sdk"], function (require, exports, tslib_4, aws_sdk_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.S3Dumper = void 0;
    aws_sdk_1 = (0, tslib_4.__importDefault)(aws_sdk_1);
    class S3Dumper {
        constructor(ID, SECRET, bucket, path) {
            this.s3Client = null;
            this.bucket = "";
            this.path = "";
            this.s3Client = new aws_sdk_1.default.S3({
                accessKeyId: ID,
                secretAccessKey: SECRET,
            });
            this.bucket = bucket;
            this.path = path;
        }
        Write(buff, name) {
            return (0, tslib_4.__awaiter)(this, void 0, void 0, function* () {
                let key = `${this.path}/${name}`;
                console.log(`Putting s3 object in bucket ${this.bucket}, path - ${key}`);
                const putParams = {
                    Bucket: this.bucket,
                    Key: key,
                    Body: buff,
                };
                yield new Promise((res, rej) => {
                    this.s3Client.putObject(putParams, function (putErr, putData) {
                        if (putErr) {
                            console.error(putErr);
                            rej();
                        }
                        else {
                            res(putData);
                        }
                    });
                });
            });
        }
    }
    exports.S3Dumper = S3Dumper;
});
define("dev", ["require", "exports", "tslib", "scaper", "csv", "s3"], function (require, exports, tslib_5, scaper_1, csv_1, s3_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function run() {
        return (0, tslib_5.__awaiter)(this, void 0, void 0, function* () {
            const token = "***";
            let scraper = new scaper_1.GithubScraper(token, "1712n");
            let csvWriter = new csv_1.CSVWriter();
            let s3Dumper = new s3_1.S3Dumper("***", "***", "nterminal-lite", "debug/github-statistics");
            let to = new Date();
            let from = new Date();
            let startTimeString = to.toISOString().substring(0, 19);
            from.setDate(to.getDate() - 1);
            console.log(from, to);
            let scrapedData = yield scraper.scrape(from, to, 14, 120);
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
});
define("index", ["require", "exports", "tslib", "scaper", "csv", "s3"], function (require, exports, tslib_6, scaper_2, csv_2, s3_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const core = require("@actions/core");
    function run() {
        return (0, tslib_6.__awaiter)(this, void 0, void 0, function* () {
            const token = core.getInput("token");
            const aws_access_key_id = core.getInput("aws-access-key-id");
            const aws_secret_access_key = core.getInput("aws-secret-access-key");
            const bucket = core.getInput("aws-s3-bucket");
            const path = core.getInput("aws-s3-path");
            const org = core.getInput("org-name");
            const days = core.getInput("days") || 1;
            const stale = core.getInput("stale") || 0;
            const old = core.getInput("old") || 0;
            let s3Dumper = new s3_2.S3Dumper(aws_access_key_id, aws_secret_access_key, bucket, path);
            let scraper = new scaper_2.GithubScraper(token, org);
            let csvWriter = new csv_2.CSVWriter();
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
});
