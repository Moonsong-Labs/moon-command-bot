import * as path from "node:path";
import * as fs from "node:fs/promises";
import moment from "moment";

import { createAppAuth, StrategyOptions } from "@octokit/auth-app";
import {
  AuthInterface,
  InstallationAccessTokenAuthentication,
} from "@octokit/auth-app/dist-types/types";
import { Octokit } from "octokit";
import { Service } from "./service";
import Debug from "debug";
import { runTask } from "../actions/runner";

const debug = Debug("services:github");

export const COMMENT_MAX_LENGTH = 65536;
export const COMMENT_TRUNCATED_POSTFIX = "<truncated>...";

export class GithubServiceConfig {
  // Name to identify multiple remotes
  name: string;
  owner: string;
  repo: string;
  installationId: number | string;
  auth: StrategyOptions;
}
export class GithubService implements Service {
  public isReady: Promise<GithubService>;
  private installationId: string | number;
  public repo: string;
  public owner: string;
  public name: string;
  private app: AuthInterface;
  private jwt: InstallationAccessTokenAuthentication;
  private octokit: Octokit;

  constructor(config: GithubServiceConfig) {
    if (!config.owner) {
      throw new Error("Missing github owner");
    }
    if (!config.repo) {
      throw new Error("Missing github repo");
    }
    if (!config.installationId) {
      throw new Error(
        `Missing github installationId for ${config.owner}/${config.repo}`
      );
    }
    if (!config.auth) {
      throw new Error(
        `Missing github app config for ${config.owner}/${config.repo}`
      );
    }
    this.name = config.name;
    this.owner = config.owner;
    this.repo = config.repo;
    this.installationId = config.installationId;
    this.app = createAppAuth(config.auth);
    this.isReady = this.checkAuth().then(() => this);
  }

  async checkAuth() {
    if (
      this.jwt &&
      moment(new Date()).add(60, "seconds").isBefore(moment(this.jwt.expiresAt))
    ) {
      return;
    }
    debug(`${new Date()} before ${this.jwt && moment(this.jwt.expiresAt)}: Generating new token`);

    this.jwt = await this.app({
      type: "installation",
      installationId: this.installationId,
    });
    this.octokit = new Octokit({ auth: this.jwt.token });
  }

  public async getOctokit() {
    await this.checkAuth();
    return this.octokit;
  }

