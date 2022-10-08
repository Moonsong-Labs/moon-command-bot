import { Reporter } from "./reporter";
import Debug from "debug";
import PQueue from "p-queue";
import AsciiBar from "ascii-bar";
import { TaskLogLevel } from "../commands/task";
import { GithubService } from "../services/github";
const debug = Debug("reporters:github");

export class GithubReporter extends Reporter {
  private octoRepo: GithubService;
  private issueNumber: number;

  private commentIdPromise: Promise<number>;
  private attachments: string[];
  private status: "success" | "failure" | "progress";
  private progress: number;
  private stepMessage?: string;
  private message: string;
  private cmdLine: string;
  private logs: string[];
  private asciiBar: AsciiBar;

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
    this.status = "failure";
    this.cmdLine = "";
    this.message = "";
    this.message = "Done";
    this.asciiBar = new AsciiBar({
      undoneSymbol: ":white_circle:",
      doneSymbol: ":blue_circle:",
      width: 20,
      formatString: "#percent #bar",
      total: 100,
      enableSpinner: false,
      autoStop: true,
      print: false,
      start: 0,
      hideCursor: true,
    });
  }

  public reportInvalidTask = async (message?: string) => {
    this.message = message || `Invalid task`;
    this.reply();
  };

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

  private buildMessage() {
    this.message = `${
      this.status == "success"
        ? `:white_check_mark:`
        : this.status == "progress"
        ? ``
        : `:x:`
    } *${this.task.name}*  
\`${this.cmdLine}\`

${this.status[0].toUpperCase() + this.status.substring(1)}: ${"".padStart(
      this.progress / 5,
      ":yellow_circle:"
    )}${"".padStart(20 - this.progress / 5, ":white_circle:")}] ${this.asciiBar.renderLine()}${this.stepMessage ? ` - ${this.stepMessage}` : ``}

    ${
      this.logs.length == 0
        ? ``
        : `
<details><summary>:newspaper: Logs :newspaper:</summary>
\`\`\`\n${this.logs.join("  \n")}\n\`\`\`
</details>`
    }
`;
  }

  private async updateReply() {
    this.buildMessage();
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
    this.message = `${this.message}  \n**Starting**`;
  };
  protected onSuccess = async (message?: string) => {
    this.status = "success";
  };
  protected onFailure = async (message?: string) => {
    this.status = "failure";
  };
  protected onProgress = async (percent: number, message?: string) => {
    this.status = "progress";
    this.asciiBar.update(percent, message)
  };
  protected onLog = async (level: TaskLogLevel, message: string) => {
    this.message = `${this.message}  \n${level}: ${message}`;
    this.logs.push(`${level}: ${message}`);
  };

  protected onAttachment = async (filePath: string) => {
    this.attachments.push(filePath);
  };
}
