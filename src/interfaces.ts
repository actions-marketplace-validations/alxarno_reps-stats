export interface IUserInfo {
  Member: string;
  HasActiveContributions: boolean;
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
}
