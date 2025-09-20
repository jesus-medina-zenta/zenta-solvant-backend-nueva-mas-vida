export interface IAudioStorageService {
  uploadAudio(
    audioId: string,
    audioBuffer: Buffer,
    fileExtension: string,
    folder?: string,
  ): Promise<string>;

  getAudioUrl(audioId: string, fileExtension?: string, folder?: string): string;

  getAudioPath(
    audioId: string,
    fileExtension?: string,
    folder?: string,
  ): string;

  deleteAudio(audioId: string): Promise<void>;

  audioExists(
    audioId: string,
    folder?: string,
    fileExtension?: string,
  ): Promise<boolean>;
}
