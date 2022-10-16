import EventEmitter from "node:events";
import type TypedEmitter from "typed-emitter";

export type TaskLogLevel = "debug" | "info" | "warn" | "error";
export interface EventContext {
  time: number; // as reported by Date.now()
}

export type TaskEvents = {
  // When the task is progressing
  progress: (
    context: EventContext,
    percentage: number,
    message?: string
  ) => void;
  // When the task emits logs
  log: (context: EventContext, level: TaskLogLevel, message: string) => void;
  // when the task emits the result
  result: (context: EventContext, message: string) => void;
  // When the task emits attachments
  attachment: (context: EventContext, filePath?: string) => void;

  // The following events are controlled by the Commander;
  // When the task is created
  create: (
    context: EventContext,
    name: string,
    id: number,
    cmdLine: string,
    link?: string
  ) => void;
  // When the task started
  start: (context: EventContext) => void;
  // When the task is inserted or move in the queue
  queue: (context: EventContext, position: number) => void;
  // When the task fails
  failure: (context: EventContext, message?: string) => void;
  // When the task suceeded
  success: (context: EventContext, message?: string) => void;
  // When the task finished (it is sent after success or error)
  end: (context: EventContext) => void;
};

export const EVENT_NAMES: (keyof TaskEvents)[] = [
  "progress",
  "log",
  "result",
  "attachment",
  "create",
  "start",
  "queue",
  "failure",
  "success",
  "end",
];

export class TaskEventEmitter extends (EventEmitter as new () => TypedEmitter<TaskEvents>) {}
export type TaskEventEmitterType = typeof TaskEventEmitter;

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
