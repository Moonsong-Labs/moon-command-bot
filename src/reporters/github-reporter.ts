import { Reporter } from "./reporter";
import Debug from "debug";
import { TaskLogLevel } from "../commands/task";
import { OctokitService } from "../utils/github";
const debug = Debug("reporters:github");

export class GithubReporter extends Reporter {
  private octoRepo: OctokitService;
  private issueNumber: number;

  private commentIdPromise: Promise<number>;
  private attachments: string[];
  private status: "success" | "failure";
  private message: string;
  private logs: string[];

  constructor(octokit: OctokitService, issueNumber: number) {
    super();
    this.octoRepo = octokit;
    this.issueNumber = issueNumber;
    this.attachments = [];
    this.logs = [];
    this.status = "failure";
    this.message = "Done";
  }

  public async reportInvalidTask(message?: string) {
    this.message = message || `Invalid task`;
    this.reply();
  }

  private async reply() {
    const octoRest = (await this.octoRepo.getOctokit()).rest;
    this.commentIdPromise = octoRest.issues
      .createComment(
        this.octoRepo.extendRepoOwner({
          body: this.message,
          issue_number: this.issueNumber,
        })
      )
      .then((issueComment) => issueComment.data.id);
  }

  private async updateReply() {
    const octoRest = (await this.octoRepo.getOctokit()).rest;
    await octoRest.issues.updateComment(
      this.octoRepo.extendRepoOwner({
        body: this.message,
        comment_id: await this.commentIdPromise,
        issue_number: this.issueNumber,
      })
    );
  }

  protected async onEnd() {
    return this.updateReply();
  }

  protected async onCreate(title: string, cmdLine: string) {
    this.message = `${title}\n\ncmd: ${cmdLine}`;
    this.reply();
  }
  protected async onStart() {
    this.message = `${this.message}  \n**Starting**`;
  }
  protected async onSuccess(message?: string) {
    this.status = "success";
    this.message = `${this.message}\n\n**Success**${
      message ? `  \n${message}` : ""
    }`;
  }
  protected async onFailure(message?: string) {
    this.status = "failure";
    this.message = `${this.message}\n\n**Failure**${
      message ? `  \n${message}` : ""
    }`;
  }
  protected async onProgress(percent: number, message?: string) {
    this.message = `${this.message}  \nProcess (${percent}%)${
      message ? ` - ${message}` : ""
    }`;

    return this.updateReply();
  }
  protected async onLog(level: TaskLogLevel, message: string) {
    this.message = `${this.message}  \n${level}: ${message}`;
    this.logs.push(`${level}: ${message}`);
  }

  protected async onAttachment(filePath: string) {
    this.attachments.push(filePath);
  }
}
