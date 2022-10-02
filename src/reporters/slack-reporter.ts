import { Reporter } from "./reporter";
import { Writable } from "node:stream";
import { WebClient } from "@slack/web-api";
import Debug from "debug";
import { TaskLogLevel } from "../commands/task";
const debug = Debug("reporters:slack");

export class SlackReporter extends Reporter {
  private client: WebClient;
  private channelId: string;
  private messageTsPromise: Promise<string>;
  private attachments: string[];
  private status: "success" | "failure";
  private finalMessage: string;
  private logs: string[];

  constructor(client: WebClient, channelId: string) {
    super();
    this.client = client;
    this.channelId = channelId;
    this.attachments = [];
    this.logs = [];
    this.status = "failure";
    this.finalMessage = "Done";
  }

  public async reportInvalidTask(message?: string) {
    await this.client.chat.postMessage({
      channel: this.channelId,
      text: message || `Invalid task`,
    });
  }

  protected async onEnd() {
    await this.client.chat.update({
      channel: this.channelId,
      ts: await this.messageTsPromise,
      text: `Finished #${this.task.id}: ${this.status}`,
      blocks: [
        {
          type: "header",
          text: { type: "mrkdwn", text: `#${this.task.id}  \n${this.status}` },
        },
        ...this.logs.map((log) => {
          return { type: "section", text: `${log}` };
        }),
        ...this.attachments.map((attachment) => {
          return { type: "section", text: `(soon embedded): ${attachment}` };
        }),
      ],
    });
  }

  protected async onCreate(title: string, cmdLine: string) {
    this.messageTsPromise = this.client.chat
      .postMessage({ channel: this.channelId, text: title })
      .then((result) => result.message.ts);
  }
  protected async onStart() {
    await this.client.chat.update({
      channel: this.channelId,
      ts: await this.messageTsPromise,
      text: `Started #${this.task.id}`,
    });
  }
  protected async onSuccess(message?: string) {
    this.status = "success";
    this.finalMessage = `Success${message ? ` - ${message}` : ""}`;
  }
  protected async onFailure(message?: string) {
    this.status = "failure";
    this.finalMessage = `Failure${message ? ` - ${message}` : ""}`;
  }
  protected async onProgress(percent: number, message?: string) {
    await this.client.chat.update({
      channel: this.channelId,
      ts: await this.messageTsPromise,
      text: `Process (${percent}%)${message ? ` - ${message}` : ""}`,
    });
  }
  protected async onLog(level: TaskLogLevel, message: string) {
    this.logs.push(`${level}: ${message}`);
  }

  protected async onAttachment(filePath: string) {
    this.attachments.push(filePath);
  }
}
