# moon-command-bot

Bot to handle commands for github/slack/...

# How to use

The bot runs commands in response to:
* pull request comments
* slack commands
The form is:

`/<command> [action] [...args]`

[Environment variables](#configuration) and
[Github settings](#required-github-settings) have to properly configured
upfront for this interaction to work.

# Configuration

Create a `.env` file in the root with the following:

```
SERVICE_URL=<url used for sending link to tasks>

BENCHMARK_COMMAND=true
MOONBEAM_PRIVATE_PEM=
MOONBEAM_REPO_OWNER=
MOONBEAM_REPO_NAME=
MOONBEAM_INSTALLATION_ID=
MOONBEAM_APP_ID=
MOONBEAM_CLIENT_ID=
MOONBEAM_CLIENT_SECRET=
FORK_PRIVATE_PEM=
FORK_REPO_OWNER=
FORK_REPO_NAME=
FORK_INSTALLATION_ID=
FORK_APP_ID=
FORK_CLIENT_ID=
FORK_CLIENT_SECRET=

SLACK_HOOK=true
SLACK_APP_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=

GITHUB_HOOK=true
GITHUB_PRIVATE_PEM=
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
GITHUB_INSTALLATION_ID=
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

# Linting and formatting

The commands `npm run format` and `npm run lint` are available for ensuring
style consistency on this project's code.

# Running

## Locally

`npm && npm start`


# Required Github settings

## Permissions

* Metadata: Read Only
* Issues: Read/Write
* Pull Requests: Read/Write
* Contents: Read/Write

## Event subscriptions

* Issue comments
