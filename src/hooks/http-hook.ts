import { Express, Request, Response } from "express";
import { Hook } from "./hook";
import Debug from "debug";
import { HTMLStreamer } from "../reporters/html-streamer";
import { TaskArguments } from "../commands/task";
const debug = Debug("hooks:http");

export interface HttpHookConfig {
  urlPrefix: string;
}

export class HttpHook extends Hook {
  private readonly config: HttpHookConfig;

  constructor(config: HttpHookConfig, express: Express) {
    super();
    this.config = config;
    this.isReady = new Promise<HttpHook>((resolve) => {
      express.get(`${config.urlPrefix}/*`, (req, res) => {
        this.handleRequest(req, res);
      });
      resolve(this);
    });
  }

  private handleRequest = (req: Request, res: Response) => {
    try {
      const parameters = req.originalUrl
        .slice(`${this.config.urlPrefix}/`.length)
        .split(/\//);
      if (parameters.length < 1) {
        res.end("Error: Missing keyword");
        return;
      }
      const keyword = parameters[0].toLocaleLowerCase();

      const args = {
        options: req.query,
        positional: parameters.slice(1),
      } as TaskArguments;

      const cmdLine = req.url;

      debug(`Received keyword: ${keyword} [${parameters.join(" ")}]`);

      // Prepare headers for streamed html
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      this.emit("command", { keyword, cmdLine, args }, new HTMLStreamer(res));
    } catch (e) {
      console.error(`Error: ${e.message}`);
      res.end(`Error: ${e.message}`);
    }
  };

  override async destroy() {
    await this.isReady;
  }
}
