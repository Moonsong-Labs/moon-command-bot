import { GithubService, GithubServiceConfig } from "../../services/github";
import { TaskArguments, TaskFactory } from "../factory";
import { ForkTestTask } from "./fork-test-task";
import { NetworkName } from "../../actions/fork-test";

export class ForkTestFactoryConfig {
  gitFolder: string;
  dataFolder: string;
  repo: GithubServiceConfig;
}

export type ForkTestTaskArguments = TaskArguments & {
  // The pull request to execute the benchmark on
  // It is used by the github hook and override the given --pr parameter
  positional: [network: NetworkName];
  options: {
    pullNumber?: string;
    branch?: string;
  };
};

const HELP = `## Command \`fork-test\`

Execute fork tests, using exported state of **existing network**,
modifying it to be run locally and executing **runtime upgrade**
plus **smoke tests**.

**Warning**: This takes around 30 minutes.

usage: \`fork-test <network> [--branch ref]\`

* network: Which network state to use
("moonbeam", "moonriver" or "alphanet")
* ref: Github ref to run the fork tests on

exemple: \`fork-test moonbeam --branch runtime-1900\`
`;

export class ForkTestFactory extends TaskFactory {
  private readonly config: ForkTestFactoryConfig;
  private readonly repo: GithubService;

  constructor(keyword: string, config: ForkTestFactoryConfig) {
    super(keyword);
    this.config = config;
    this.repo = new GithubService(config.repo);
    this.isReady = this.repo.isReady.then(async () => {
      return this;
    });
  }

  public help() {
    return HELP;
  }

  public createTask(id: number, parameters: ForkTestTaskArguments) {
    if (!parameters.positional || parameters.positional.length < 1) {
      throw new Error("Expect 1 parameters");
    }
    const network = parameters.positional[0];

    return new ForkTestTask(this.keyword, id, {
      repo: this.repo,
      pullNumber: parameters.options.pullNumber,
      branch: parameters.options.branch,
      network,
      gitFolder: this.config.gitFolder,
      dataFolder: this.config.dataFolder,
    });
  }

  override async destroy() {
    await this.isReady;
    await this.repo.destroy();
  }
}
