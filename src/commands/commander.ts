import { Service } from "../utils/service";
import { TaskFactory } from "./factory";
import pQueue from "p-queue";
import { Task } from "./task";

import Debug from "debug";
import { Reporter } from "../reporters/reporter";
const debug = Debug("commands:commander");

export interface CommandData {
  keyword: string;
  parameters: {
    cmdLine: string; // command line with the keyword (ex: "benchmark pallet author-mapping" )
    [name: string]: string; // optional parameters given by the hook
  };
}

export class Commander implements Service {
  // Set of factories mapped by their keyword
  public factories: { [keyword: string]: TaskFactory };

  // Queue to process each task
  private taskQueue: pQueue;

  // Currently being destroyed
  private isDestroying: boolean;

  public isReady: Promise<Commander>;

  // Global counter for tasks
  private taskIndex: number;

  constructor(factories: TaskFactory[]) {
    this.taskQueue = new pQueue({ concurrency: 1 });
    this.taskIndex = 0;
    this.isDestroying = false;
    this.isReady = Promise.all(factories.map((c) => c.isReady)).then(
      () => this
    );
    this.factories = factories.reduce((p, c) => {
      p[c.keyword] = c;
      return p;
    }, {});
  }

  public handleCommand({ keyword, parameters }: CommandData): Task {
    if (this.isDestroying) {
      throw new Error("Service ending");
    }
    const factory = this.factories[keyword];
    if (!factory) {
      throw new Error("Command not found");
    }

    const timings = { created: Date.now(), started: null, ended: null };
    const task = factory.createTask(this.taskIndex++);

    // We delay the execution so we can have reporters listening to events;
    setTimeout(() => {
      task.emit(
        "create",
        task.name,
        parameters.cmdLine,
        `${process.env.SERVICE_URL}/rest/tasks/${task.id}`
      );

      // Delay executing the task for the reporter to properly listen to the task
      if (this.taskQueue.size > 0) {
        task.emit("queue", this.taskQueue.size);
      }

      debug(`Service ${keyword} queued (position: ${this.taskQueue.size})\n`);
      this.taskQueue.add(async () => {
        try {
          task.emit("start");
          debug(`Starting ${keyword}-${task.id}\n`);
          try {
            await task.execute(parameters);
            task.emit("success");
          } catch (error) {
            console.log(`Failure running ${keyword}: ${error.message}`);
            task.emit("failure", error.message);
          }
          debug(`Ending ${keyword}-${task.id}\n`);
          task.emit("end", timings);
        } catch (e) {
          console.trace(`Panic !!: ${e.message}`);
        }
      });
    }, 0);
    return task;
  }

  public async destroy(): Promise<void> {
    this.isDestroying = true;
    await this.taskQueue.onIdle();
    await Promise.all(Object.values(this.factories).map((c) => c.destroy()));
  }
}
