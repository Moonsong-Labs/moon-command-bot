import fs from "node:fs/promises";
import { Commander } from "./commands/commander";
import { Hook } from "./hooks/hook";
import { HttpHook } from "./hooks/http-hook";
import { OctokitService } from "./utils/github";
import { SampleFactory } from "./commands/sample/factory";
import { BenchmarkFactory } from "./commands/benchmark/factory";
import { Reporter } from "./reporters/reporter";
import { TaskHistory } from "./utils/task-history";
import { SlackHook } from "./hooks/slack-hook";

let isTerminating = false;

let commander: Commander;
let hooks: Hook[];

export async function destroy() {
  console.log(`Destroying...`);
  try {
    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, 5000)),
      async () => {
        if (commander) {
          await commander.destroy();
        }
        await Promise.all(hooks.map((hook) => hook.destroy()));
      },
    ]);
  } catch (error) {
    console.error({ level: "error", event, error, origin });
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
  const moonbeamPrivateKey = (
    await fs.readFile(process.env.MOONBEAM_PRIVATE_PEM)
  ).toString();
  const forkPrivateKey = (
    await fs.readFile(process.env.FORK_PRIVATE_PEM)
  ).toString();

  const octoServices = {
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

  const sampleFactory = new SampleFactory("sample");
  const benchmarkFactory = new BenchmarkFactory("benchmark", octoServices);

  const taskHistory = new TaskHistory(10);

  const commander = new Commander([sampleFactory, benchmarkFactory]);
  const hooks: Hook[] = [new HttpHook({ port: 8000 })];
  if (process.env.SLACK_APP_TOKEN) {
    hooks.push(
      new SlackHook({
        appToken: process.env.SLACK_APP_TOKEN,
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
      })
    );
  }

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

  await Promise.all(hooks.map((hook) => hook.isReady));
  await sampleFactory.destroy();
  await benchmarkFactory.destroy();
  await Promise.all(Object.values(octoServices).map((o) => o.destroy()));
  console.log(`Ready !!`);
}

main();
