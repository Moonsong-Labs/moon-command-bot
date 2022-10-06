import { GithubService, GithubServiceConfig } from "../../services/github";
import { TaskFactory } from "../factory";
import { BenchmarkRepos, BenchmarkTask } from "./benchmark";
import { validateCommand } from "../../actions/benchmark";
import { TaskArguments } from "../task";

export class BenchmarkFactoryConfig {
  gitFolder: string;
  repos: {
    main: GithubServiceConfig;
    fork: GithubServiceConfig;
  };
}

export type BenchmarkTaskParameters = TaskArguments & {
  // The pull request to execute the benchmark on
  // It is used by the github hook and override the given --pr parameter
  positional: [type: string, palletName: string];
  options: {
    pullNumber?: string;
  };
};

export class BenchmarkFactory extends TaskFactory {
  private readonly repos: BenchmarkRepos;
  private readonly gitFolder: string;
  public readonly isReady: Promise<BenchmarkFactory>;

  constructor(keyword: string, config: BenchmarkFactoryConfig) {
    super(keyword);
    this.gitFolder = config.gitFolder;
    this.repos = {
      main: new GithubService(config.repos.main),
      fork: new GithubService(config.repos.fork),
    };
    this.isReady = Promise.all(
      Object.values(this.repos).map((repo) => repo.isReady)
    ).then(() => this);
  }

  public createTask(id: number, parameters: BenchmarkTaskParameters) {
    if (!parameters.positional || parameters.positional.length < 2) {
      throw new Error("Expect 2 parameters");
    }
    const type = parameters.positional[0];
    const name = parameters.positional[1];

    const command = validateCommand(type, name);

    return new BenchmarkTask(this.keyword, id, {
      repos: this.repos,
      pullNumber: parameters.options.pullNumber,
      branch: parameters.options.branch,
      command,
      gitFolder: this.gitFolder,
    });
  }

  override async destroy() {
    await this.isReady;
    await Promise.all(Object.values(this.repos).map((repo) => repo.destroy()));
  }
}
