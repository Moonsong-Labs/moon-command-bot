import {
  EventContext,
  EVENT_NAMES,
  Task,
  TaskEventEmitter,
  TaskEvents,
} from "../commands/task";
import Debug from "debug";
import { InstantReport, TaskReporterInterface } from "./reporter";
const debug = Debug("reporters:command");

interface Storage {
  task: TaskEventEmitter;
  events: {
    name: keyof TaskEvents;
    parameters: Parameters<TaskEvents[keyof TaskEvents]>; //TODO fix types
  }[];
}

export class TaskRecorder implements TaskReporterInterface {
  private storage: Storage;
  public taskId: number;

  public async attachTask(task: TaskEventEmitter) {
    this.storage = { task, events: [] };

    EVENT_NAMES.forEach((event) => {
      task.on(event, (...args) => this.onEvent(event, ...(args as any)));
    });
  }

  private onEvent = async <Name extends keyof TaskEvents>(
    name: Name,
    ...parameters: Parameters<TaskEvents[Name]>
  ) => {
    if (name == "create") {
      this.taskId = (parameters as Parameters<TaskEvents["create"]>)[2];
    }
    // Store the event for later
    this.storage.events.push({ name, parameters });
  };

  public instantReport = async (
    context: EventContext,
    report: InstantReport
  ) => {
    debug(`Recorder skipped: ${report.error} / ${report.mrkdwnMessage}`);
  };

  public generateTaskEmitter() {
    const emitter = new TaskEventEmitter();
    setTimeout(() => {
      // Resend all the existing events
      let hasEnded = false;
      for (let index = 0; index < this.storage.events.length; index++) {
        const event = this.storage.events[index];
        // Do not send queue message, except if it is still in queue
        if (event.name == "queue" && index != this.storage.events.length - 1) {
          continue;
        }

        hasEnded ||= event.name == "end";
        emitter.emit(event.name, ...event.parameters);
      }

      if (!hasEnded) {
        // Subscribe to future events
        EVENT_NAMES.forEach((event) => {
          this.storage.task.on(event, emitter.emit.bind(emitter, event));
        });
      }
    }, 1);
    return emitter;
  }
}
