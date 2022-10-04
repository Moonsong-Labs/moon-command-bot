import fs from "node:fs/promises";
import http from "node:http";
import express from "express";
import { Commander } from "./commands/commander";
import { Hook } from "./hooks/hook";
import { HttpHook } from "./hooks/http-hook";
import { OctokitService } from "./utils/github";
import { SampleFactory } from "./commands/sample/factory";
import { BenchmarkFactory } from "./commands/benchmark/factory";
import { Reporter } from "./reporters/reporter";
import { TaskHistory } from "./utils/task-history";
import { SlackHook } from "./hooks/slack-hook";
import { TaskFactory } from "./commands/factory";
import { GithubHook } from "./hooks/github-hook";
import { BlockTimeFactory } from "./commands/block-time/factory";

let isTerminating = false;

let commander: Commander;
let hooks: Hook[] = [];
let factories: TaskFactory[] = [];
let octoServices: { moonbeamRepo?: OctokitService; forkRepo?: OctokitService } =
  {};
let server: http.Server;

export async function destroy() {
  console.log(`Destroying...`);
  try {
    //

    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, 5000)),
      async () => {
        if (commander) {
          await commander.destroy();
        }
        await Promise.all(hooks.map((hook) => hook.destroy()));
        await Promise.all(factories.map((factory) => factory.destroy()));
        await Promise.all(Object.values(octoServices).map((o) => o.destroy()));
      },
    ]);
    server.close();
  } catch (error) {
    console.error(error);
  }
  console.log("Bye");
}

for (const event of ["uncaughtException", "unhandledRejection", "SIGINT"]) {
  const handleQuit = async (error, origin) => {
    console.log(error);
    if (isTerminating) {
      return;
    }
    process.off(event, handleQuit);
    isTerminating = true;
    await destroy();

    process.exit(1);
  };
  process.on(event, handleQuit);
}

export async function main() {
  if (process.env.DEBUG) {
    console.log("Running in debug mode");
  }

  const app = express();
  server = new http.Server(app);

  factories.push(new SampleFactory("sample"));
  console.log(`- Enable command: sample`);
  factories.push(
    new BlockTimeFactory("block-time", ["alphanet", "moonriver", "moonbeam"])
  );
  console.log(`- Enable command: block-time`);

  if (process.env.BENCHMARK_COMMAND) {
    const moonbeamPrivateKey = (
      await fs.readFile(process.env.MOONBEAM_PRIVATE_PEM)
    ).toString();
    const forkPrivateKey = (
      await fs.readFile(process.env.FORK_PRIVATE_PEM)
    ).toString();

    octoServices = {
      moonbeamRepo: new OctokitService(
        process.env.MOONBEAM_REPO_OWNER,
        process.env.MOONBEAM_REPO_NAME,
        process.env.MOONBEAM_INSTALLATION_ID,
        {
          appId: process.env.MOONBEAM_APP_ID,
          clientId: process.env.MOONBEAM_CLIENT_ID,
          clientSecret: process.env.MOONBEAM_CLIENT_SECRET,
          privateKey: moonbeamPrivateKey,
        }
      ),
      forkRepo: new OctokitService(
        process.env.FORK_REPO_OWNER,
        process.env.FORK_REPO_NAME,
        process.env.FORK_INSTALLATION_ID,
        {
          appId: process.env.FORK_APP_ID,
          clientId: process.env.FORK_CLIENT_ID,
          clientSecret: process.env.FORK_CLIENT_SECRET,
          privateKey: forkPrivateKey,
        }
      ),
    };
    new BenchmarkFactory("benchmark", octoServices as any);
    console.log(`- Enable command: benchmark`);
  }

  const taskHistory = new TaskHistory(1000);

  const hooks: Hook[] = [new HttpHook({ express: app })];
  if (process.env.SLACK_HOOK) {
    console.log(`- Enable hook: Slack `);
    hooks.push(
      new SlackHook({
        appToken: process.env.SLACK_APP_TOKEN,
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        express: app,
      })
    );
  }
  if (process.env.GITHUB_HOOK) {
    console.log(`- Enable hook: Github`);
    const githubPrivateKey = (
      await fs.readFile(process.env.GITHUB_PRIVATE_PEM)
    ).toString();
    hooks.push(
      new GithubHook({
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        privateKey: githubPrivateKey,
        appId: process.env.GITHUB_APP_ID,
        express: app,
        octoRepos: [
          new OctokitService(
            process.env.GITHUB_REPO_OWNER,
            process.env.GITHUB_REPO_NAME,
            process.env.GITHUB_INSTALLATION_ID,
            {
              appId: process.env.GITHUB_APP_ID,
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
              privateKey: githubPrivateKey,
            }
          ),
        ],
      })
    );
  }

  const commander = new Commander(factories);

  await Promise.all(factories.map((factory) => factory.isReady));
  await Promise.all(hooks.map((hook) => hook.isReady));

  for (const hook of hooks) {
    hook.on("command", (data, reporter: Reporter) => {
      try {
        const task = commander.handleCommand(data);
        reporter.attachTask(task);
        taskHistory.recordTask(task);
      } catch (e) {
        reporter.reportInvalidTask(e.message);
        console.error(`[Commander] Error: ${e.message}`);
      }
    });
    hook.on("history", (taskId, stream) =>
      taskHistory.pipeStream(taskId, stream)
    );
  }

  const port = process.env.HTTP_PORT || 8000;
  server = app.listen(port, () => {
    console.log(`The HTTP application is listening on port ${port}!`);
  });

  console.log(`Ready !!`);
}

main();
