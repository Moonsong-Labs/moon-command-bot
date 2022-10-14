import type { Service } from "../services/service";
import { Task } from "./task";

export interface TaskArguments {
  // The positional arguments given
  positional: any[];
  // The optional arguments given
  options: { [name: string]: any };
}

export abstract class TaskFactory implements Service {
  public readonly id: number;
  public keyword: string;
  public isReady: Promise<TaskFactory>;

  constructor(keyword: string) {
    this.keyword = keyword;
    this.isReady = Promise.resolve().then(() => this);
  }

  public abstract createTask(id: number, args: TaskArguments): Task;
  public abstract help(): string;

  abstract destroy();
}
