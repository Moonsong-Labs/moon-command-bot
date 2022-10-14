import fs from "fs";

import {
  executeForkTest,
  ForkTestConfig,
  NetworkName,
} from "../../actions/fork-test";
import { GithubService } from "../../services/github";

import { Task } from "../task";
import { runTask } from "../../actions/runner";

import Debug from "debug";
import { config } from "yargs";
const debug = Debug("commands:fork-test");

export interface ForkTestParameters {
  // pull number and branch are exclusives.

  // pullNumber to use the branch from.
  pullNumber?: string;
  // branch to run the
  branch?: string;
  // Repos needed to perform pull request
  repo: GithubService;
  // Repos needed to perform pull request
  network: NetworkName;
  // Folder where to clone moonbeam
  gitFolder: string;
  // Folder where to run the fork-test
  dataFolder: string;
}

export class ForkTestTask extends Task {
  private cancelled: boolean;

  public readonly name: string;
  private readonly parameters: ForkTestParameters;

  constructor(keyword: string, id: number, parameters: ForkTestParameters) {
    super(keyword, id);
    this.cancelled = false;
    this.parameters = parameters;
    this.name = `Fork test ${parameters.network} ${
      this.parameters.pullNumber
        ? `PR #${this.parameters.pullNumber}`
        : `branch ${this.parameters.branch || "master"}`
    }`;
  }

  public async execute() {
    debug(`Executing ${this.name}`);

    if (this.parameters.branch && this.parameters.pullNumber) {
      throw new Error("Cannot support both pullNumber and branch");
    }
    const { repo, gitFolder, network } = this.parameters;

    // TODO: We might think to allow external PR
    // const contributor = pr.data.head.user.login;
    const branch = this.parameters.pullNumber
      ? (await repo.getPullRequestData(parseInt(this.parameters.pullNumber)))
          .head.ref
      : this.parameters.branch || "master";

    debug(`Running fork-test from ${branch}`);

    // try {
    this.emit("progress", 5, `Preparing branch ${branch}`);
    const repoDirectory = await repo.clone(gitFolder);
    await repo.checkoutBranch(repoDirectory, branch);

    if (fs.existsSync(this.parameters.dataFolder)) {
      await runTask(`rm -rf ${this.parameters.dataFolder}/*`, {
        cwd: process.cwd(),
      });
    }

    const config: ForkTestConfig = {
      repoDirectory,
      branch,
      network,
      dataFolder: this.parameters.dataFolder,
    };
    this.emit("progress", 10, `Running fork-test (~20min)`);
    const result = await executeForkTest(config);
    const finalData = result.split('\n').slice(-15).join("  \n")
    this.emit("log", "debug", result);
    this.emit("result", finalData);
  }

  cancel() {
    this.cancelled = true;
  }
}
