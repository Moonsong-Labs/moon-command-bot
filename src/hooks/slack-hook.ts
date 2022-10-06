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
import yargs from "yargs";
import { SlackReporter } from "../reporters/slack-reporter";
import { TaskArguments } from "../commands/task";
const debug = Debug("hooks:slack");

export interface SlackHookConfig {
  urlPrefix: string;
  slackCommand: string;
  auth: {
    appToken: string;
    token: string;
    signingSecret: string;
  };
}

const yargParser = yargs();

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
    this.app.command(config.slackCommand, ({ client, body, ack }) => {
      debug(`Received command moonbot: ${body.text}`);
      return this.handleCommand(body, client, ack);
    });
  }

  private async handleCommand(
    body: SlashCommand,
    client: WebClient,
    ack: AckFn<string>
  ) {
    const parsedData = await yargParser.parse(body.text.slice(1));
    if (parsedData._.length < 1) {
      await ack("Missing command");
      return;
    }

    const args = {
      options: { ...parsedData },
      positional: parsedData._.slice(1),
    } as TaskArguments;

    const keyword = args.positional[0];
    const cmdLine = body.text;
    debug(
      `Received: ${keyword}(${args.positional.join(", ")}) [${Object.keys(
        args
      ).find((arg) => `--${arg}=${args[arg]}`)}]`
    );

    this.emit(
      "command",
      { keyword, cmdLine, args },
      new SlackReporter(client, body.channel_id, ack)
    );
    await ack();
  }

  override async destroy() {}
}
