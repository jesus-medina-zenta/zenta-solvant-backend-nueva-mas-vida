export class WebhookResponseDto {
  success: boolean;
  message: string;
  processedAt: string;
  eventId?: string;

  constructor(success: boolean, message: string, eventId?: string) {
    this.success = success;
    this.message = message;
    this.processedAt = new Date().toISOString();
    this.eventId = eventId;
  }
}
