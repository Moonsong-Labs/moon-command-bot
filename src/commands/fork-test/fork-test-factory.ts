import { GithubService, GithubServiceConfig } from "../../services/github";
import { TaskFactory } from "../factory";
import { ForkTestTask } from "./fork-test-task";
import { validateCommand } from "../../actions/benchmark";
import { TaskArguments } from "../task";
import { NetworkName } from "src/actions/fork-test";

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

export class ForkTestFactory extends TaskFactory {
  private readonly config: ForkTestFactoryConfig;
  private readonly repo: GithubService;

  constructor(keyword: string, config: ForkTestFactoryConfig) {
    super(keyword);
    this.config = config;
    this.repo = new GithubService(config.repo);
    this.isReady = this.repo.isReady.then(() => this);
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
