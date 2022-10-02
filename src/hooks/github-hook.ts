import { createNodeMiddleware, Probot } from "probot";
import { Webhooks } from "@octokit/webhooks";
import { Express } from "express";

import { Hook } from "./hook";
import Debug from "debug";
import { OctokitService } from "../utils/github";
const debug = Debug("hooks:github");

interface GithubHookOptions {
  privateKey: string;
  appId: string;
  webhookSecret: string;
  express: Express;
}

async function startServer() {}

export class GithubHook extends Hook {
  constructor({
    privateKey,
    webhookSecret,
    appId,
    express,
  }: GithubHookOptions) {
    super();

    const probot = new Probot({
      appId,
      privateKey: privateKey,
      secret: webhookSecret,
    });
    const webhooks = new Webhooks({ secret: webhookSecret });

    const middleware = createNodeMiddleware(
      (app) => {
        app.on(`issue_comment`, async ({ payload }) => {
          this.onWebhook(payload);
        });
      },
      { probot, webhooksPath: "/github" }
    );
    express.use(middleware);
  }

  async onWebhook(payload) {
    let commentText = payload.comment.body;
    debug(`Received text: ${commentText}`);
    if (!commentText.startsWith("/")) {
      return;
    }

    const parts = commentText.slice(1).split(" ");
    if (parts.length < 2) {
      return;
    }

    const cmdLine = parts.join(" ");
    debug(`Running cmd: ${cmdLine}`);

    // this.emit(
    //   "command",
    //   { keyword: parts[0], parameters: { cmdLine } },
    //   new HTMLStreamer(res)
    // );

    // const triggerCommands = { "/bench": 1, "/fork-test": 2 };
    // const triggerCommand = Object.keys(triggerCommands).find((command) =>
    //   commentText.startsWith(command)
    // );
    // if (
    //   !payload.issue.hasOwnProperty("pull_request") ||
    //   payload.action !== "created" ||
    //   !triggerCommand
    // ) {
    //   return;
    // }
  }

  override async destroy() {}
}
