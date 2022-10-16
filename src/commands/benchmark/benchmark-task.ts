import {
  executeBenchmark,
  BenchRunConfig,
  Command,
} from "../../actions/benchmark";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_TRUNCATED_POSTFIX,
  GithubService,
} from "../../services/github";

import { Task } from "../task";
import { runTask } from "../../actions/runner";

import Debug from "debug";
const debug = Debug("commands:benchmark");

export interface BenchmarkRepos {
  main: GithubService;
  fork: GithubService;
}

export interface BenchmarkParameters {
  // pull number and branch are exclusives.

  // pullNumber to use the branch from.
  pullNumber?: string;
  // branch to run the
  branch?: string;
  // type of benchmark (ex: pallet)
  command: Command;
  // Repos needed to perform pull request
  repos: BenchmarkRepos;
  // Folder where to clone moonbeam
  gitFolder: string;
}

export class BenchmarkTask extends Task {
  private cancelled: boolean;

  public readonly name: string;
  private readonly parameters: BenchmarkParameters;

  constructor(keyword: string, id: number, parameters: BenchmarkParameters) {
    super(keyword, id);
    this.cancelled = false;
    this.parameters = parameters;
    this.name = `Benchmarking runtime ${
      this.parameters.pullNumber
        ? `PR #${this.parameters.pullNumber}`
        : `branch ${this.parameters.branch}`
    }`;
  }

  public async execute() {
    debug(`Executing ${this.name}`);

    if (this.parameters.branch && this.parameters.pullNumber) {
      throw new Error("Cannot support both pullNumber and branch");
    }
    const { repos, gitFolder, command } = this.parameters;

    // TODO: We might think to allow external PR
    // const contributor = pr.data.head.user.login;
    const branch = this.parameters.pullNumber
      ? (
          await repos.main.getPullRequestData(
            parseInt(this.parameters.pullNumber)
          )
        ).head.ref
      : "master";

    debug(`Running benchmark from ${branch}`);

    // try {
    this.emit(
      "progress",
      { time: Date.now() },
      5,
      `Preparing branch ${branch}`
    );
    const repoDirectory = await repos.main.clone(gitFolder);
    await repos.main.checkoutBranch(repoDirectory, branch);

    const config: BenchRunConfig = { repoDirectory, branch, command };
    this.emit(
      "progress",
      { time: Date.now() },
      10,
      `Running benchmark (~10min)`
    );
    const { outputFile, logs, benchCommand } = await executeBenchmark(config);
    // const { outputFile, logs, benchCommand } = {
    //   outputFile: "./pallets/author-mapping/src/weights.rs",
    //   logs: "none",
    //   benchCommand: "cargo run benchmark stuff",
    // };
    this.emit(
      "log",
      { time: Date.now() },
      "debug",
      `Executed: ${benchCommand}`
    );
    this.emit("log", { time: Date.now() }, "info", logs);
    this.emit("progress", { time: Date.now() }, 70, `Checking rustup`);

    const toolchain = (
      await runTask("rustup show active-toolchain --verbose", {
        cwd: repoDirectory,
      })
    ).trim();

    const bodyPrefix = `
  Benchmark for branch "${branch}" with command ${benchCommand}
  
  Toolchain: ${toolchain}
  
  <details>
  <summary>Results</summary>
  
  \`\`\`
  `.trim();

    const bodySuffix = `
  \`\`\`
  
  </details>
  `.trim();

    const padding = 16;
    const formattingLength = bodyPrefix.length + bodySuffix.length + padding;
    const length = formattingLength + logs.length;
    const cleanedLogs =
      length < COMMENT_MAX_LENGTH
        ? logs
        : `${logs.slice(
            0,
            COMMENT_MAX_LENGTH -
              (COMMENT_TRUNCATED_POSTFIX.length + formattingLength)
          )}${COMMENT_TRUNCATED_POSTFIX}`;

    const body = `
  ${bodyPrefix}
  ${cleanedLogs}
  ${bodySuffix}
  `.trim();

    this.emit("progress", { time: Date.now() }, 80, `Creating fork branch`);

    const forkBranch = `benchbot-${new Date().getTime()}-task-${this.id}`;
    await repos.fork.addAsRemote(repoDirectory);
    await repos.fork.createBranch(repoDirectory, forkBranch);
    await repos.fork.commitAndPush(
      repoDirectory,
      forkBranch,
      [outputFile],
      `Updates ${config.command.type} ${config.command.palletName} weights`
    );

    this.emit("progress", { time: Date.now() }, 90, `Creating pull request`);
    const { number, url } = await repos.main.createPullRequest(
      branch,
      forkBranch,
      `Task #${this.id}: ${config.command.type} ${config.command.palletName} weights`,
      body
    );

    this.emit("attachment", { time: Date.now() }, outputFile);
    this.emit(
      "log",
      { time: Date.now() },
      "info",
      `Pull request #${number} generated: ${url}`
    );
  }

  cancel() {
    this.cancelled = true;
  }
}
