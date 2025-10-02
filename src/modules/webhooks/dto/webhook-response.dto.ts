export class WebhookResponseDto {
  success: boolean;
  message: string;
  processedAt: string;

  constructor(success: boolean, message: string) {
    this.success = success;
    this.message = message;
    this.processedAt = new Date().toISOString();
  }
}
