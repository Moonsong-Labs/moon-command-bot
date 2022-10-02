import { Task, TaskLogLevel } from "../commands/task";
import Debug from "debug";
const debug = Debug("reporters:command");

export abstract class Reporter {
  protected task: Task;

  public async attachTask(task: Task) {
    this.task = task;
    this.task.on("create", this.onCreate.bind(this));
    this.task.on("queue", this.onQueue.bind(this));
    this.task.on("progress", this.onProgress.bind(this));
    this.task.on("log", this.onLog.bind(this));
    this.task.on("failure", this.onFailure.bind(this));
    this.task.on("success", this.onSuccess.bind(this));
    this.task.on("attachment", this.onAttachment.bind(this));
    this.task.on("start", this.onStart.bind(this));
    this.task.on("end", this.onEnd.bind(this));
  }

  public abstract reportInvalidTask(message?: string);

  protected async onCreate(title: string, cmdLine: string) {
    debug(`  - [${this.task.keyword}-${this.task.id}] Created: ${cmdLine}`);
  }
  protected async onQueue(position: number) {
    debug(`  - [${this.task.keyword}-${this.task.id}] Queued: ${position}`);
  }
  protected async onLog(level: TaskLogLevel, message: string) {
    debug(`  - [${this.task.keyword}-${this.task.id}] ${level}: ${message}`);
  }
  protected async onProgress(percent: number, message?: string) {
    debug(
      `  - [${this.task.keyword}-${this.task.id}] Progress: ${percent} ${
        message ? message : ""
      }`
    );
  }
  protected async onFailure(message: string) {
    debug(`  - [${this.task.keyword}-${this.task.id}] Failure: ${message}`);
  }
  protected async onSuccess(message?: string) {
    debug(`  - [${this.task.keyword}-${this.task.id}] Success: ${message}`);
  }
  protected async onAttachment(filePath: string) {
    debug(`  - [${this.task.keyword}-${this.task.id}] Attachment: ${filePath}`);
  }
  protected async onStart() {
    debug(`  - [${this.task.keyword}-${this.task.id}] Start`);
  }
  protected async onEnd() {
    debug(`  - [${this.task.keyword}-${this.task.id}] End`);
  }
}
