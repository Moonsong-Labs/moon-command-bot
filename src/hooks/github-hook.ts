import { App } from "octokit";

import { Hook } from "./hook";
import Debug from "debug";
import { OctokitService } from "../utils/github";
const debug = Debug("hooks:github");

interface GithubHookOptions {
  privateKey: string;
  webhookSecret: string;
  appId: string;
  octokit: OctokitService;
}

async function startServer() {}

export class GithubHook extends Hook {
  private app: App;
  public isReady: Promise<Hook>;

  constructor({
    privateKey,
    webhookSecret,
    appId,
    octokit,
  }: GithubHookOptions) {
    super();
    this.app = new App({
      appId,
      privateKey,
      webhooks: { secret: webhookSecret },
    });

    this.app.webhooks.on(`issues.commented`, async ({octokit, payload} => {
        let commentText = context.payload.comment.body;
        const triggerCommands = { "/bench": 1, "/fork-test": 2 };
        const triggerCommand = Object.keys(triggerCommands).find((command) =>
          commentText.startsWith(command)
        );
        if (
          !context.payload.issue.hasOwnProperty("pull_request") ||
          context.payload.action !== "created" ||
          !triggerCommand
        ) {
          return;
        }
    
        if (triggerCommand == "/bench") {
          benchCmd.run(app, globalConfig, context);
        }
    }))
  }

  override async destroy() {
    await this.app.stop();
  }
}
