import { BotConfig } from "./config-types";

const prodConfig: BotConfig = {
  commands: {
    sample: { seconds: 10 },
    benchmark: {
      gitFolder: `${process.cwd()}/repos`,
      repos: {
        main: {
          name: "offical",
          owner: process.env.MOONBEAM_REPO_OWNER,
          repo: process.env.MOONBEAM_REPO_NAME,
          installationId: process.env.MOONBEAM_INSTALLATION_ID,
          auth: {
            appId: process.env.MOONBEAM_APP_ID,
            clientId: process.env.MOONBEAM_CLIENT_ID,
            clientSecret: process.env.MOONBEAM_CLIENT_SECRET,
            privateKey: process.env.MOONBEAM_PRIVATE_KEY,
          },
        },
        fork: {
          name: "fork",
          owner: process.env.FORK_REPO_OWNER,
          repo: process.env.FORK_REPO_NAME,
          installationId: process.env.FORK_INSTALLATION_ID,
          auth: {
            appId: process.env.FORK_APP_ID,
            clientId: process.env.FORK_CLIENT_ID,
            clientSecret: process.env.FORK_CLIENT_SECRET,
            privateKey: process.env.FORK_PRIVATE_KEY,
          },
        },
      },
    },
    "block-time": {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
  },
  history: {
    limit: 1000,
    urlPrefix: "/history",
    serverUrl: process.env.BOT_URL,
  },
  hooks: {
    http: { urlPrefix: "/api" },
    github: {
      moonbeam: {
        urlPrefix: "/github",
        probot: {
          privateKey: process.env.GITHUB_PRIVATE_KEY,
          appId: process.env.GITHUB_APP_ID,
          secret: process.env.GITHUB_WEBHOOK_SECRET || undefined,
        },
        repo: {
          name: "offical",
          owner: process.env.GITHUB_REPO_OWNER,
          repo: process.env.GITHUB_REPO_NAME,
          installationId: process.env.GITHUB_INSTALLATION_ID,
          auth: {
            appId: process.env.GITHUB_APP_ID,
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            privateKey: process.env.GITHUB_PRIVATE_KEY,
          },
        },
      },
    },
    slack: {
      urlPrefix: "/slack",
      slackCommand: process.env.SLACK_COMMAND || "/moonbot",
      auth: {
        appToken: process.env.SLACK_APP_TOKEN,
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
      },
    },
  },
  server: { listener: { port: 8000, hostname: "0.0.0.0" } },
};

export default prodConfig;
