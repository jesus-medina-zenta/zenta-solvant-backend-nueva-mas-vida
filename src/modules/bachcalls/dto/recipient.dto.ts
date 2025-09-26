export class RecipientDto {
  id: string;
  phone_number: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at_unix: number;
  updated_at_unix: number;
  conversation_id: string;
  dynamic_variables: any;
}
