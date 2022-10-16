import { Service } from "./service";
import { Task, TaskEventEmitter } from "../commands/task";
import { TaskRecorder } from "../reporters/recorder";

export interface HistoryServiceConfig {
  // Maximum of number of task to keep
  // The history act as a FIFO queue
  limit: number;
}

export class HistoryService implements Service {
  public readonly limit: number;
  public isReady: Promise<Service>;

  private recordingsRing: TaskRecorder[];
  private recordingsRingIndex;

  constructor(config: HistoryServiceConfig) {
    this.limit = config.limit;
    this.recordingsRingIndex = 0;
    this.recordingsRing = new Array(this.limit).fill(0);
    this.isReady = Promise.resolve(this);
  }

  public recordTask(task: TaskEventEmitter) {
    const reporter = new TaskRecorder();
    this.recordingsRing[this.recordingsRingIndex] = reporter;
    reporter.attachTask(task);
    this.recordingsRingIndex = (this.recordingsRingIndex + 1) % this.limit;
  }

  public getTaskHistory(taskId: number) {
    const proxy = this.recordingsRing.find((rec) => rec.taskId == taskId);
    if (!proxy) {
      return null;
    }
    return proxy.generateTaskEmitter();
  }

  async destroy() {}
}
