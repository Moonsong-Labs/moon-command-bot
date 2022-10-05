import { BotConfig } from "./config-types";

const prodConfig: BotConfig = {
  commands: {
    sample: { seconds: 10 },
    benchmark: {
      repos: {
        main: {
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
  history: { limit: 1000, urlPrefix: "/history/test/tasks" },
  hooks: { http: { urlPrefix: "/api" } },
  server: {
    url: "http://localhost:8000",
    listener: { port: 8000, hostname: "0.0.0.0" },
  },
};

export default prodConfig;
