export interface ICsvStorageService {
  uploadCsv(
    fileName: string,
    fileBuffer: Buffer,
    folder?: string,
  ): Promise<string>;
  getCsvPath(fileName: string, folder?: string): string;
}
