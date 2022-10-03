import { Reporter } from "./reporter";
import { Writable } from "node:stream";
import Debug from "debug";
import { TaskLogLevel } from "../commands/task";
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

  constructor(stream: Writable) {
    super();
    this.stream = stream;

    this.stream.write(`<!DOCTYPE html><html><head>
    <style>${CSS_STYLES}</style>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
    </head><body>
    <div class="card">
      <span id="task-id" class="w3-badge w3-grey"></span>
      <div class="card-title"><h1 id="title"></h1></div>
      <div id="status">...</div>
      <div class="w3-border">
        <div class="w3-green" id="progress" style="height:24px;width:0%"></div>
      </div>
      <pre id="logs"></pre>
    </div>\n`);
  }

  public reportInvalidTask(message?: string) {
    debug(`Invalid task`);
    this.updateElement("status", "created");
    this.updateElement("title", "Invalid task");
    this.updateElement("task-id", `N/A`);
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("w3-red");`
    );
    if (message) {
      this.addLog("error", message);
    }
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("w3-red");`
    );
    this.updateProgress(100, message);
    this.stream.end(`</body></html>`);
  }

  private writeScript(jsCommand: string) {
    this.stream.write(`<script>${jsCommand}</script>\n`);
  }

  private updateProgress(percent: number, message?: string) {
    debug(`progress: ${percent}`);
    this.updateElement(
      "status",
      `${percent > 0 && percent < 100 ? "In progress: " : ""}${
        message || `${percent}%`
      }`
    );
    this.writeScript(
      `document.getElementById("progress").style.width = "${percent}%";`
    );
  }

  private updateElement(element: string, value: string) {
    this.writeScript(
      `document.getElementById("${element}").innerHTML = \`${value}\``
    );
  }

  private addLog(level: TaskLogLevel, message: string) {
    this.writeScript(
      `{const log = document.createElement("div"); 
       log.classList.add('log');
       log.innerHTML = \`${new Date().toISOString()} ${level.toUpperCase()} ${message}\`;
       document.getElementById("logs").appendChild(log);}`
    );
  }

  protected async onEnd() {
    debug(`end`);
    this.stream.end(`</body></html>`);
  }

  protected async onCreate(title: string, cmdLine: string, link: string) {
    debug(`created`);
    this.updateElement("status", "created");
    this.updateElement("title", title || "task");
    this.updateElement("task-id", `#${this.task.id}`);
  }
  protected async onStart() {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey");
       document.getElementById("task-id").classList.add("w3-yellow");`
    );
    this.updateElement("status", "started");
  }
  protected async onSuccess(message?: string) {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("w3-green");`
    );
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("w3-green");`
    );
    this.updateProgress(100, `Success${message ? ` - ${message}` : ""}`);
  }
  protected async onFailure(message?: string) {
    this.writeScript(
      `document.getElementById("task-id").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("task-id").classList.add("w3-red");`
    );
    this.writeScript(
      `document.getElementById("progress").classList.remove("w3-grey", "w3-yellow");
       document.getElementById("progress").classList.add("w3-red");`
    );
    this.updateProgress(100, `Failure${message ? ` - ${message}` : ""}`);
  }
  protected async onProgress(percent: number, message?: string) {
    debug(`progress: ${percent}`);
    this.updateProgress(percent, message);
  }

  protected async onLog(level: TaskLogLevel, message: string) {
    this.addLog(level, message);
  }
  protected async onAttachment(filePath: string) {
    this.addLog("info", `File attached: ${filePath}`);
  }
}
