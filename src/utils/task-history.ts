import { Service } from "./service";
import { ReReadable } from "rereadable-stream";
import { Writable } from "node:stream";
import { Task } from "../commands/task";
import { HTMLStreamer } from "../reporters/html-streamer";

interface taskReport {
  id: number;
  stream: ReReadable;
}

export class TaskHistory implements Service {
  public readonly limit: number;
  public isReady: Promise<Service>;

  private taskRing: taskReport[];
  private taskRingIndex;

  constructor(limit: number) {
    this.limit = limit;
    this.taskRingIndex = 0;
    this.taskRing = new Array(this.limit).fill(0);
    this.isReady = Promise.resolve(this);
  }

  public recordTask(task: Task) {
    const stream = new ReReadable();
    const reporter = new HTMLStreamer(stream);
    reporter.attachTask(task);
    this.taskRing[this.taskRingIndex] = { id: task.id, stream };
    this.taskRingIndex = (this.taskRingIndex + 1) % this.limit;
  }

  public pipeStream(taskId: number, stream: Writable) {
    const task = this.taskRing.find(({ id }) => taskId == id);
    if (!task) {
      const reporter = new HTMLStreamer(stream);
      reporter.reportInvalidTask("Not found");
      return;
    }
    task.stream.rewind().pipe(stream);
  }

  public contains(taskId: number) {
    return !!this.taskRing.find(({ id }) => taskId == id);
  }

  async destroy() {}
}
