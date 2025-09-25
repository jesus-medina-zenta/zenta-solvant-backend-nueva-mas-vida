export interface IAudioStorageService {
  uploadAudio(
    audioId: string,
    audioBuffer: Buffer,
    fileExtension: string,
    folder?: string,
  ): Promise<string>;

  getAudioPath(
    audioId: string,
    fileExtension?: string,
    folder?: string,
  ): string;
}
