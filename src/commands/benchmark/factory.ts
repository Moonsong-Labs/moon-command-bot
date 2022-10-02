import { TaskFactory } from "../factory";
import { BenchmarkConfig, BenchmarkTask } from "./benchmark";

export class BenchmarkFactory extends TaskFactory {
  private config: BenchmarkConfig;

  constructor(keyword: string, config: BenchmarkConfig) {
    super(keyword);
    this.config = { ...config };
    this.isReady = Promise.all([
      this.config.moonbeamRepo.isReady,
      this.config.forkRepo.isReady,
    ]).then(() => this);
  }

  public createTask(id: number) {
    return new BenchmarkTask(this.keyword, id, this.config);
  }

  destroy() {}
}
