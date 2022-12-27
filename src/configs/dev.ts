import { BotConfig } from "./config-types";

const prodConfig: BotConfig = {
  commander: { concurrentTasks: 1 },
  commands: {
    sample: { seconds: 10 },
    benchmark: null,
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
        { network: "kusama" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
  },
  history: { limit: 1000 },
  hooks: {
    http: { urlPrefix: "/api" },
    json: {
      urlPrefix: "/json",
      auth: { type: "secret", secret: "<change-me-for-production-usage>" },
    },
  },
  server: {
    serverUrl: "http://localhost:8000",
    listener: { port: 8000, hostname: "0.0.0.0" },
  },
};

export default prodConfig;
