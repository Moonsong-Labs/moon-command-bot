import chalk from "chalk";
import http from "http";
import express from "express";
import { Commander } from "./commands/commander";
import { Hook } from "./hooks/hook";
import { HttpHook } from "./hooks/http-hook";
import { SampleFactory } from "./commands/sample/sample-factory";
import { BenchmarkFactory } from "./commands/benchmark/benchmark-factory";
import { BlockTimeFactory } from "./commands/block-time/block-time-factory";
import { TaskHistory } from "./services/task-history";
import { SlackHook } from "./hooks/slack-hook";
import { TaskFactory } from "./commands/factory";
import { GithubHook } from "./hooks/github-hook";
import { BotConfig } from "./configs/config-types";
import { GovernanceFactory } from "./commands/governance/governance-factory";

let isTerminating = false;

let commander: Commander;
let hooks: Hook[];
let taskFactories: TaskFactory[];
let historyService: TaskHistory;
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
        if (historyService) {
          await historyService.destroy();
        }
        await Promise.all(hooks.map((hook) => hook.destroy()));
        await Promise.all(taskFactories.map((factory) => factory.destroy()));
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
  process.on(event as any, handleQuit);
}

export async function start(env: BotConfig) {
  const app = express();
  server = new http.Server(app);

  taskFactories = [];
  if (env.commands.sample) {
    console.log(`-      Enable command: ${chalk.green("sample")}`);
    taskFactories.push(new SampleFactory("sample", env.commands.sample));
  }
  if (env.commands["block-time"]) {
    console.log(`-      Enable command: ${chalk.green("block-time")}`);
    taskFactories.push(
      new BlockTimeFactory("block-time", env.commands["block-time"])
    );
  }
  if (env.commands["governance"]) {
    console.log(`-      Enable command: ${chalk.green("governance")}`);
    taskFactories.push(
      new GovernanceFactory("governance", env.commands["governance"])
    );
  }
  if (env.commands.benchmark) {
    console.log(`-      Enable command: ${chalk.green("benchmark")}`);
    taskFactories.push(
      new BenchmarkFactory("benchmark", env.commands.benchmark)
    );
  }

  hooks = [];
  if (env.hooks.http) {
    console.log(
      `-       Register hook: [${chalk.yellow(
        env.hooks.http.urlPrefix
      )}] HTTP Api`
    );
    hooks.push(new HttpHook(env.hooks.http, app));
  }
  if (env.hooks.github) {
    for (const githubConfig of Object.values(env.hooks.github)) {
      console.log(
        `-       Register hook: [${chalk.yellow(
          githubConfig.urlPrefix
        )}] Github (${githubConfig.repo.owner}/${githubConfig.repo.repo})`
      );
      hooks.push(new GithubHook(githubConfig, app));
    }
  }
  if (env.hooks.slack) {
    console.log(
      `-       Register hook: [${chalk.yellow(
        env.hooks.slack.urlPrefix
      )}] Slack`
    );
    hooks.push(new SlackHook(env.hooks.slack, app));
  }
  if (env.history) {
    console.log(
      `- Start extra service: [${chalk.yellow(
        env.history.urlPrefix
      )}] TaskHistory (URL ${env.history.serverUrl})`
    );
    historyService = new TaskHistory(env.history, app);
  }

  const commander = new Commander(taskFactories, hooks, historyService);

  await Promise.all([commander.isReady]);

  const { port, hostname } = env.server.listener;
  server = await new Promise((resolve) => {
    const server = app.listen(port, hostname, () => {
      console.log(
        `-    Listening Server: ${chalk.yellow(`${hostname}:${port}`)}`
      );
      resolve(server);
    });
  });
  console.log(`=============== ${chalk.green("Ready")} ==============`);
}
