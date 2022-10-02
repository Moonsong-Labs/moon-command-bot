import EventEmitter from "node:events";
import type TypedEmitter from "typed-emitter";
import { Writable } from "node:stream";
import type { CommandData } from "../commands/commander";
import { Reporter } from "../reporters/reporter";
import { Service } from "../utils/service";

export type HookEvents = {
  command: (data: CommandData, reporter: Reporter) => void;
  history: (taskId: number, stream: Writable) => void;
};

export abstract class Hook
  extends (EventEmitter as new () => TypedEmitter<HookEvents>)
  implements Service
{
  constructor() {
    super();
  }

  // Promise to ensure when the service is ready
  public isReady: Promise<Hook>;

  // Destroy cleanly the service
  public abstract destroy(): Promise<void>;
}
