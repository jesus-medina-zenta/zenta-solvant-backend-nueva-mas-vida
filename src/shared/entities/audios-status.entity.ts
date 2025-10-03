export class AudiosStatus {
  id?: string;
  id_conversacion: string;
  status: 'AUDIO_SAVED_IN_BUCKET' | 'AUDIO_PROCESSING' | 'AUDIO_FAILED';
  time_stamp: number;
  update_at: number;
  track_id?: string;
  agent_id?: string;
}
