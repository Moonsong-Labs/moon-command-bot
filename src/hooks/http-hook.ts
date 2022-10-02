import express, { Express, Request, Response } from "express";
import { Server } from "http";
import { Hook } from "./hook";
import Debug from "debug";
import { HTMLStreamer } from "../reporters/html-streamer";
const debug = Debug("hooks:http");

interface HttpHookOptions {
  port: number;
}

export class HttpHook extends Hook {
  private app: Express;
  private server: Server;

  constructor({ port }: HttpHookOptions) {
    super();
    this.isReady = new Promise((resolve) => {
      this.app = express();
      this.app.get("*", (req, res) => {
        this._handleRequest(req, res);
      });

      this.server = this.app.listen(port, () => {
        console.log(`The HTTP application is listening on port ${port}!`);
        resolve(this);
      });
    });
  }

  private _handleRequest = (req: Request, res: Response) => {
    try {
      const parameters = req.originalUrl.slice(1).split(/\//);
      if (parameters.length < 1) {
        res.end("Error: Missing keyword");
        return;
      }
      const keyword = parameters[0].toLocaleLowerCase();
      const cmdLine = parameters.join(" ");
      debug(`Received keyword: ${keyword}, cmdLine:${cmdLine}`);

      if (keyword == "tasks") {
        if (parameters.length < 0) {
          throw new Error("Not enough arguments");
        }
        // special case (TODO: Handle separately)
        const taskId = parseInt(parameters[1]);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        this.emit("history", taskId, res);
        return;
      }

      // Prepare headers for streamed html
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      this.emit(
        "command",
        { keyword, parameters: { cmdLine } },
        new HTMLStreamer(res)
      );
    } catch (e) {
      console.error(`Error: ${e.message}`);
      res.end(`Error: ${e.message}`);
    }
  };

  override async destroy() {
    await this.isReady.then(() => {
      console.log(`Closing HTTP server!`);
      this.server.close();
    });
  }
}
