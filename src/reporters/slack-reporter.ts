import { Reporter } from "./reporter";
import { WebClient, KnownBlock } from "@slack/web-api";
import Debug from "debug";
import PQueue from "p-queue";
import { TaskLogLevel } from "../commands/task";
import { ProgressBar } from "./utils";
import slackifyMarkdown from "slackify-markdown";
const debug = Debug("reporters:slack");

export class SlackReporter extends Reporter {
  private client: WebClient;
  private ackFallback: (body?: string) => void;
  private channelId: string;
  private messageTsPromise: Promise<string>;
  private attachments: string[];
  private logs: string[];
  private title: string;
  private cmdLine: string;
  private link: string;
  private progressBar: ProgressBar;

  // Pqueue is used to limit to 1 concurrent request (avoid race condition on slack side)
  private pQueue: PQueue;

  private status: "pending" | "success" | "failure" | "progress";

  private messageText: string;
  private messageBlocks: {
    header?: KnownBlock;
    progress?: KnownBlock;
    result?: KnownBlock;
  };

  constructor(
    client: WebClient,
    channelId: string,
    ackFallback: (body: string) => void
  ) {
    super();
    this.title = "";
    this.link = "";
    this.cmdLine = "";
    this.pQueue = new PQueue({ concurrency: 1 });
    this.client = client;
    this.ackFallback = ackFallback;
    this.channelId = channelId;
    this.attachments = [];
    this.logs = [];
    this.messageBlocks = {};
    this.status = "pending";
    this.progressBar = new ProgressBar({
      undoneSymbol: ":white_circle:",
      doneSymbol: ":large_blue_circle:",
      width: 10,
    });
  }

  private async postMessage() {
    try {
      this.messageTsPromise = this.pQueue.add(async () => {
        return this.client.chat
          .postMessage({
            ...this.buildMessageContent(),
            channel: this.channelId,
          })
          .then((result) => result.message.ts);
      });
      await this.messageTsPromise;
    } catch (e) {
      debug(`Error posting message: ${e.message}`);
    }
  }

  private async updateMessage() {
    try {
      await this.pQueue.add(async () => {
        await this.client.chat.update({
          ...this.buildMessageContent(),
          channel: this.channelId,
          ts: await this.messageTsPromise,
        });
      });
    } catch (e) {
      debug(`Error updating message: ${e.message}`);
    }
  }

  public reportInvalidTask = async (message?: string) => {
    this.status = "failure";
    this.title = message || `Invalid task`;
    this.messageText = message || `Invalid task`;
    try {
      await this.pQueue.add(() => this.ackFallback(this.messageText));
    } catch (e) {
      debug(`Error ack : ${e.message}`);
    }
  };

  protected onCreate = async (cmdLine: string, link?: string) => {
    // At this point, we know the task is being handled, and we can report acknowledgement
    this.ackFallback();
    this.messageText = `${this.task.name}\n${cmdLine}`;
    this.cmdLine = cmdLine;
    this.title = this.task.name;
    this.link = link;
    this.status = "progress";
    await this.postMessage();
  };

  private buildMessageContent() {
    const emoji =
      this.status == "success"
        ? ":large_green_circle:"
        : this.status == "failure"
        ? ":red_circle:"
        : this.status == "pending"
        ? ":large_white_circle:"
        : ":large_yellow_circle:";

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
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `\`${this.cmdLine}\`` },
    });

    if (this.messageBlocks.result) {
      blocks.push(this.messageBlocks.result);
    }

    if (this.logs.length > 0) {
      if (this.messageBlocks.result) {
        blocks.push({ type: "divider" });
      }
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

  protected onStart = async () => {};
  protected onProgress = async (percent: number, message?: string) => {
    this.status = "progress";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}* | ${
            this.link ? `<${this.link}|report>` : this.task.id.toString()
          } | *Process* ${this.progressBar.render(percent)} ${
            message ? ` -  ${message}` : ""
          }`,
          type: "mrkdwn",
        },
      ],
    };
    this.updateMessage();
  };

  protected onLog = async (level: TaskLogLevel, message: string) => {
    this.logs.push(`${level.toUpperCase()}: ${message}`);
  };

  protected onAttachment = async (filePath: string) => {
    this.attachments.push(filePath);
  };

  protected onSuccess = async (message?: string) => {
    this.status = "success";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}* | <${
            this.link
          }|report> | *Success* ${message ? `: ${message}` : ""}`,
          type: "mrkdwn",
        },
      ],
    };
  };

  protected onFailure = async (message?: string) => {
    this.status = "failure";
    this.messageBlocks.progress = {
      type: "context",
      elements: [
        {
          text: `*${new Date().toISOString()}* | <${
            this.link
          }|report> | *Failure*`,
          type: "mrkdwn",
        },
      ],
    };
    if (message) {
      this.logs.push(`*Failure*: ${message}`);
    }
  };

  protected onEnd = async () => {
    this.updateMessage();
  };

  protected onResult = async (mrkdwnMessage: string) => {
    this.messageBlocks.result = {
      type: "context",
      elements: [
        {
          text: `${
            // Fixes a bug with slackify adding \ for double white space
            slackifyMarkdown(
              mrkdwnMessage
                .split("\n")
                .map((s) =>
                  s
                    .replace(/(0x[0-9a-zA-Z]{16})[0-9a-zA-Z]{48}/g, "$1...")
                    .replace(/^[ \t]+/gm, (x) => {
                      //replace leading whitespaces
                      return `.${new Array(x.length + 1).join(" ")}`;
                    })
                )
                .join("\n")
            )
              .split("\n")
              .map((s) =>
                s
                  .replace(/\\$/g, " ")
                  .replace(":green_circle:", ":large_green_circle:")
              )
              .join("\n")
          }`,
          type: "mrkdwn",
        },
      ],
    };
  };
}
