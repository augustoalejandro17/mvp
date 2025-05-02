import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);

  async processVideo(inputBuffer: Buffer): Promise<{ processedFilePath: string; cleanup: () => void }> {
    const tempDir = os.tmpdir();
    const tempInputPath = path.join(tempDir, `input-${uuidv4()}.mp4`);
    const tempOutputPath = path.join(tempDir, `output-${uuidv4()}.mp4`);

    // Write input buffer to temporary file
    await fs.promises.writeFile(tempInputPath, inputBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .outputOptions([
          '-c:v libx264',           // Use H.264 codec
          '-preset fast',           // Encoding preset for good balance of speed/quality
          '-metadata:s:v rotate=0', // Reset rotation metadata
          '-acodec copy',           // Copy audio stream without re-encoding
          '-movflags +faststart',   // Enable fast start for web playback
          '-vf "transpose=2"',      // Rota el video 180 grados (corrección para videos invertidos)
          '-auto-rotate',           // Automatically rotate video based on metadata
        ])
        .output(tempOutputPath)
        .on('end', () => {
          this.logger.log('Video processing completed successfully');
          resolve({
            processedFilePath: tempOutputPath,
            cleanup: () => {
              // Cleanup function to remove temporary files
              fs.unlink(tempInputPath, (err) => {
                if (err) this.logger.error(`Error cleaning up input file: ${err.message}`);
              });
              fs.unlink(tempOutputPath, (err) => {
                if (err) this.logger.error(`Error cleaning up output file: ${err.message}`);
              });
            }
          });
        })
        .on('error', (err) => {
          this.logger.error(`Error processing video: ${err.message}`);
          // Clean up input file on error
          fs.unlink(tempInputPath, (unlinkErr) => {
            if (unlinkErr) this.logger.error(`Error cleaning up input file: ${unlinkErr.message}`);
          });
          reject(err);
        })
        .run();
    });
  }
} 