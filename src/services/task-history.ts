import { Service } from "./service";
import { ReReadable } from "rereadable-stream";
import { Task } from "../commands/task";
import { HTMLStreamer } from "../reporters/html-streamer";
import { Express, Request, Response } from "express";

interface taskReport {
  task: Task;
  stream: ReReadable;
}

export interface TaskHistoryConfig {
  // Maximum of number of task to keep
  // The history act as a FIFO queue
  limit: number;

  urlPrefix: string;

  // Needed to provide url feedback
  serverUrl: string;
}

export class TaskHistory implements Service {
  public readonly limit: number;
  public isReady: Promise<Service>;
  private serverUrl: string;
  private urlPrefix: string;

  private taskRing: taskReport[];
  private taskRingIndex;

  constructor(config: TaskHistoryConfig, express: Express) {
    this.limit = config.limit;
    this.taskRingIndex = 0;
    this.serverUrl = config.serverUrl;
    this.urlPrefix = config.urlPrefix;
    this.taskRing = new Array(this.limit).fill(0);
    this.isReady = Promise.resolve(this);

    express.use(`${config.urlPrefix}/tasks`, this.onTaskRequest.bind(this));
  }

  public getTaskLink(taskId: number) {
    return `${this.serverUrl}${this.urlPrefix}/${taskId}`;
  }

  public recordTask(task: Task) {
    const stream = new ReReadable();
    const reporter = new HTMLStreamer(stream);
    reporter.attachTask(task);
    this.taskRing[this.taskRingIndex] = { task, stream };
    this.taskRingIndex = (this.taskRingIndex + 1) % this.limit;
  }

  public onTaskRequest(req: Request, res: Response) {
    try {
      const parameter = req.url.slice(1);
      if (!parameter) {
        throw new Error("Not yet supported");
        return;
      }
      const taskId = parseInt(parameter);
      if (isNaN(taskId)) {
        throw new Error("Invalid task id");
      }

      // Prepare headers for streamed html
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      const task = this.taskRing.find(({ task }) => task && task.id == taskId);
      if (!task) {
        const reporter = new HTMLStreamer(res);
        reporter.reportInvalidTask("Not found");
        return;
      }
      task.stream.rewind().pipe(res);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      res.end(`Error: ${e.message}`);
    }
  }

  async destroy() {}
}
