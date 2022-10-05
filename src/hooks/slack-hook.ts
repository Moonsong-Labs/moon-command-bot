import {
  App,
  SlashCommand,
  AckFn,
  ExpressReceiver,
  Receiver,
} from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { Express } from "express";
import { Hook } from "./hook";
import Debug from "debug";
import { SlackReporter } from "../reporters/slack-reporter";
const debug = Debug("hooks:slack");

export interface SlackHookConfig {
  urlPrefix: string;
  auth: {
    appToken: string;
    token: string;
    signingSecret: string;
  };
}

export class SlackHook extends Hook {
  private app: App;
  private receiver: Receiver;

  constructor(config: SlackHookConfig, express: Express) {
    super();
    this.receiver = new ExpressReceiver({
      signingSecret: config.auth.signingSecret,
      app: express,
      endpoints: config.urlPrefix,
    });
    this.app = new App({ receiver: this.receiver, ...config.auth });
    this.app.command("/moonbot", ({ client, body, ack }) => {
      debug(`Received command moonbot: ${body.text}`);
      return this.handleCommand(body, client, ack);
    });
  }

  private async handleCommand(
    body: SlashCommand,
    client: WebClient,
    ack: AckFn<string>
  ) {
    const parts = body.text.split(" ");
    if (parts.length < 1) {
      await ack("Missing command");
      return;
    }
    const keyword = parts[0];
    this.emit(
      "command",
      { keyword, parameters: { cmdLine: body.text } },
      new SlackReporter(client, body.channel_id, ack)
    );
    await ack();
  }

  override async destroy() {}
}
