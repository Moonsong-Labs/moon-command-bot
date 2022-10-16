import { BotConfig } from "./src/configs/config-types";

/*
# Using environment variable for configuration
# (Those are fake values, you need to change them)

PUBLIC_URL=https://my-benchmark-server.com

MOONBEAM_PRIVATE_KEY="`cat github-private-key.pem`"
MOONBEAM_REPO_OWNER=purestake
MOONBEAM_REPO_NAME=moonbeam
MOONBEAM_INSTALLATION_ID=50032980
MOONBEAM_APP_ID=944744
MOONBEAM_CLIENT_ID=Iv1.4d9020ef212334021
MOONBEAM_CLIENT_SECRET=40fd329421a9356b9030291f030e312067120ef2

FORK_PRIVATE_KEY="`cat my-github-fork-private-key.pem`"
FORK_REPO_OWNER=my-fork
FORK_REPO_NAME=moonbeam
FORK_INSTALLATION_ID=50032980
FORK_APP_ID=944744
FORK_CLIENT_ID=Iv1.4d9020ef212334021
FORK_CLIENT_SECRET=40fd329421a9356b9030291f030e312067120ef2
*/

const config: BotConfig = {
  commander: { concurrentTasks: 1 }, // benchmark should not run concurrently
  commands: {
    benchmark: {
      gitFolder: `${process.cwd()}/repos`, // Where we will clone the repos
      repos: {
        main: {
          name: "official",
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
    "fork-test": {
      dataFolder: `/tmp/fork-test`, // Tmp folder to store fork-test data (> 30Gb needed)
      gitFolder: `${process.cwd()}/repos`,
      repo: {
        name: "moonbeam",
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
    },
  },
  hooks: { json: { urlPrefix: "/json", auth: { type: "none" } } },
  server: {
    serverUrl: process.env.PUBLIC_URL,
    listener: { port: 8000, hostname: "0.0.0.0" },
  },
};

export default config;
