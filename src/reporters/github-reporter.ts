import { Reporter } from "./reporter";
import Debug from "debug";
import PQueue from "p-queue";
import { TaskLogLevel } from "../commands/task";
import { GithubService } from "../services/github";
import { ProgressBar } from "./utils";
const debug = Debug("reporters:github");

export class GithubReporter extends Reporter {
  private octoRepo: GithubService;
  private issueNumber: number;

  private commentIdPromise: Promise<number>;
  private attachments: string[];
  private status: "success" | "failure" | "pending" | "progress";
  private progress: number;
  private stepMessage?: string;
  private message: string;
  private cmdLine: string;
  private logs: string[];
  private progressBar: ProgressBar;

  // Pqueue is used to limit to 1 concurrent request (avoid race condition on slack side)
  private pQueue: PQueue;

  constructor(octokit: GithubService, issueNumber: number) {
    super();
    this.pQueue = new PQueue({ concurrency: 1 });
    this.octoRepo = octokit;
    this.issueNumber = issueNumber;
    this.progress = 0;
    this.attachments = [];
    this.logs = [];
    this.status = "pending";
    this.cmdLine = "";
    this.message = "";
    this.message = "Done";
    this.progressBar = new ProgressBar({
      undoneSymbol: ":white_circle:",
      doneSymbol: ":large_blue_circle:",
      width: 20,
    });
  }

  public reportInvalidTask = async (message?: string) => {
    this.message = message || `Invalid task`;
    this.reply();
  };

  private async reply() {
    debug(`Replying to issue ${this.issueNumber}`);
    const octoRest = (await this.octoRepo.getOctokit()).rest;
    this.buildMessage();
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

  private buildMessage() {
    const emoji =
      this.status == "success"
        ? ":green_circle:"
        : this.status == "failure"
        ? ":red_circle:"
        : this.status == "pending"
        ? ":white_circle:"
        : ":yellow_circle:";

    this.message = `${emoji} *${this.task.name}*  
\`${this.cmdLine}\`

${
  this.status[0].toUpperCase() + this.status.substring(1)
}: ${this.progressBar.render(this.progress)}${
      this.stepMessage ? ` - ${this.stepMessage}` : ``
    }
    ${
      this.logs.length == 0
        ? ``
        : `
<details><summary>:newspaper: Logs :newspaper:</summary>
<pre>
${this.logs.join("  \n")}
</pre>
</details>`
    }
`;
  }

  private async updateReply() {
    this.buildMessage();
    console.log(this.message);
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
    this.cmdLine = cmdLine;
    this.message = `${this.task.name}  \n[Report](${link})\n\ncmd: ${cmdLine}`;
    this.reply();
  };
  protected onStart = async () => {
    this.status = "progress";
    this.message = `${this.message}  \n**Starting**`;
    return this.updateReply();
  };
  protected onSuccess = async (message?: string) => {
    this.status = "success";
    this.progress = 100;
    return this.updateReply();
  };
  protected onFailure = async (message?: string) => {
    this.status = "failure";
    return this.updateReply();
  };
  protected onProgress = async (percent: number, message?: string) => {
    this.status = "progress";
    this.progress = percent;
    return this.updateReply();
  };
  protected onLog = async (level: TaskLogLevel, message: string) => {
    this.message = `${this.message}  \n${level}: ${message}`;
    this.logs.push(`${level}: ${message}`);
    return this.updateReply();
  };

  protected onAttachment = async (filePath: string) => {
    this.attachments.push(filePath);
  };
}
