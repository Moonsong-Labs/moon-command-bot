import { BenchmarkRepos } from "../../actions/benchmark";
import { GithubService, GithubServiceConfig } from "../../services/github";
import { TaskFactory } from "../factory";
import { BenchmarkTask } from "./benchmark";

export class BenchmarkFactoryConfig {
  repos: {
    main: GithubServiceConfig;
    fork: GithubServiceConfig;
  };
}
export class BenchmarkFactory extends TaskFactory {
  private repos: BenchmarkRepos;
  public isReady: Promise<BenchmarkFactory>;

  constructor(keyword: string, config: BenchmarkFactoryConfig) {
    super(keyword);
    this.repos = {
      main: new GithubService(config.repos.main),
      fork: new GithubService(config.repos.fork),
    };
    this.isReady = Promise.all(
      Object.values(this.repos).map((repo) => repo.isReady)
    ).then(() => this);
  }

  public createTask(id: number) {
    return new BenchmarkTask(this.keyword, id, this.repos);
  }

  override async destroy() {
    await this.isReady;
    await Promise.all(Object.values(this.repos).map((repo) => repo.destroy()));
  }
}
