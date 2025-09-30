import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { IPipelineService } from '../interfaces/i-pipeline-service.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GcpPipelineService implements IPipelineService {
  private readonly logger = new Logger(GcpPipelineService.name);
  private readonly projectId: string;
  private readonly region: string;
  private readonly pipelineName: string;
  private readonly auth: GoogleAuth;

  constructor(private readonly configService: ConfigService) {
    this.projectId =
      this.configService.get<string>('gcpProjectId') || 'default-project';
    this.region = this.configService.get<string>('gcpRegion') || 'us-central1';
    this.pipelineName =
      this.configService.get<string>('gcpPipelineName') ||
      'zenta-solvant-pipe-reading-csv-dev';

    // Configure impersonation with proper scopes
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      // Use environment variables for impersonation
      projectId: this.projectId,
    });

    this.logger.log(
      `GCP Pipeline Service initialized for project: ${this.projectId}`,
    );
  }

  /**
   * Convenience method to trigger pipeline after a specific action
   */
  async triggerPipelineAfterAction(
    action: string,
    actionData: any,
    pipelineName?: string,
  ): Promise<any> {
    try {
      // Use configured pipeline name or provided one
      const jobName = pipelineName || this.pipelineName;

      // Generate unique execution ID
      const executionId = this.generateExecutionId(jobName);

      const pipelineData = {
        executionId,
        action,
        actionData,
        triggeredAt: new Date().toISOString(),
        source: 'zenta-solvant-backend',
        projectId: this.projectId,
        region: this.region,
      };

      // Execute the Cloud Run Job
      const response = await this.executeCloudRunJob(jobName, pipelineData);

      this.logger.log(`Pipeline triggered successfully for action: ${action}`);

      return {
        executionId,
        jobName,
        status: 'SUBMITTED',
        startTime: new Date().toISOString(),
        message: `Cloud Run Job ${jobName} submitted successfully`,
        action,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Error triggering Cloud Run Job for action ${action}:`,
        error,
      );
      throw new BadRequestException({
        message: `Failed to trigger Cloud Run Job for action: ${action}`,
        error: 'CLOUD_RUN_JOB_TRIGGER_ERROR',
        details: error.message,
      });
    }
  }

  /**
   * Execute Cloud Run Job with OAuth authentication
   */
  private async executeCloudRunJob(
    jobName: string,
    payload: any,
  ): Promise<any> {
    try {
      // Get authentication client with impersonation
      const authClient = await this.auth.getClient();
      const accessTokenResponse = await authClient.getAccessToken();

      if (!accessTokenResponse.token) {
        throw new Error(
          'Failed to obtain access token from impersonated service account',
        );
      }

      // Use the correct Cloud Run Jobs API v2 endpoint
      const url = `https://run.googleapis.com/v2/projects/${this.projectId}/locations/${this.region}/jobs/${jobName}:run`;

      // Use empty request body to avoid runWithOverrides permission
      const requestBody = {};

      // Make authenticated HTTP request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessTokenResponse.token}`,
          'Content-Type': 'application/json',
        },
        body: payload ? JSON.stringify(requestBody) : undefined,
      });

      // Better error handling - check content type before parsing
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }

        responseData = { message: responseText };
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseData?.error?.message || responseData?.message || 'Unknown error'}`,
        );
      }

      return {
        success: true,
        status: response.status,
        executionName: responseData?.metadata?.name || 'unknown',
        jobName,
        timestamp: new Date().toISOString(),
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

  private generateExecutionId(pipelineName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4();
    return `${pipelineName}-${timestamp}-${uuid}`;
  }
}
