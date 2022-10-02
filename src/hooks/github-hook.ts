import { createNodeMiddleware, Probot } from "probot";
import { Webhooks } from "@octokit/webhooks";
import { Express } from "express";

import { Hook } from "./hook";
import Debug from "debug";
import { OctokitService } from "../utils/github";
import { IssueCommentEvent } from "@octokit/webhooks-types";
import { Octokit } from "octokit";
import { GithubReporter } from "../reporters/github-reporter";
const debug = Debug("hooks:github");

interface GithubHookOptions {
  privateKey: string;
  appId: string;
  webhookSecret: string;
  express: Express;
  // List of repos currently allowed
  octoRepos: OctokitService[];
}

export class GithubHook extends Hook {
  private octoRepos: OctokitService[];

  constructor({
    privateKey,
    webhookSecret,
    appId,
    express,
    octoRepos,
  }: GithubHookOptions) {
    super();
    this.octoRepos = octoRepos;
    const probot = new Probot({
      appId,
      privateKey: privateKey,
      secret: webhookSecret,
    });

    const middleware = createNodeMiddleware(
      (app) => {
        app.on(`issue_comment`, async ({ octokit, payload, issue }) => {
          this.onWebhook(issue, payload);
        });
      },
      { probot }
    );
    express.use("/github", middleware);
  }

  async onWebhook(reply: ({ body }) => void, payload: IssueCommentEvent) {
    let commentText = payload.comment.body;
    debug(`Received text: ${commentText}`);
    if (!commentText.startsWith("/")) {
      return;
    }

    const parts = commentText.slice(1).split("\n")[0].split(" ");
    if (parts.length < 2) {
      return;
    }

    const cmdLine = parts.join(" ");
    debug(`Running cmd: ${cmdLine}`);

    const octoRepo = this.octoRepos.find(
      ({ owner, repo }) =>
        `${owner}/${repo}`.toLocaleLowerCase() ==
        payload.repository.full_name.toLocaleLowerCase()
    );

    if (!octoRepo) {
      reply({ body: "Repository not supported by the bot" });
      return;
    }

    this.emit(
      "command",
      { keyword: parts[0], parameters: { cmdLine } },
      new GithubReporter(octoRepo, payload.issue.number)
    );
  }

  override async destroy() {}
}
