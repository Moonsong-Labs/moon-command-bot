import { Service } from "./service";
import { fetch, Agent } from "undici";
import ndjsonStream from "can-ndjson-stream";
import jwt from "jsonwebtoken";
import { TaskReporterInterface } from "../reporters/reporter";
import { CommandData } from "../commands/commander";
import { TaskEventEmitter } from "../commands/task";
import { JwtAuth, JwtAuthKey } from "src/hooks/json-hook";
import Debug from "debug";
const debug = Debug("services:proxy");

export interface ProxyJwtAuthKey {
  type: "key";
  privateKey: string;
}

export interface ProxyServiceConfig {
  // url, including ndjson-hook prefix of the server to proxy the command to
  // ex: https://my-other-bot.com/ndjson
  url: string;
  auth: Exclude<JwtAuth, JwtAuthKey> | ProxyJwtAuthKey;
  commands: string[];
}

// Service used to proxy command to another bot
// This is useful for heavy command requiring specific server configuration
export class ProxyService implements Service {
  private readonly limit: number;
  private readonly historyServerUrl: string;
  public isReady: Promise<Service>;
  private config: ProxyServiceConfig;

  constructor(config: ProxyServiceConfig, historyServerUrl?: string) {
    this.config = config;
    this.historyServerUrl = historyServerUrl;

    this.isReady = Promise.resolve(this);
  }

  public canHandleCommand(command: string) {
    return this.config.commands.includes(command);
  }

  private async queryAndRedirectCommand(
    commandData: CommandData,
    reporter: TaskReporterInterface,
    redirectedTask: TaskEventEmitter
  ) {
    try {
      let headers: HeadersInit = { "Content-Type": "application/json" };
      if (this.config.auth.type != "none") {
        const algorithm = this.config.auth.type == "key" ? "RS256" : "HS256";
        const secret =
          this.config.auth.type == "key"
            ? this.config.auth.privateKey
            : this.config.auth.secret;
        const token = jwt.sign({}, secret, { algorithm });
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(this.config.url, {
        method: "POST", // or 'PUT'
        headers,
        body: JSON.stringify(commandData),
        dispatcher: new Agent({
          keepAliveTimeout: 3_600_000,
          keepAliveMaxTimeout: 3_600_000,
          bodyTimeout: 3_600_000,
        }),
      });
      const stream = ndjsonStream(response.body);
      let isCreated = false;
      let hasEnded = false;

      for await (const result of stream) {
        try {
          const { error, done, name, parameters } = result;
          if (done) {
            if (!isCreated) {
              reporter.instantReport(
                { time: Date.now() },
                { error: "Proxy failed" }
              );
            } else if (!hasEnded) {
              debug(`Abnormal end`);
              redirectedTask.emit("end", { time: Date.now() });
            }
          } else if (error) {
            debug(`Received proxy error: ${error}`);
            if (isCreated) {
              redirectedTask.emit(
                "failure",
                { time: Date.now() },
                `Invalid proxy error: ${error}`
              );
              redirectedTask.emit("end", { time: Date.now() });
            } else {
              reporter.instantReport({ time: Date.now() }, { error });
            }
          } else if (name == "instant") {
            if (isCreated) {
              debug(`Warning: Instant report after task being created !!`);
            }
            reporter.instantReport(parameters[0], parameters[1]);
          } else if (name == "create") {
            isCreated = true;
            reporter.attachTask(redirectedTask);
            const [context, title, id, cmdLine, link] = parameters;
            redirectedTask.emit(
              name,
              context,
              title,
              id,
              cmdLine,
              `${this.historyServerUrl}/${id}`
            );
          } else {
            if (name == "end") {
              hasEnded = true;
            }
            redirectedTask.emit(name, ...parameters);
          }
        } catch (e) {
          debug(`ERROR proxying command: ${e.message}\n${e.stack}`);
        }
      }
    } catch (e) {
      reporter.instantReport({ time: Date.now() }, { error: e.message });
    }
  }

  public proxyCommand(
    commandData: CommandData,
    reporter: TaskReporterInterface
  ) {
    const taskEmitter = new TaskEventEmitter();
    this.queryAndRedirectCommand(commandData, reporter, taskEmitter);
    return taskEmitter;
  }

  async destroy() {}
}
