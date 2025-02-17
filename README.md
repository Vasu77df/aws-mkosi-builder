# Welcome To a CDK construct to run OS build jobs using AWS CodePipelines, Codebuild and mkosi.

It demonstrates a CDK Construct Library that includes a construct (`AwsMkosiBuilder`)
which contains the following
- An AWS CodePipeline
- With a Github source interface to link to github repos.
   - Create an oauth token in your github repo.
   - Then upload the token to the AWS Secrets manager like so to use in your construct using aws-cli
```
aws secretsmanager create-secret --name github-oauth-token --secret-string "your-token"
```
- A codeBuild job that by default can run a build against my custom mkosi defined distribution [aws-ready-edge-os](https://github.com/Vasu77df/aws-ready-edge-os).
- You can bring your own Codbuild BuildSpec as well to define your own build. Below is a spec example you can copy:
```typescript
codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              // Install necessary dependencies for mkosi
              'ls -alh',
              "apt-get -y update && apt-get -y upgrade",
              "apt-get install -y python3 python3-venv git",
              "/usr/bin/python3 -m venv mkosivenv",
              "mkosivenv/bin/pip install git+https://github.com/systemd/mkosi.git@v24.3",
              "mkosivenv/bin/mkosi dependencies | xargs -d '\n' apt-get install -y"
            ],
          },
          build: {
            commands: [
              // Run mkosi build command
              'mkosivenv/bin/mkosi genkey && mkosivenv/bin/mkosi build',
            ],
          },
        },
        artifacts: {
          files: [
            '$CODEBUILD_SRC_DIR/mkosi.output/**/*'
          ],
        },
      }),
```

The construct defines an interface (`AwsMkosiBuilderProps`) to configure the following

```typescript
export interface AwsMkosiBuilderProps {
  // Repository configuration
  repositoryOwner: string;
  repositoryName: string;
  branchName: string;
  
  // GitHub authentication (using OAuth token stored in Secrets Manager)
  githubTokenSecretName: string;
  
  // Optional properties with defaults
  buildSpec?: codebuild.BuildSpec;
  pipelineName?: string;
  buildProjectName?: string;
}

```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests

## Example

Use this in your CDK project to define your own build.

Here's a reference example you can copy if you desire.
- https://github.com/Vasu77df/aws-hosted-mkosi-build-example