  public async getPullRequestData(pullNumber: number) {
    if (pullNumber === null || pullNumber === undefined || isNaN(pullNumber)) {
      throw new Error(`Invalid pull request number: ${pullNumber}`);
    }
    await this.checkAuth();

    return (
      await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
      })
    ).data;
  }

  public extendRepoOwner<T>(data: T): T & { owner: string; repo: string } {
    return { owner: this.owner, repo: this.repo, ...data };
  }

  async destroy() {}

  // Clone the moonbeam repo and setup no branch
  public async clone(directory: string): Promise<string> {
    const githubLink = `github.com/${this.owner}/${this.repo}`;
    try {
      await this.checkAuth();
      await fs.mkdir(directory, { recursive: true });
      const repoDirectory = path.join(directory, this.repo);

      const repoUrl = `https://x-access-token:${this.jwt.token}@${githubLink}`;
      debug(`push domain: ${githubLink}`);
      try {
        await runTask(`git clone ${repoUrl} ${repoDirectory}`, {
          cwd: directory,
        });
      } catch (error) {
        // if dest path has a .git dir, ignore
        // this error handling prevents subsequent git commands from interacting with the wrong repo
        debug(
          `failed to git clone ${githubLink}: checking .git ${(
            await fs.lstat(path.join(repoDirectory, "/.git"))
          ).isDirectory()}: ${error}`
        );
        if (
          !(await fs.lstat(path.join(repoDirectory, "/.git"))).isDirectory()
        ) {
          throw new Error(`Cannot clone ${githubLink}`);
        }
      }

      // Let's make sure the remote name is used also (instead of origin)
      await this.addAsRemote(repoDirectory);

      // We don't have submodules yet
      // await runTask("git submodule update --init", { cwd: repoDirectory });

      await runTask("git add . && git reset --hard HEAD", {
        cwd: repoDirectory,
      });
      const detachedHead = (
        await runTask("git rev-parse HEAD", { cwd: repoDirectory })
      ).trim();

      // Check out to the detached head so that any branch can be deleted
      await runTask(`git checkout ${detachedHead}`, { cwd: repoDirectory });
      return repoDirectory;
    } catch (error) {
      debug(`Failed to clone ${githubLink}: ${error}`);
      throw new Error(`Cannot clone ${githubLink}`);
    }
  }

  public async addAsRemote(repositoryPath: string): Promise<void> {
    const githubLink = `github.com/${this.owner}/${this.repo}`;
    try {
      await this.checkAuth();

      const repoUrl = `https://x-access-token:${this.jwt.token}@${githubLink}`;
      debug(`Adds remote ${this.name} [${githubLink}] to ${repositoryPath}`);

      await runTask(`git remote remove ${this.name} || true`, {
        cwd: repositoryPath,
      });
      await runTask(`git remote add ${this.name} ${repoUrl}`, {
        cwd: repositoryPath,
      });
    } catch (error) {
      debug(`Failed to add remote ${this.name} ${githubLink}: ${error}`);
      throw new Error(`Failed to add remote ${githubLink}`);
    }
  }

  public async checkoutBranch(
    repositoryPath: string,
    branch: string
  ): Promise<void> {
    try {
      await this.checkAuth();
      debug(`Setup branch ${branch}`);
      // Fetch and recreate the PR's branch
      await runTask(`git branch -D ${branch} || true`, { cwd: repositoryPath });
      await runTask(
        `git fetch ${this.name} ${branch} && git checkout --track ${this.name}/${branch}`,
        { cwd: repositoryPath },
        `Checking out ${branch}...`
      );
      await runTask(
        `git branch | grep ${branch} && git checkout ${branch} || git checkout -b ${branch}`,
        { cwd: repositoryPath }
      );
    } catch (error) {
      debug(`Failed to setup branch ${branch}: ${error}`);
      throw new Error(`Failed to setup branch ${branch}`);
    }
  }

  public async createBranch(
    repositoryPath: string,
    branch: string
  ): Promise<void> {
    try {
      await this.checkAuth();
      debug(`Create branch ${branch}`);
      await runTask(`git checkout -b ${branch}`, { cwd: repositoryPath });
    } catch (error) {
      debug(`Failed to create branch ${branch}: ${error}`);
      throw new Error(`Failed to create branch ${branch}`);
    }
  }

  public async commitAndPush(
    repositoryPath: string,
    branch: string,
    files: string[],
    message: string
  ): Promise<void> {
    try {
      await this.checkAuth();
      debug(`Commit files ${files.join(" ")}`);
      await runTask(
        `git add ${files.join(" ")} && git commit -m "${message}"`,
        { cwd: repositoryPath }
      );
      
      await this.checkAuth();
      debug(`Push branch ${branch} to ${this.name}`);
      await runTask(`git push ${this.name} ${branch}`, { cwd: repositoryPath });

    } catch (error) {
      debug(`Failed to commit and push files: ${error}`);
      throw new Error(`Failed to commit and push files`);
    }
  }

  // Creates a pull request for the given, already pushed, branch.
  // Returns the pull request number
  public async createPullRequest(
    base: string,
    branch: string,
    title: string,
    description: string
  ) {
    debug(`Creating pull request for head ${this.owner}:${branch} to ${base}`);
    try {
      await this.checkAuth();
      const { data: pullRequest } = await this.octokit.rest.pulls.create({
        title: title,
        owner: this.owner,
        repo: this.repo,
        head: `${this.owner}:${branch}`,
        base,
        body: description,
        maintainer_can_modify: false,
      });
      return { number: pullRequest.number, url: pullRequest.url };
    } catch (error) {
      debug(`Failed to create pull request for branch ${branch}: ${error}`);
      throw new Error(`Failed to create pull request for branch ${branch}`);
    }
  }
}
