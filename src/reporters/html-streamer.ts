import { InstantReport, Reporter } from "./reporter";
import { Writable } from "node:stream";
import Debug from "debug";
import MarkdownIt from "markdown-it";
import MarkdownItEmoji from "markdown-it-emoji";
import { EventContext, TaskLogLevel } from "../commands/task";
import slackifyMarkdown from "slackify-markdown";

const debug = Debug("reporters:stream");

const CSS_STYLES = `
body {
  font-family: "Helvetica", Sans-Serif;
  color: #FFFFFF;
  padding: 5px;
}

.card {
  /* Add shadows to create the "card" effect */
  background-color: #3C3C3C;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
  transition: 0.3s;
  margin: auto;
  padding: 10px;
  width: 80%;
}

#logs {
  font-size: 80%;
  white-space: pre-wrap;       /* css-3 */
  white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
  white-space: -pre-wrap;      /* Opera 4-6 */
  white-space: -o-pre-wrap;    /* Opera 7 */
  word-wrap: break-word;       /* Internet Explorer 5.5+ */
}

#task-id {
  position: relative;
  top: 10px;
  left: 10px;
}

.progress:last-of-type {
  display: auto;
}

/* On mouse-over, add a deeper shadow */
.card:hover {
  box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2);
}

/* Add some padding inside the card container */
.container {
  padding: 2px 16px;
}

`;

export class HTMLStreamer extends Reporter {
  stream: Writable;
  markdown: MarkdownIt;

  constructor(stream: Writable) {
    super();
    this.stream = stream;
    this.markdown = new MarkdownIt();
    this.markdown.use(MarkdownItEmoji);

    this.stream.write(`<!DOCTYPE html><html><head>
    <style>${CSS_STYLES}</style>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
    </head><body>
    <div class="card">
      <span id="task-id" class="w3-badge w3-grey"></span>
      <div class="card-title"><h1 id="title"></h1></div>
      <div id="cmd-line">...</div>
      <div id="status">...</div>
      <div class="w3-border">
        <div class="w3-green" id="progress" style="height:24px;width:0%"></div>
      </div>
      <div id="result">...</div>
      <pre id="logs"></pre>
    </div>\n`);
  }

  public instantReport = async (
    context: EventContext,
    report: InstantReport
  ) => {
    debug(`Report: ${report.error} / ${report.mrkdwnMessage}`);
    this.updateElement("status", "created");
    this.updateElement("title", report.error ? "Invalid task" : "Report");
    this.updateElement("task-id", `N/A`);
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("${
         report.error ? "w3-red" : "w3-blue"
       }");`
    );
    if (report.error) {
      this.addLog(context.time, "error", report.error);
    }
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("${
         report.error ? "w3-red" : "w3-blue"
       }");`
    );
    this.updateProgress(100);
    if (report.mrkdwnMessage) {
      this.updateElement(
        "result",
        this.markdown.render(
          report.mrkdwnMessage
            .split("\n")
            .map((s) =>
              s.replace(/^[ \t]+/gm, (x) => {
                //replace leading whitespaces
                return new Array(x.length + 1).join("\u2003");
              })
            )
            .join("\n")
        )
      );
    }

    this.stream.end(`</body></html>`);
  };

  private writeScript(jsCommand: string) {
    this.stream.write(`<script>${jsCommand}</script>\n`);
  }

  private updateProgress(percent: number, message?: string) {
    // debug(`progress: ${percent}`);
    this.updateElement(
      "status",
      `${percent > 0 && percent < 100 ? "In progress: " : ""}${
        (message && message.replace("`", '"')) || `${percent}%`
      }`
    );
    this.writeScript(
      `document.getElementById("progress").style.width = "${percent}%";`
    );
  }

  private updateElement(element: string, value: string) {
    this.writeScript(
      `document.getElementById("${element}").innerHTML = \`${value.replaceAll(
        "`",
        "\\`"
      )}\``
    );
  }

  private addLog(time: number, level: TaskLogLevel, message: string) {
    this.writeScript(
      `{const log = document.createElement("div"); 
       log.classList.add('log');
       log.innerHTML = \`${new Date(
         time
       ).toISOString()} ${level.toUpperCase()} ${message.replaceAll(
        "`",
        '"'
      )}\`;
       document.getElementById("logs").appendChild(log);}`
    );
  }

  protected onEnd = async () => {
    debug(`end`);
    this.stream.end(`</body></html>`);
  };

  protected onCreate = async (
    context: EventContext,
    name: string,
    id: number,
    cmdLine: string,
    link?: string
  ) => {
    debug(`created`);
    this.updateElement("status", "created");
    this.updateElement("title", name || "task");
    this.updateElement("cmd-line", cmdLine);
    this.writeScript(
      `document.getElementById("cmd-line").innerText = \`${cmdLine.replace(
        "`",
        '"'
      )}\``
    );
    this.updateElement("task-id", `#${id}`);
  };
  protected onStart = async () => {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey");
       document.getElementById("task-id").classList.add("w3-yellow");`
    );
    this.updateElement("status", "started");
  };
  protected onSuccess = async (context: EventContext, message?: string) => {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("w3-green");`
    );
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("w3-green");`
    );
    this.updateProgress(
      100,
      `Success${message ? ` - ${message.replace("`", '"')}` : ""}`
    );
  };
  protected onFailure = async (context: EventContext, message?: string) => {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("w3-red");`
    );
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("w3-red");`
    );
    this.updateProgress(
      100,
      `Failure${message ? ` - ${message.replace("`", '"')}` : ""}`
    );
  };
  protected onProgress = async (
    context: EventContext,
    percent: number,
    message?: string
  ) => {
    debug(`progress: ${percent}`);
    this.updateProgress(percent, message);
  };

  protected onLog = async (
    context: EventContext,
    level: TaskLogLevel,
    message: string
  ) => {
    this.addLog(context.time, level, message);
  };
  protected onAttachment = async (context: EventContext, filePath: string) => {
    this.addLog(context.time, "info", `File attached: ${filePath}`);
  };

  protected onResult = async (context: EventContext, mrkdwnMessage: string) => {
    this.updateElement(
      "result",
      this.markdown.render(
        mrkdwnMessage
          .split("\n")
          .map((s) =>
            s.replace(/^[ \t]+/gm, (x) => {
              //replace leading whitespaces
              return new Array(x.length + 1).join("\u2003");
            })
          )
          .join("\n")
      )
    );
  };
}
