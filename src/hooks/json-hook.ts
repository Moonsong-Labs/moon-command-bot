import { Express, Request, Response, json as jsonMiddleware } from "express";
import { expressjwt } from "express-jwt";
import { Hook } from "./hook";
import Debug from "debug";
import { NDJsonStreamer } from "../reporters/ndjson-reporter";
import { TaskArguments } from "../commands/factory";

const debug = Debug("hooks:Json");

export interface JwtAuthNone {
  type: "none";
}

export interface JwtAuthKey {
  type: "key";
  publicKey: string;
}

export interface JwtAuthSecret {
  type: "secret";
  secret: string;
}

export type JwtAuth = JwtAuthNone | JwtAuthKey | JwtAuthSecret;

export interface JsonHookConfig {
  urlPrefix: string;
  auth: JwtAuth;
}

// Only support to respond with NDJson
export class JsonHook extends Hook {
  private readonly config: JsonHookConfig;

  constructor(config: JsonHookConfig, express: Express) {
    super();
    this.config = config;

    let middlewares = [];
    if (config.auth.type != "none") {
      const jwtConfig: Parameters<typeof expressjwt>[0] =
        config.auth.type == "key"
          ? { secret: config.auth.publicKey, algorithms: ["RS256"] }
          : { secret: config.auth.secret, algorithms: ["HS256"] };
      middlewares.push(expressjwt(jwtConfig));
    }
    middlewares.push(jsonMiddleware());

    this.isReady = new Promise<JsonHook>((resolve) => {
      express.post(
        `${config.urlPrefix}`,
        ...middlewares,
        function (err, req, res, next) {
          console.log(req.headers);
          if (err.name === "UnauthorizedError") {
            debug(`Failed authentication: ${err.message}`);
            res.status(401).end(JSON.stringify({ error: "invalid token..." }));
          } else {
            next(err);
          }
        },
        (req, res) => {
          this.handleRequest(req, res);
        }
      );
      resolve(this);
    });
  }

  private handleRequest = (req: Request, res: Response) => {
    try {
      const jsonBody = req.body; // Is already json parsed
      if (!jsonBody.keyword) {
        res.status(400).end(JSON.stringify({ error: "Missing keyword" }));
        return;
      }

      const { keyword, cmdLine } = jsonBody;
      const args: TaskArguments = {
        positional: Array.isArray(jsonBody.args && jsonBody.args.positional)
          ? jsonBody.args.positional
          : [],
        options:
          jsonBody.args && typeof jsonBody.args.options == "object"
            ? jsonBody.args.options
            : {},
      };

      debug(
        `Received keyword: ${keyword} [${args.positional.join(
          " "
        )}](${Object.keys(args.options)
          .map((key) => `--${key}: ${args.options[key]}`)
          .join(" ")})`
      );

      // Prepare headers for streamed html
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Transfer-Encoding", "chunked");
      this.emit("command", { keyword, cmdLine, args }, new NDJsonStreamer(res));
    } catch (e) {
      debug(`Error: ${e.message}\n${e.stack}`);
      res.end(`Error: ${e.message}`);
    }
  };

  override async destroy() {
    await this.isReady;
  }
}
