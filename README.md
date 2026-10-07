# Live Poll: one image, two environments

Real-time poll built with Express and Socket.IO. Votes appear instantly in every open browser tab.
Jenkins builds the Docker image once and runs it as `dev` and `prod`; only environment variables differ.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `POLL_QUESTION` | yes | Question shown on the page |
| `POLL_OPTIONS` | yes | Comma-separated options (at least two) |
| `PORT` | yes | Port the app listens on |
| `ADMIN_PASSWORD` | yes | Password for `POST /admin/reset` |
| `APP_ENV` | no | Label shown in the page badge (`dev`, `prod`) |

The app exits with an error if a required variable is missing.

## Jenkins setup

1. Install Docker on the agent and add the `jenkins` user to the `docker` group.
2. Add two **Secret text** credentials: `poll-admin-pass-dev` and `poll-admin-pass-prod`.
3. Create a **Pipeline** job using *Pipeline script from SCM* and the `Jenkinsfile` in this repo.
4. Build Now. Approve the PROD stage when prompted.

## Run locally without Jenkins

```bash
docker build -t livepoll:local .
docker run -d --name livepoll-dev -p 3001:3001 \
  -e APP_ENV=dev -e PORT=3001 \
  -e POLL_QUESTION="Which language?" -e POLL_OPTIONS="Python,Go,Rust" \
  -e ADMIN_PASSWORD=devpass livepoll:local
```

Open http://localhost:3001 in two tabs and vote in one.

## Check it

```bash
curl localhost:3001/health
curl localhost:3001/config
curl -X POST localhost:3001/admin/reset -H 'Content-Type: application/json' -d '{"password":"devpass"}'
docker inspect livepoll-dev  --format '{{.Image}}'
docker inspect livepoll-prod --format '{{.Image}}'   # same ID
```
