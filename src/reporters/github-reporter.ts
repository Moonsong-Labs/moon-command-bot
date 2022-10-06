import { Reporter } from "./reporter";
import Debug from "debug";
import PQueue from "p-queue";
import { TaskLogLevel } from "../commands/task";
import { GithubService } from "../services/github";
const debug = Debug("reporters:github");

export class GithubReporter extends Reporter {
  private octoRepo: GithubService;
  private issueNumber: number;

  private commentIdPromise: Promise<number>;
  private attachments: string[];
  private status: "success" | "failure";
  private message: string;
  private logs: string[];

  // Pqueue is used to limit to 1 concurrent request (avoid race condition on slack side)
  private pQueue: PQueue;

  constructor(octokit: GithubService, issueNumber: number) {
    super();
    this.pQueue = new PQueue({ concurrency: 1 });
    this.octoRepo = octokit;
    this.issueNumber = issueNumber;
    this.attachments = [];
    this.logs = [];
    this.status = "failure";
    this.message = "Done";
  }

  public reportInvalidTask = async (message?: string) => {
    this.message = message || `Invalid task`;
    this.reply();
  }

  private async reply() {
    debug(`Replying to issue ${this.issueNumber}`);
    const octoRest = (await this.octoRepo.getOctokit()).rest;
    this.commentIdPromise = this.pQueue.add(() =>
      octoRest.issues
        .createComment(
          this.octoRepo.extendRepoOwner({
            body: this.message,
            issue_number: this.issueNumber,
          })
        )
        .then((issueComment) => {
          debug(
            `Created issue ${this.issueNumber} comment ${issueComment.data.id}`
          );
          return issueComment.data.id;
        })
    );
    await this.commentIdPromise;
  }

  private async updateReply() {
    const octoRest = (await this.octoRepo.getOctokit()).rest;
    await this.pQueue.add(async () =>
      octoRest.issues.updateComment(
        this.octoRepo.extendRepoOwner({
          body: this.message,
          comment_id: await this.commentIdPromise,
          issue_number: this.issueNumber,
        })
      )
    );
  }

  protected onEnd = async () => {
    return this.updateReply();
  };

  protected onCreate = async (cmdLine: string, link: string) => {
    this.message = `${this.task.name}  \n[Report](${link})\n\ncmd: ${cmdLine}`;
    this.reply();
  };
  protected onStart = async () => {
    this.message = `${this.message}  \n**Starting**`;
  };
  protected onSuccess = async (message?: string) => {
    this.status = "success";
    this.message = `${this.message}\n\n**Success**${
      message ? `  \n${message}` : ""
    }`;
  };
  protected onFailure = async (message?: string) => {
    this.status = "failure";
    this.message = `${this.message}\n\n**Failure**${
      message ? `  \n${message}` : ""
    }`;
  };
  protected onProgress = async (percent: number, message?: string) => {
    this.message = `${this.message}  \nProcess (${percent}%)${
      message ? ` - ${message}` : ""
    }`;

    return this.updateReply();
  };
  protected onLog = async (level: TaskLogLevel, message: string) => {
    this.message = `${this.message}  \n${level}: ${message}`;
    this.logs.push(`${level}: ${message}`);
  };

  protected onAttachment = async (filePath: string) => {
    this.attachments.push(filePath);
  };
}
