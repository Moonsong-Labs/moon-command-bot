import { Reporter } from "./reporter";
import { Writable } from "node:stream";
import { WebClient, KnownBlock } from "@slack/web-api";
import Debug from "debug";
import PQueue from "p-queue";
import { TaskLogLevel } from "../commands/task";
const debug = Debug("reporters:slack");

export class SlackReporter extends Reporter {
  private client: WebClient;
  private channelId: string;
  private messageTsPromise: Promise<string>;
  private attachments: string[];
  private logs: string[];
  private title: string;
  private link: string;

  // Pqueue is used to limit to 1 concurrent request (avoid race condition on slack side)
  private pQueue: PQueue;

  private status: "pending" | "success" | "failure" | "progress";

  private messageText: string;
  private messageBlocks: {
    header?: KnownBlock;
    progress?: KnownBlock;
  };

  constructor(client: WebClient, channelId: string) {
    super();
    this.title = "";
    this.link = "";
    this.pQueue = new PQueue({ concurrency: 1 });
    this.client = client;
    this.channelId = channelId;
    this.attachments = [];
    this.logs = [];
    this.messageBlocks = {};
    this.status = "pending";
  }

  private async postMessage() {
    this.messageTsPromise = this.pQueue.add(() =>
      this.client.chat
        .postMessage({ ...this.buildMessageContent(), channel: this.channelId })
        .then((result) => result.message.ts)
    );
  }

  private async updateMessage() {
    await this.pQueue.add(async () =>
      this.client.chat.update({
        ...this.buildMessageContent(),
        channel: this.channelId,
        ts: await this.messageTsPromise,
      })
    );
  }

  public async reportInvalidTask(message?: string) {
    this.status = "failure";
    this.title = message || `Invalid task`;
    this.messageText = message || `Invalid task`;
    this.pQueue.add(() =>
      this.client.chat
        .postMessage({ text: this.messageText, channel: this.channelId })
        .then((result) => result.message.ts)
    );
  }

  protected async onCreate(title: string, cmdLine: string, link: string) {
    this.messageText = `${title}\n${cmdLine}`;
    this.title = title;
    this.link = link;
    this.status = "progress";
    await this.postMessage();
  }

  private buildMessageContent() {
    const emoji =
      this.status == "success"
        ? ":white_check_mark:"
        : this.status == "failure"
        ? ":x:"
        : this.status == "pending"
        ? ":stopwatch:"
        : ":gear:";

    const blocks: KnownBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} #${this.task.id} - ${this.title}`,
        },
      },
    ];

    if (this.messageBlocks.progress) {
      blocks.push(this.messageBlocks.progress);
    }

    if (this.logs.length > 0) {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: " :newspaper: *Logs* :newspaper:" },
      });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`\n${this.logs.join("  \n")}\n\`\`\``,
        },
      });
    }
    if (this.attachments.length > 0) {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",

        text: {
          type: "mrkdwn",
          text: " :file_folder: *Attachments* :file_folder:",
        },
      });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${this.attachments.join("  \n")}` },
      });
    }

    return { text: this.messageText, blocks };
  }

  protected async onStart() {}
  protected async onProgress(percent: number, message?: string) {
    this.status = "progress";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}* | <${this.link}|report> | *Process* [${"".padStart(
            percent / 5,
            "#"
          )}${"".padStart(20 - percent / 5, " ")}] ${percent
            .toString()
            .padStart(3, " ")}%${message ? ` -  ${message}` : ""}`,
          type: "mrkdwn",
        },
      ],
    };
    this.updateMessage();
  }

  protected async onLog(level: TaskLogLevel, message: string) {
    this.logs.push(`${level.toUpperCase()}: ${message}`);
  }

  protected async onAttachment(filePath: string) {
    this.attachments.push(filePath);
  }

  protected async onSuccess(message?: string) {
    this.status = "success";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}* | <${this.link}|report> | *Success* ${
            message ? `: ${message}` : ""
          }`,
          type: "mrkdwn",
        },
      ],
    };
  }
  protected async onFailure(message?: string) {
    this.status = "failure";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        { text: `*${new Date().toISOString()}* | <${this.link}|report> | *Failure*`, type: "mrkdwn" },
      ],
    };
    if (message) {
      this.logs.push(`*Failure*: ${message}`);
    }
  }

  protected async onEnd() {
    this.updateMessage();
  }
}
