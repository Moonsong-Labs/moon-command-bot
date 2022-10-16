import {
  EventContext,
  Task,
  TaskEventEmitter,
  TaskLogLevel,
} from "../commands/task";
import Debug from "debug";
const debug = Debug("reporters:command");

export interface InstantReport {
  mrkdwnMessage?: string;
  error?: string;
}

export interface TaskReporterInterface {
  attachTask(taskEmitter: TaskEventEmitter);
  instantReport: (
    context: EventContext,
    report: InstantReport
  ) => Promise<void>;
}

export abstract class Reporter implements TaskReporterInterface {
  public attachTask(taskEmitter: TaskEventEmitter) {
    taskEmitter.on("create", this.onCreate);
    taskEmitter.on("queue", this.onQueue);
    taskEmitter.on("progress", this.onProgress);
    taskEmitter.on("log", this.onLog);
    taskEmitter.on("result", this.onResult);
    taskEmitter.on("failure", this.onFailure);
    taskEmitter.on("success", this.onSuccess);
    taskEmitter.on("attachment", this.onAttachment);
    taskEmitter.on("start", this.onStart);
    taskEmitter.on("end", this.onEnd);
  }

  // Function used when there is no task to associate or for errors
  public abstract instantReport: (
    context: EventContext,
    report: InstantReport
  ) => Promise<void>;

  protected onCreate = async (
    context: EventContext,
    name: string,
    id: number,
    cmdLine: string,
    link?: string
  ) => {
    debug(`  - [${name}-${id}] Created: ${link}`);
  };
  protected onQueue = async (context: EventContext, position: number) => {
    debug(`  - Queued: ${position}`);
  };
  protected onLog = async (
    context: EventContext,
    level: TaskLogLevel,
    message: string
  ) => {
    debug(`  - ${level}: ${message}`);
  };
  protected onProgress = async (
    context: EventContext,
    percent: number,
    message?: string
  ) => {
    debug(`  - Progress: ${percent} ${message ? message : ""}`);
  };
  protected onFailure = async (context: EventContext, message: string) => {
    debug(`  - Failure: ${message}`);
  };
  protected onSuccess = async (context: EventContext, message?: string) => {
    debug(`  - Success: ${message}`);
  };
  protected onAttachment = async (context: EventContext, filePath: string) => {
    debug(`  - Attachment: ${filePath}`);
  };
  protected onStart = async (context: EventContext) => {
    debug(`  - Start`);
  };
  protected onEnd = async (context: EventContext) => {
    debug(`  - End`);
  };
  protected onResult = async (context: EventContext, mrkdwnMessage: string) => {
    debug(`  - Result: ${mrkdwnMessage}`);
  };
}
