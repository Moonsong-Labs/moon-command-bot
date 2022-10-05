import type { Service } from "../services/service";
import { Task } from "./task";

export abstract class TaskFactory implements Service {
  public readonly id: number;
  public keyword: string;
  public isReady: Promise<TaskFactory>;

  constructor(keyword: string) {
    this.keyword = keyword;
    this.isReady = Promise.resolve().then(() => this);
  }

  public abstract createTask(id: number): Task;

  abstract destroy();
}
