import { App, SlashCommand, AckFn } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { Hook } from "./hook";
import Debug from "debug";
import { SlackReporter } from "../reporters/slack-reporter";
const debug = Debug("hooks:slack");

interface SlackHookOptions {
  appToken: string;
  token: string;
  signingSecret: string;
}

export class SlackHook extends Hook {
  private app: App;

  constructor({ appToken, token, signingSecret }: SlackHookOptions) {
    super();
    this.app = new App({ appToken, token, signingSecret, socketMode: true });
    this.app.command(/.*/, ({ client, body, ack }) =>
      this.handleCommand(body, client, ack)
    );
  }

  private async handleCommand(
    body: SlashCommand,
    client: WebClient,
    ack: AckFn<string>
  ) {
    await ack();

    const keyword = body.command;
    this.emit(
      "command",
      { keyword, parameters: { cmdLine: body.text.slice(1) } },
      new SlackReporter(client, body.channel_id)
    );
  }

  override async destroy() {
    await this.app.stop();
  }
}
