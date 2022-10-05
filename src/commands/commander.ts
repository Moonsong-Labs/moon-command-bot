import { Service } from "../services/service";
import { TaskFactory } from "./factory";
import pQueue from "p-queue";
import { Task } from "./task";

import Debug from "debug";
import { Reporter } from "../reporters/reporter";
import { TaskHistory } from "../services/task-history";
import { Hook } from "../hooks/hook";
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

  constructor(
    factories: TaskFactory[],
    hooks: Hook[],
    historyService?: TaskHistory
  ) {
    this.taskQueue = new pQueue({ concurrency: 1 });
    this.taskIndex = 0;
    this.isDestroying = false;

    // Store factory by keyword for faster lookup
    this.factories = factories.reduce((p, c) => {
      p[c.keyword] = c;
      return p;
    }, {});

    this.isReady = Promise.all([
      ...factories.map((factory) => factory.isReady),
      ...hooks.map((hook) => hook.isReady),
      historyService ? historyService.isReady : Promise.resolve(),
    ]).then(() => {
      // Associate hook with commands
      for (const hook of hooks) {
        hook.on("command", (data, reporter: Reporter) => {
          try {
            const task = this.handleCommand(data);
            reporter.attachTask(task);
            if (historyService) {
              historyService.recordTask(task);
            }
          } catch (e) {
            reporter.reportInvalidTask(e.message);
            console.error(`[Commander] Error: ${e.message}`);
          }
        });
      }
      return this;
    });
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
    setTimeout(async () => {
      try {
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
        await this.taskQueue
          .add(async () => {
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
          })
          .catch((e) => {
            console.log(`queue failed: ${e.message}`);
          });
      } catch (e) {
        console.trace(`Panic !!: ${e.message}`);
      }
    }, 0);
    return task;
  }

  public async destroy(): Promise<void> {
    this.isDestroying = true;
    await this.taskQueue.onIdle();
    await Promise.all(Object.values(this.factories).map((c) => c.destroy()));
  }
}
