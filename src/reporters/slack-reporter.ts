import { Reporter } from "./reporter";
import { Writable } from "node:stream";
import { WebClient, KnownBlock } from "@slack/web-api";
import Debug from "debug";
import { TaskLogLevel } from "../commands/task";
const debug = Debug("reporters:slack");

export class SlackReporter extends Reporter {
  private client: WebClient;
  private channelId: string;
  private messageTsPromise: Promise<string>;
  private attachments: string[];
  private status: "success" | "failure";

  private messageText: string;
  private messageBlocks: {
    header?: KnownBlock;
    progress?: KnownBlock;
    logs: KnownBlock[];
    attachments: KnownBlock[];
  };

  constructor(client: WebClient, channelId: string) {
    super();
    this.client = client;
    this.channelId = channelId;
    this.attachments = [];
    this.messageBlocks = { logs: [], attachments: [] };
    this.status = "failure";
  }

  public async reportInvalidTask(message?: string) {
    this.messageText = message || `Invalid task`;
    this.postMessage();
  }

  protected async onCreate(title: string, cmdLine: string) {
    this.messageText = `${title}\n${cmdLine}`;
    this.messageBlocks.header = {
      type: "header",
      text: { type: "plain_text", text: `#${this.task.id} - ${title}` },
    };
    this.postMessage();
  }

  private async postMessage() {
    this.messageTsPromise = this.client.chat
      .postMessage({ channel: this.channelId, text: this.messageText })
      .then((result) => result.message.ts);
  }

  private async updateMessage() {
    const blocks = [];
    if (this.messageBlocks.header) {
      blocks.push(this.messageBlocks.header);
    }
    if (this.messageBlocks.progress) {
      blocks.push(this.messageBlocks.progress);
    }

    if (this.messageBlocks.logs.length > 0) {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: " :newspaper: *Logs* :newspaper:" },
      });
      blocks.push(...this.messageBlocks.logs);
    }
    if (this.messageBlocks.attachments.length > 0) {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: " :file_folder: *Attachments* :file_folder:",
        },
      });
      blocks.push(...this.messageBlocks.attachments);
    }
    await this.client.chat.update({
      channel: this.channelId,
      ts: await this.messageTsPromise,
      text: this.messageText,
      blocks,
    });
  }

  protected async onStart() {}
  protected async onProgress(percent: number, message?: string) {
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}*  |  [${
            ("".padStart(percent / 20), "#")
          }${("".padStart(20 - percent / 20), "#")}] ${percent
            .toString()
            .padStart(3, " ")}%${message ? ` -  ${message}` : ""}`,
          type: "mrkdwn",
        },
      ],
    };
    this.updateMessage();
  }

  protected async onLog(level: TaskLogLevel, message: string) {
    this.messageBlocks.logs.push({
      type: "section",
      text: { type: "mrkdwn", text: `${level}: ${message}` },
    });
  }

  protected async onAttachment(filePath: string) {
    this.messageBlocks.logs.push({
      type: "section",
      text: { type: "mrkdwn", text: `${filePath}` },
    });
    this.attachments.push(filePath);
  }

  protected async onSuccess(message?: string) {
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}*  | Success${
            message ? `: ${message}` : ""
          }`,
          type: "mrkdwn",
        },
      ],
    };
  }
  protected async onFailure(message?: string) {
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}*  | Failure${
            message ? `: ${message}` : ""
          }`,
          type: "mrkdwn",
        },
      ],
    };
  }

  protected async onEnd() {
    this.updateMessage();
  }
}
