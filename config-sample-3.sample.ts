import { BotConfig } from "./src/configs/config-types";

const config: BotConfig = {
  commander: { concurrentTasks: 1 },
  commands: { sample: { seconds: 10 } },
  hooks: {
    json: { urlPrefix: "/json", auth: { type: "secret", secret: "test" } },
  },
  server: {
    serverUrl: "http://localhost:8001",
    listener: { port: 8001, hostname: "0.0.0.0" },
  },
};

export default config;
