import { Task, TaskLogLevel } from "../commands/task";
import Debug from "debug";
const debug = Debug("reporters:command");

export interface InstantReport {
  message?: string;
  error?: string;
}
export abstract class Reporter {
  protected task: Task;

  public async attachTask(task: Task) {
    this.task = task;
    this.task.on("create", this.onCreate);
    this.task.on("queue", this.onQueue);
    this.task.on("progress", this.onProgress);
    this.task.on("log", this.onLog);
    this.task.on("result", this.onResult);
    this.task.on("failure", this.onFailure);
    this.task.on("success", this.onSuccess);
    this.task.on("attachment", this.onAttachment);
    this.task.on("start", this.onStart);
    this.task.on("end", this.onEnd);
  }

  // Function used when there is no task to associate or for error
  public abstract instantReport: (report: InstantReport) => Promise<void>;

  protected onCreate = async (cmdLine: string, link?: string) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Created: ${link}`);
  };
  protected onQueue = async (position: number) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Queued: ${position}`);
  };
  protected onLog = async (level: TaskLogLevel, message: string) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] ${level}: ${message}`);
  };
  protected onProgress = async (percent: number, message?: string) => {
    debug(
      `  - [${this.task.keyword}-${this.task.id}] Progress: ${percent} ${
        message ? message : ""
      }`
    );
  };
  protected onFailure = async (message: string) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Failure: ${message}`);
  };
  protected onSuccess = async (message?: string) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Success: ${message}`);
  };
  protected onAttachment = async (filePath: string) => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Attachment: ${filePath}`);
  };
  protected onStart = async () => {
    debug(`  - [${this.task.keyword}-${this.task.id}] Start`);
  };
  protected onEnd = async () => {
    debug(`  - [${this.task.keyword}-${this.task.id}] End`);
  };
  protected onResult = async (mrkdwnMessage: string) => {
    debug(
      `  - [${this.task.keyword}-${this.task.id}] Result: ${mrkdwnMessage}`
    );
  };
}
