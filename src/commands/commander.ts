import { Service } from "../services/service";
import { TaskArguments, TaskFactory } from "./factory";
import pQueue from "p-queue";
import { Task } from "./task";

import Debug from "debug";
import { TaskReporterInterface } from "../reporters/reporter";
import { HistoryService } from "../services/history";
import { Hook } from "../hooks/hook";
import { ProxyService } from "../services/proxy";
const debug = Debug("commands:commander");

export interface CommandData {
  keyword: string;
  cmdLine: string;
  args: TaskArguments;
}

export interface CommanderConfig {
  concurrentTasks: number;
}

export class Commander implements Service {
  private config: CommanderConfig;
  // Set of factories mapped by their keyword
  public factories: { [keyword: string]: TaskFactory };

  // Queue to process each task
  private taskQueue: pQueue;

  // Currently being destroyed
  private isDestroying: boolean;

  public isReady: Promise<Commander>;

  // Global counter for tasks
  private taskIndex: number;

  private historyService?: HistoryService;

  // Url used a prefix for task history link
  private historyServerUrl?: string;

  // Url used a prefix for task history link
  private proxyServices?: ProxyService[];

  constructor(
    config: CommanderConfig,
    factories: TaskFactory[],
    hooks: Hook[],
    historyService: HistoryService,
    historyServerUrl?: string,
    proxyServices?: ProxyService[]
  ) {
    this.config = config;
    this.taskQueue = new pQueue({ concurrency: config.concurrentTasks });
    this.taskIndex = 0;
    this.historyService = historyService;
    this.isDestroying = false;
    this.historyServerUrl = historyServerUrl;
    this.proxyServices = proxyServices;

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
        hook.on("command", (data, reporter: TaskReporterInterface) => {
          try {
            const keyword = data.keyword.toLocaleLowerCase();
            if (keyword == "help") {
              this.handleHelp(data, reporter);
              return;
            }
            if (keyword == "report") {
              this.handleReport(data, reporter);
              return;
            }

            // Let's find all supporting proxies for this command
            const proxies =
              (this.proxyServices &&
                this.proxyServices.filter((proxy) =>
                  proxy.canHandleCommand(keyword)
                )) ||
              [];
            debug(proxies.length);

            // If some proxies, pick a random one to handle it
            const task =
              proxies.length > 0
                ? proxies[
                    Math.floor(Math.random() * proxies.length)
                  ].proxyCommand(data, reporter)
                : this.handleCommand(data, reporter);

            if (historyService) {
              historyService.recordTask(task);
            }
          } catch (e) {
            reporter.instantReport({ time: Date.now() }, { error: e.message });
            console.error(`[Commander] Error: ${e.message}`);
          }
        });
      }
      return this;
    });
  }

  public handleReport(
    { keyword, cmdLine, args }: CommandData,
    reporter: TaskReporterInterface
  ) {
    const taskId = args.positional.length > 0 && parseInt(args.positional[0]);

    if (taskId === undefined || taskId === null || isNaN(taskId)) {
      reporter.instantReport(
        { time: Date.now() },
        { error: "Invalid task id" }
      );
      return;
    }

    const taskHistory = this.historyService.getTaskHistory(taskId);
    if (!taskHistory) {
      reporter.instantReport({ time: Date.now() }, { error: "Not found" });
      return;
    }
    reporter.attachTask(taskHistory);
  }

  public handleHelp(
    { keyword, cmdLine, args }: CommandData,
    reporter: TaskReporterInterface
  ) {
    reporter.instantReport(
      { time: Date.now() },
      {
        mrkdwnMessage: Object.values(this.factories)
          .map((factory) => factory.help())
          .join("\n\n_________________\n\n"),
      }
    );
  }

  public handleCommand(
    { keyword, cmdLine, args }: CommandData,
    reporter: TaskReporterInterface
  ): Task {
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
    reporter.attachTask(task);

    // We delay the execution so we can have reporters listening to events;
    setTimeout(async () => {
      try {
        task.emit(
          "create",
          { time: Date.now() },
          task.name,
          task.id,
          cmdLine,
          this.historyServerUrl && `${this.historyServerUrl}/${task.id}`
        );

        // Delay executing the task for the reporter to properly listen to the task
        if (this.taskQueue.size > 0) {
          task.emit("queue", { time: Date.now() }, this.taskQueue.size);
        }

        debug(`Service ${keyword} queued (position: ${this.taskQueue.size})\n`);
        await this.taskQueue
          .add(async () => {
            task.emit("start", { time: Date.now() });
            debug(`Starting ${keyword}-${task.id}\n`);
            try {
              await task.execute();
              task.emit("success", { time: Date.now() });
            } catch (error) {
              console.log(`Failure running ${keyword}: ${error.message}`);
              console.log(error);
              task.emit("failure", error.message);
            }
            debug(`Ending ${keyword}-${task.id}\n`);
            task.emit("end", { time: Date.now() });

            // Task has finished sending event, make sure we remove all listeners
            // (Specially important since the TaskRecorder creates new listener on request)
            task.removeAllListeners();
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
