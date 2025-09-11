import { createGunzip } from 'zlib';

export class CompressionUtil {
  /**
   * Descomprime un buffer comprimido con gzip.
   * @param compressedBuffer El buffer comprimido.
   * @returns Un Promise que resuelve con el buffer descomprimido.
   */
  static async decompressGzip(compressedBuffer: Buffer): Promise<Buffer> {
    const gunzip = createGunzip();

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', (err) => reject(err));

      gunzip.write(compressedBuffer);
      gunzip.end();
    });
  }
}
