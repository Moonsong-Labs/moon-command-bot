import chalk from "chalk";
import http from "http";
import express from "express";
import { Commander } from "./commands/commander";
import { Hook } from "./hooks/hook";
import { HttpHook } from "./hooks/http-hook";
import { SampleFactory } from "./commands/sample/sample-factory";
import { BenchmarkFactory } from "./commands/benchmark/benchmark-factory";
import { BlockTimeFactory } from "./commands/block-time/block-time-factory";
import { HistoryService } from "./services/history";
import { SlackHook } from "./hooks/slack-hook";
import { TaskFactory } from "./commands/factory";
import { GithubHook } from "./hooks/github-hook";
import { BotConfig } from "./configs/config-types";
import { GovernanceFactory } from "./commands/governance/governance-factory";
import { ForkTestFactory } from "./commands/fork-test/fork-test-factory";
import { JsonHook } from "./hooks/json-hook";
import { ProxyService } from "./services/proxy";

let isTerminating = false;

let commander: Commander;
let hooks: Hook[];
let taskFactories: TaskFactory[];
let historyService: HistoryService;
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
  if (env.commands["fork-test"]) {
    console.log(`-      Enable command: ${chalk.green("fork-test")}`);
    taskFactories.push(
      new ForkTestFactory("fork-test", env.commands["fork-test"])
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
  if (env.hooks.json) {
    console.log(
      `-       Register hook: [${chalk.yellow(
        env.hooks.json.urlPrefix
      )}] JSON Api`
    );
    hooks.push(new JsonHook(env.hooks.json, app));
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

  if (env.proxies) {
    env.proxies.forEach((proxy) =>
      console.log(
        `-      Register proxy: ${chalk.yellow(
          proxy.url
        )} [${proxy.commands.map((command) => chalk.green(command))}]`
      )
    );
  }

  if (env.history) {
    console.log(`- Start extra service: TaskHistory`);
    historyService = new HistoryService(env.history);
  }

  const commander = new Commander(
    env.commander,
    taskFactories,
    hooks,
    historyService,
    historyService && // retrieve the url for history service through http
      env.hooks.http &&
      `${env.server.serverUrl}/${env.hooks.http.urlPrefix}/history`,
    env.proxies && env.proxies.map((config) => new ProxyService(config))
  );

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
