import { InstantReport, TaskReporterInterface } from "./reporter";
import { Transform, Writable } from "node:stream";
import Debug from "debug";
import * as ndjson from "ndjson";
import {
  EventContext,
  EVENT_NAMES,
  TaskEventEmitter,
  TaskEvents,
} from "../commands/task";

const debug = Debug("reporters:ndjson");

// New line delimited JSON (for streaming)
export class NDJsonStreamer implements TaskReporterInterface {
  stream: Writable;
  ndjson: Transform;

  constructor(stream: Writable) {
    this.stream = stream;
    this.ndjson = ndjson.stringify();
    this.ndjson.pipe(stream);
  }

  public attachTask(taskEmitter: TaskEventEmitter) {
    EVENT_NAMES.forEach((event) => {
      taskEmitter.on(event, (...args) => this.onEvent(event, ...(args as any)));
    });
  }

  private onEvent = async <Name extends keyof TaskEvents>(
    name: Name,
    ...parameters: Parameters<TaskEvents[Name]>
  ) => {
    // Store the event for later
    this.ndjson.write({ name, parameters });
    if (name == "end") {
      this.ndjson.end();
    }
  };

  public instantReport = async (
    context: EventContext,
    report: InstantReport
  ) => {
    this.ndjson.write({ name: "instant", parameters: { context, report } });
    this.ndjson.end();
  };
}
