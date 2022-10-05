import {
  BenchmarkRepos,
  benchmarkRuntime,
  BenchRunConfig,
} from "../../actions/benchmark";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_TRUNCATED_POSTFIX,
  GithubService,
} from "../../services/github";

import { Task } from "../task";
import { runTask } from "../../actions/runner";

import Debug from "debug";
const debug = Debug("commands:benchmark");

export class BenchmarkTask extends Task {
  private cancelled: boolean;
  private repos: BenchmarkRepos;
  public readonly name: string;

  constructor(keyword: string, id: number, repos: BenchmarkRepos) {
    super(keyword, id);
    this.cancelled = false;
    this.repos = repos;
    this.name = `Benchmarking runtime`;
  }

  public async execute(parameters: { [name: string]: string }) {
    debug(`Executing: ${parameters.cmdLine}`);
    // try {
    // if (!parameters.pull_number) {
    //   logger.end(`Missing parameter pull_number`);
    //   return;
    // }
    // if (!parameters.issue_number) {
    //   logger.end(`Missing parameter issue_number`);
    //   return;
    // }

    const pull_number: number | undefined =
      parameters.pullNumber && parseInt(parameters.pullNumber);
    const issue_number: number | undefined =
      parameters.issueNumber && parseInt(parameters.issueNumber);
    const [_, ...commandParams] = parameters.cmdLine.split(" ");

    const moonbeamRest = (await this.repos.main.getOctokit()).rest;

    // TODO: We might think to allow external PR
    // const contributor = pr.data.head.user.login;
    const branch = pull_number
      ? (
          await moonbeamRest.pulls.get(
            this.repos.main.extendRepoOwner({ pull_number })
          )
        ).data.head.ref
      : "master";

    debug(`Running benchmark from ${branch}`);

    // try {
    this.emit("progress", 5, `Starting benchmark for branch: ${branch}`);

    // const initialInfo =
    //   `Starting benchmark for branch: ${branch}\n` +
    //   `Comment will be updated.\n`;
    // debug(initialInfo);

    // const issueComment =
    //   issue_number &&
    //   this.moonbeamRepo.extendRepoOwner({
    //     body: initialInfo,
    //     issue_number,
    //   });
    // const issue_comment =
    //   issueComment &&
    //   (await moonbeamRest.issues.createComment(issueComment));
    // const comment_id = issue_comment && issue_comment.data.id;

    const config = {
      branch,
      command: { type: "pallet", palletName: "author-mapping" },
      repos: this.repos,
    } as BenchRunConfig;
    debug("benchmarkRuntime");

    // kick off the build/run process...
    const { outputFile, pullNumber, logs, benchCommand, repoDirectory } =
      await benchmarkRuntime(config);

    this.emit("log", "debug", `Executed: ${benchCommand}`);
    this.emit("log", "info", logs);
    this.emit("progress", 95, `Checking rustup`);

    const toolchain = (
      await runTask("rustup show active-toolchain --verbose", {
        cwd: repoDirectory,
      })
    ).trim();

    // if (comment_id) {
    //   await moonbeamRest.issues.updateComment(
    //     this.moonbeamRepo.extendRepoOwner({
    //       comment_id,
    //       body: `Error running benchmark: **${branch}**\n\n<details><summary>stdout</summary>${logs}</details>`,
    //     })
    //   );
    // }

    const bodyPrefix = `
  Benchmark for branch "${branch}" with command ${benchCommand}
  
  Toolchain: ${toolchain}
  
  <details>
  <summary>Results</summary>
  
  \`\`\`
  `.trim();

    const bodySuffix = `
  \`\`\`
  
  </details>
  `.trim();

    const padding = 16;
    const formattingLength = bodyPrefix.length + bodySuffix.length + padding;
    const length = formattingLength + logs.length;
    const cleanedLogs =
      length < COMMENT_MAX_LENGTH
        ? logs
        : `${logs.slice(
            0,
            COMMENT_MAX_LENGTH -
              (COMMENT_TRUNCATED_POSTFIX.length + formattingLength)
          )}${COMMENT_TRUNCATED_POSTFIX}`;

    const body = `
  ${bodyPrefix}
  ${cleanedLogs}
  ${bodySuffix}
  `.trim();

    this.emit("attachment", outputFile);
    this.emit("log", "info", body);
    // if (comment_id) {
    //   await moonbeamRest.issues.updateComment(
    //     this.moonbeamRepo.extendRepoOwner({ comment_id, body })
    //   );
    // }
    // } catch (e) {
    //   console.log(e);
    //   if (issue_number) {
    //     await moonbeamRest.issues.createComment(
    //       this.moonbeamRepo.extendRepoOwner({
    //         issue_number,
    //         body: `ERROR: Failed to execute benchmark: ${e.message}`,
    //       })
    //     );
    //   }
    // }
    // } catch (e) {
    //   console.log(e);
    // }
    debug(`Done benchmarking`);
  }

  cancel() {
    this.cancelled = true;
  }
}
