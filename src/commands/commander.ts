import { Service } from "../services/service";
import { TaskArguments, TaskFactory } from "./factory";
import pQueue from "p-queue";
import { Task } from "./task";

import Debug from "debug";
import { Reporter } from "../reporters/reporter";
import { TaskHistory } from "../services/task-history";
import { Hook } from "../hooks/hook";
const debug = Debug("commands:commander");

export interface CommandData {
  keyword: string;
  cmdLine: string;
  args: TaskArguments;
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

  private historyService?: TaskHistory;

  constructor(
    factories: TaskFactory[],
    hooks: Hook[],
    historyService?: TaskHistory
  ) {
    this.taskQueue = new pQueue({ concurrency: 1 });
    this.taskIndex = 0;
    this.historyService = historyService;
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
            if (data.keyword.toLocaleLowerCase() == "help") {
              this.handleHelp(data, reporter);
              return;
            }

            const task = this.handleCommand(data);
            reporter.attachTask(task);
            if (historyService) {
              historyService.recordTask(task);
            }
          } catch (e) {
            reporter.instantReport({ error: e.message });
            console.error(`[Commander] Error: ${e.message}`);
          }
        });
      }
      return this;
    });
  }

  public handleHelp(
    { keyword, cmdLine, args }: CommandData,
    reporter: Reporter
  ) {
    debug(
      `Help: `,
      Object.values(this.factories)
        .map((factory) => factory.help())
        .join("\n\n")
    );
    reporter.instantReport({
      message: Object.values(this.factories)
        .map((factory) => factory.help())
        .join("\n\n"),
    });
  }

  public handleCommand({ keyword, cmdLine, args }: CommandData): Task {
    if (this.isDestroying) {
      throw new Error("Service ending");
    }

    const factory = this.factories[keyword];
    if (!factory) {
      console.error(`Invalid command: ${keyword}`);
      throw new Error("Command not found");
    }

    const timings = { created: Date.now(), started: null, ended: null };
    const task = factory.createTask(this.taskIndex++, args);

    // We delay the execution so we can have reporters listening to events;
    setTimeout(async () => {
      try {
        task.emit(
          "create",
          cmdLine,
          this.historyService && this.historyService.getTaskLink(task.id)
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
              await task.execute();
              task.emit("success");
            } catch (error) {
              console.log(`Failure running ${keyword}: ${error.message}`);
              console.log(error);
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
