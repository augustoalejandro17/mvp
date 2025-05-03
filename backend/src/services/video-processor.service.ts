import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as child_process from 'child_process';

@Injectable()
export class VideoProcessorService implements OnModuleInit {
  private readonly logger = new Logger(VideoProcessorService.name);
  private ffmpegPath: string | null = null;

  async onModuleInit() {
    // Forzar el uso de la instalación de Homebrew en macOS
    if (os.platform() === 'darwin') {
      // En macOS, usar prioritariamente la instalación de Homebrew
      const homebrewPath = '/opt/homebrew/bin/ffmpeg';
      if (fs.existsSync(homebrewPath)) {
        ffmpeg.setFfmpegPath(homebrewPath);
        this.ffmpegPath = homebrewPath;
        
        return;
      }
    }
    
    try {
      // Instalar automáticamente si es posible
      const installerPath = require('@ffmpeg-installer/ffmpeg').path;
      ffmpeg.setFfmpegPath(installerPath);
      this.ffmpegPath = installerPath;
      
    } catch (error) {
      
      
      // Intentar encontrar en el PATH
      try {
        const command = os.platform() === 'win32' ? 'where' : 'which';
        const { stdout } = await this.executeCommand(`${command} ffmpeg`);
        const detectedPath = stdout.trim();
        
        if (detectedPath) {
          ffmpeg.setFfmpegPath(detectedPath);
          this.ffmpegPath = detectedPath;
          
        } else {
          this.logger.error('No se pudo encontrar ffmpeg en el PATH');
        }
      } catch (execError) {
        this.logger.error('Error al buscar ffmpeg en PATH:', execError.message);
      }
    }
    
    // Si todavía no lo hemos encontrado, buscar en ubicaciones comunes
    if (!this.ffmpegPath) {
      const commonPaths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/opt/local/bin/ffmpeg',
        '/usr/local/opt/ffmpeg/bin/ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe'
      ];
      
      for (const potentialPath of commonPaths) {
        try {
          if (fs.existsSync(potentialPath)) {
            ffmpeg.setFfmpegPath(potentialPath);
            this.ffmpegPath = potentialPath;
            
            break;
          }
        } catch (error) {
          
        }
      }
    }
    
    // Verificación final
    if (this.ffmpegPath) {
      try {
        await this.executeCommand(`"${this.ffmpegPath}" -version`);
        
      } catch (error) {
        this.logger.error(`Error al verificar ffmpeg: ${error.message}`);
        this.ffmpegPath = null;
      }
    } else {
      this.logger.error('⚠️ No se pudo encontrar ffmpeg en ninguna ubicación. El procesamiento de video no funcionará.');
    }
  }

  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      child_process.exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  async processVideo(inputBuffer: Buffer): Promise<{ processedFilePath: string; cleanup: () => void }> {
    if (!this.ffmpegPath) {
      this.logger.error('ffmpeg no está disponible. No se puede procesar el video.');
      throw new Error('Cannot find ffmpeg. Please install ffmpeg to process videos.');
    }

    // Usar el directorio personal del usuario que es más seguro que /tmp
    const homeDir = os.homedir();
    let tempDir = path.join(homeDir, '.dancemvp-temp');
    
    // Asegurar que el directorio existe
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (err) {
      this.logger.error(`Error al crear directorio temporal: ${err.message}`);
      // Usar /tmp como respaldo
      tempDir = os.tmpdir();
    }

    const tempInputPath = path.join(tempDir, `input-${uuidv4()}.mp4`);
    const tempOutputPath = path.join(tempDir, `output-${uuidv4()}.mp4`);

    await fs.promises.writeFile(tempInputPath, inputBuffer);
    
    
    // Comprobar permisos en el directorio de salida
    try {
      const testFile = path.join(tempDir, `test-${uuidv4()}.txt`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
    } catch (err) {
      this.logger.error(`Problemas de permisos en directorio temporal: ${err.message}`);
      throw new Error(`Error de permisos en directorio temporal: ${err.message}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .outputOptions([
          '-c:v libx264',            // Codec H.264
          '-preset fast',            // Balance velocidad/calidad
          '-metadata:s:v rotate=0',  // Resetear metadatos de rotación
          '-acodec copy',            // Copiar audio sin recodificar
          '-movflags +faststart'     // Para reproducción web
        ])
        .output(tempOutputPath)
        .on('start', (commandLine) => {
          
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            
          }
        })
        .on('end', () => {
          
          resolve({
            processedFilePath: tempOutputPath,
            cleanup: () => {
              fs.unlink(tempInputPath, (err) => {
                if (err) this.logger.error(`Error limpiando archivo temporal: ${err.message}`);
              });
              fs.unlink(tempOutputPath, (err) => {
                if (err) this.logger.error(`Error limpiando archivo temporal: ${err.message}`);
              });
            }
          });
        })
        .on('error', (err) => {
          this.logger.error(`Error procesando video: ${err.message}`);
          fs.unlink(tempInputPath, () => {});
          reject(err);
        })
        .run();
    });
  }
} 