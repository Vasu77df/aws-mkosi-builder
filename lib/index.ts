import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

// Interface to define the properties required for the construct
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

export class AwsMkosiBuilder extends Construct {
  // Public properties that might be useful for consumers of this construct
  public readonly pipeline: codepipeline.Pipeline;
  public readonly buildProject: codebuild.PipelineProject;

  constructor(scope: Construct, id: string, props: AwsMkosiBuilderProps) {
    super(scope, id);

    // Create the CodeBuild project with necessary permissions for mkosi
    this.buildProject = new codebuild.PipelineProject(this, 'MkosiBuildProject', {
      projectName: props.buildProjectName || `${props.repositoryName}-mkosi-build`,
      buildSpec: props.buildSpec || codebuild.BuildSpec.fromObject({
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
              'chmod 600 definitions/mkosi.rootpw',
              'mkosivenv/bin/mkosi genkey && mkosivenv/bin/mkosi --directory definitions build',
            ],
          },
        },
        artifacts: {
          files: [
            '$CODEBUILD_SRC_DIR/definitions/build_output/**/*',
          ],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('public.ecr.aws/ubuntu/ubuntu:24.04_stable'),
        privileged: true, // Required for container operations
      },
    });

    // Grant necessary permissions to CodeBuild
    this.buildProject.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
    );

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: props.pipelineName || `${props.repositoryName}-mkosi-pipeline`,
    });

    // Add source stage
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: props.repositoryOwner,
      repo: props.repositoryName,
      branch: props.branchName,
      oauthToken: cdk.SecretValue.secretsManager(props.githubTokenSecretName),
      output: sourceOutput,
    });

    this.pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Add build stage
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Mkosi_Build',
      project: this.buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    this.pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });
  }
}