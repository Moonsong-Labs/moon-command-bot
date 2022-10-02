import express, { Express, Request, Response } from "express";
import { Server } from "http";
import { Hook } from "./hook";
import Debug from "debug";
import { HTMLStreamer } from "../reporters/html-streamer";
const debug = Debug("hooks:http");

interface HttpHookOptions {
  express: Express;
}

export class HttpHook extends Hook {
  constructor({ express }: HttpHookOptions) {
    super();
    this.isReady = new Promise<HttpHook>((resolve) => {
      express.get("/rest/*", (req, res) => {
        this._handleRequest(req, res);
      });
      resolve(this);
    });
  }

  private _handleRequest = (req: Request, res: Response) => {
    try {
      const parameters = req.originalUrl.slice(1).split(/\//);
      if (parameters.length < 2) {
        res.end("Error: Missing keyword");
        return;
      }
      const keyword = parameters[1].toLocaleLowerCase();
      const cmdLine = parameters.join(" ");
      debug(`Received keyword: ${keyword}, cmdLine:${cmdLine}`);

      if (keyword == "tasks") {
        if (parameters.length < 3) {
          throw new Error("Not enough arguments");
        }
        // special case (TODO: Handle separately)
        const taskId = parseInt(parameters[2]);
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
    await this.isReady;
  }
}
