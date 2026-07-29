import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IIntegrationService } from '../../shared/interfaces/i-integration-service.interface';
import {
  InvalidEndpointException,
  ResourceNotFoundException,
  UnauthorizedAccessException,
  BadRequestException,
  InternalServerErrorException,
  IntegrationException,
} from '../../shared/exceptions/integration-exceptions';
import { ISecurityConfig, SecurityType } from '../config/axios.configuration';

@Injectable()
export class AxiosService<T> implements IIntegrationService<T> {
  private logger = new Logger('AxiosService');
  private axiosInstance: AxiosInstance;

  constructor(
    baseUrl: string,
    private securityConfig: ISecurityConfig,
  ) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: this.buildHeaders(),
    });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.securityConfig.type) {
      case SecurityType.API_KEY:
        if (!this.securityConfig.apiKey) {
          throw new Error('API Key no proporcionada.');
        }
        headers['xi-api-key'] = this.securityConfig.apiKey;
        break;

      case SecurityType.BEARER_TOKEN:
        if (!this.securityConfig.token) {
          throw new Error('Token JWT no proporcionado.');
        }
        headers['Authorization'] = `Bearer ${this.securityConfig.token}`;
        break;

      case SecurityType.NONE:
        break;

      default:
        throw new Error('Tipo de seguridad no válido.');
    }

    return headers;
  }

  async get(
    endpoint: string,
    params?: Record<string, any>,
    responseType?: any,
  ): Promise<T> {
    try {
      const axiosConfig: any = { params };
      if (responseType) {
        axiosConfig.responseType = responseType;
      }
      this.logger.log(`[GET] ${endpoint} - Starting request`);
      const response = await this.axiosInstance.get(endpoint, axiosConfig);
      this.logger.log(
        `[GET] ${endpoint} - Response received (${response.status})`,
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, endpoint);
    }
  }

  async post(endpoint: string, data: any): Promise<T> {
    try {
      const resolvedUrl = this.axiosInstance.getUri({ url: endpoint });
      this.logger.log(`[POST] ${endpoint} - Starting request`);
      this.logger.log(`[POST] Resolved URL: ${resolvedUrl}`);
      const response = await this.axiosInstance.post(endpoint, data);
      this.logger.log(
        `[POST] ${endpoint} - Response received (${response.status})`,
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, endpoint);
    }
  }

  async put(endpoint: string, data: any): Promise<T> {
    try {
      this.logger.log(`[PUT] ${endpoint} - Starting request`);
      const response = await this.axiosInstance.put(endpoint, data);
      this.logger.log(
        `[PUT] ${endpoint} - Response received (${response.status})`,
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, endpoint);
    }
  }

  async delete(endpoint: string): Promise<void> {
    try {
      this.logger.log(`[DELETE] ${endpoint} - Starting request`);
      await this.axiosInstance.delete(endpoint);
      this.logger.log(`[DELETE] ${endpoint} - Response received`);
    } catch (error) {
      this.handleAxiosError(error, endpoint);
    }
  }

  private handleAxiosError(error: any, endpoint: string): never {
    this.logger.error(
      `Error en solicitud HTTP (${endpoint}): ${error.message}`,
      error.stack,
    );

    if (error.response) {
      const { status, data } = error.response;
      const remoteMessage =
        data?.detail?.message ||
        data?.detail ||
        data?.message ||
        'No detail provided by upstream API';
      this.logger.error(
        `HTTP ${status} upstream response for ${endpoint}: ${remoteMessage}`,
      );
      switch (status) {
        case 400:
          throw new BadRequestException(remoteMessage);
        case 401:
          throw new UnauthorizedAccessException();
        case 404:
          throw new ResourceNotFoundException(
            `${endpoint}. Upstream detail: ${remoteMessage}`,
          );
        case 500:
          throw new InternalServerErrorException(remoteMessage);
        default:
          throw new IntegrationException(
            `Error HTTP desconocido (${status}).`,
            status,
          );
      }
    } else if (error.request) {
      throw new InvalidEndpointException(endpoint);
    } else {
      throw new IntegrationException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
