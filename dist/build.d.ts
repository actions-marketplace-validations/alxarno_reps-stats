/// <reference types="node" />
declare module "csv" {
    export class CSVWriter {
        constructor();
        ToCSV(data: any): Promise<Buffer>;
    }
}
declare module "interfaces" {
    export interface IUserInfo {
        Member: string;
        CommitsCreated: number;
        IssuesCreated: number;
        OpenIssuesAuthor: number;
        OpenIssuesAssign: number;
        PullRequestsOpened: number;
        PullRequestsReviewed: number;
        CommentsInOpenedAssignedIssues: number;
        CommentsInNotSelfIssues: number;
        ClosedSelfIssues: number;
        ClosedNotSelfIssues: number;
        StaleIssues: number;
        OldIssues: number;
        CodeLinesAdded: number;
        CodeLinesRemoved: number;
        From: string;
        To: string;
    }
    export interface IDumper {
        Write(buff: Buffer, name: string): Promise<void>;
    }
}
declare module "scaper" {
    import { Octokit } from "@octokit/core";
    import { IUserInfo } from "interfaces";
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
        constructor(token: string, org: string);
        initAuthor(author: string, records: Record<string, IActivity>): Record<string, IActivity>;
        pullCommitsStatistics(octokit: Octokit, from: Date, to: Date): Promise<Record<string, IActivity>>;
        pullOpenIssuesStatistics(octokit: Octokit, staleDays: number, oldDays: number): Promise<Record<string, IActivity>>;
        pullCloseIssuesActivity(octokit: Octokit, from: Date, to: Date): Promise<Record<string, IActivity>>;
        pullCommentsActivity(octokit: Octokit, from: Date, to: Date): Promise<Record<string, IActivity>>;
        pullAllUsersActivity(octokit: Octokit, from: Date, to: Date): Promise<IUserInfo[]>;
        pullOrgID(octokit: Octokit): Promise<void>;
        scrape(from: Date, to: Date, stale: number, old: number): Promise<IUserInfo[]>;
    }
}
declare module "file" {
    import { IDumper } from "interfaces";
    export class FileDumper implements IDumper {
        constructor();
        Write(buff: Buffer): Promise<void>;
    }
}
declare module "s3" {
    import { IDumper } from "interfaces";
    export class S3Dumper implements IDumper {
        private s3Client;
        private bucket;
        private path;
        constructor(ID: string, SECRET: string, bucket: string, path: string);
        Write(buff: Buffer, name: string): Promise<void>;
    }
}
declare module "dev" { }
declare module "index" { }
