import { BotConfig } from "./src/configs/config-types";

// Main bot server responding to all the hooks
// It uses a proxy to benchmark and fork-test
// see (config-sample-1.benchmark.ts)

/*
# Using environment variable for configuration
# (Those are fake values, you need to change them)

PUBLIC_URL=https://my-server.com

BENCHMARK_PROXY_URL=https://my-benchmark-server.com/json
BENCHMARK_PROXY_SECRET="just-another-secret"

GITHUB_PRIVATE_KEY="`cat github-private-key.pem`"
GITHUB_REPO_OWNER=purestake
GITHUB_REPO_NAME=moonbeam
GITHUB_INSTALLATION_ID=50032980
GITHUB_APP_ID=944744
GITHUB_CLIENT_ID=Iv1.4d9020ef212334021
GITHUB_CLIENT_SECRET=40fd329421a9356b9030291f030e312067120ef2
GITHUB_WEBHOOK_SECRET=co0bi91h6klf3fbp

SLACK_APP_TOKEN=xapp-1-AA04UR23921-2069468520693-8f8075ed8ed8a198206796319517b63ff6512f22d981417c8b830c29cd50b0f5
SLACK_SIGNING_SECRET=70f605a43aaa111bb037b26412b4773a
SLACK_BOT_TOKEN=xoxb-2069468520693-2069468520693-daf6e7689166ef96babda270
SLACK_COMMAND=/moonbot
*/

const config: BotConfig = {
  commander: { concurrentTasks: 10 },
  proxies: [
    {
      url: process.env.BENCHMARK_PROXY_URL,
      auth: { type: "secret", secret: process.env.BENCHMARK_PROXY_SECRET },
      commands: ["benchmark", "fork-test"],
    },
  ],
  commands: {
    sample: { seconds: 10 },
    "block-time": {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
    governance: {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
  },
  history: { limit: 1000 },
  hooks: {
    http: { urlPrefix: "/api" },
    json: { urlPrefix: "/json", auth: { type: "none" } },
    github: {
      moonbeam: {
        urlPrefix: "/github",
        probot: {
          privateKey: process.env.GITHUB_PRIVATE_KEY,
          appId: process.env.GITHUB_APP_ID,
          secret: process.env.GITHUB_WEBHOOK_SECRET,
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
  server: {
    serverUrl: process.env.PUBLIC_URL,
    listener: { port: 8000, hostname: "0.0.0.0" },
  },
};

export default config;
