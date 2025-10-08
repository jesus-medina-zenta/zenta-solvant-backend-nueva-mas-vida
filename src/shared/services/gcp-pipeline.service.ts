import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { JobsClient } from '@google-cloud/run';
import { IPipelineService } from '../interfaces/i-pipeline-service.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GcpPipelineService implements IPipelineService {
  private readonly logger = new Logger(GcpPipelineService.name);
  private readonly projectId: string;
  private readonly region: string;
  private readonly pipelineName: string;
  private readonly auth: GoogleAuth;
  private readonly jobsClient: JobsClient;

  constructor(private readonly configService: ConfigService) {
    this.projectId =
      this.configService.get<string>('gcpProjectId') || 'default-project';
    this.region = this.configService.get<string>('gcpRegion') || 'us-central1';
    this.pipelineName =
      this.configService.get<string>('gcpPipelineName') ||
      'zenta-solvant-pipe-reading-csv-dev';

    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: this.projectId,
    });

    this.jobsClient = new JobsClient({
      projectId: this.projectId,
    });

    this.logger.log(
      `GCP Pipeline Service initialized for project: ${this.projectId}`,
    );
  }

  async triggerPipelineAfterAction(
    action: string,
    id_carga: string,
    pipelineName?: string,
  ): Promise<any> {
    try {
      const jobName = pipelineName || this.pipelineName;

      const executionId = this.generateExecutionId(jobName);
      const response = await this.executeCloudRunJob(jobName, id_carga);

      this.logger.log(`Pipeline triggered successfully for action: ${action}`);

      return {
        executionId,
        jobName,
        status: 'SUBMITTED',
        startTime: new Date().toISOString(),
        message: `Cloud Run Job ${jobName} submitted successfully with id_carga: ${id_carga}`,
        action,
        id_carga,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Error triggering Cloud Run Job for action ${action} with id_carga ${id_carga}:`,
        error,
      );
      throw new BadRequestException({
        message: `Failed to trigger Cloud Run Job for action: ${action} with id_carga: ${id_carga}`,
        error: 'CLOUD_RUN_JOB_TRIGGER_ERROR',
        details: error.message,
      });
    }
  }

  private async executeCloudRunJob(
    jobName: string,
    id_carga: string,
  ): Promise<any> {
    try {
      const name = `projects/${this.projectId}/locations/${this.region}/jobs/${jobName}`;

      const overrides = {
        containerOverrides: [
          {
            args: ['python', '-m', 'src.main', id_carga],
          },
        ],
      };

      const request = {
        name,
        overrides,
      };

      this.logger.log(
        `Starting execution of Job: ${jobName} in ${this.region} with id_carga: ${id_carga}...`,
      );

      const [operation] = await this.jobsClient.runJob(request);

      this.logger.log('Job execution request sent successfully.');
      this.logger.log(`Operation name: ${operation.name}`);

      return {
        success: true,
        operationName: operation.name,
        jobName,
        id_carga,
        timestamp: new Date().toISOString(),
        message: `Cloud Run Job ${jobName} submitted successfully with id_carga: ${id_carga}`,
      };
    } catch (error) {
      this.logger.error(`Error executing Cloud Run Job ${jobName}:`, error);

      throw new BadRequestException({
        message: `Failed to execute Cloud Run Job: ${jobName}`,
        error: 'CLOUD_RUN_EXECUTION_ERROR',
        details: error.message,
      });
    }
  }
  // Generate a unique execution ID
  private generateExecutionId(pipelineName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4();
    return `${pipelineName}-${timestamp}-${uuid}`;
  }
}
