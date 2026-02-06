# Make open-source apps

This is a testing repo used to test workflow during the development of the Github open-source apps project.

# Usage

Install required package with `npm install`. Alternatively, you can just install the CLI with `npm install -g @integromat/make-cli`.

You need to `export MAKE_API_TOKEN=<your-api-token>`

All examples have the root of this repo as current working directory.

## Clone an app

Cloning is done only once per app, to initialize the local file structure. Subsequent syncs from Make to local machine are done with pull.

Steps :

1. `mkdir -p apps/<local-app-name>`
3. `make-cli clone <app-name> --local-dir $(pwd)/apps/<local-app-name> --make-host <URL-to-make-instance>`

This will guide you through interactive setup. Accepting all the defaults is fine.

Notes:

- Use `npm run make-cli --` if not installed globally
- If you want to clone the app for the second time, you need to delete the `apps/<local-app-name>` directory
- `<local-app-name>` and `<app-name>` can (and probably should), but don't need to be same
- `<URL-to-make-instance>` is for example `eu2.make.com`

## Pull an app

This sync changes from Make to local machine.

- `make-cli pull --local-dir $(pwd)/apps/<local-app-name>/src`

## Deploy an app

This pushes the changes from local machine to Make.

- `make-cli deploy --local-dir $(pwd)/apps/custom-app-ejnei2/src`

### Commands
New module
```
npm run cli:start -- create-module --module-id myModule --label "My Module" --description "Some description" --type action --crud create --local-dir apps/oss-app-test
```
