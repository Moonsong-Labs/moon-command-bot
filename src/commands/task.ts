import EventEmitter from "node:events";
import type TypedEmitter from "typed-emitter";

export type TaskLogLevel = "debug" | "info" | "warn" | "error";

export type TaskEvents = {
  // When the task is progressing
  progress: (percentage: number, message?: string) => void;
  // When the task emits logs
  log: (level: TaskLogLevel, message: string) => void;
  // when the task emits the result
  result: (message: string) => void;
  // When the task emits attachments
  attachment: (filePath?: string) => void;

  // The following events are controlled by the Commander;
  // When the task is created
  create: (cmdLine: string, link?: string) => void;
  // When the task started
  start: () => void;
  // When the task is inserted or move in the queue
  queue: (position: number) => void;
  // When the task fails
  failure: (message?: string) => void;
  // When the task suceeded
  success: (message?: string) => void;
  // When the task finished (it is sent after success or error)
  end: (timings: { created: number; started: number; ended: number }) => void;
};

export class TaskEventEmitter extends (EventEmitter as new () => TypedEmitter<TaskEvents>) {}
export type TaskEventEmitterType = typeof TaskEventEmitter;

export interface TaskArguments {
  // The positional arguments given
  positional: any[];
  // The optional arguments given
  options: { [name: string]: any };
}

export abstract class Task extends TaskEventEmitter {
  public readonly id: number;
  public readonly keyword: string;
  public abstract readonly name: string;

  constructor(keyword: string, id: number) {
    super();
    this.id = id;
    this.keyword = keyword;
  }

  // Execute the task. It should throw an error or return when done.
  // Event "start", "success", "failure" and "end" are controlled by the commander;
  public abstract execute(): Promise<any>;

  // Taks should support to be cancellable to reduce resource usage.
  public abstract cancel();
}
