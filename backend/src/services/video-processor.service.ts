import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as child_process from 'child_process';
import * as process from 'process';

@Injectable()
export class VideoProcessorService implements OnModuleInit {
  private readonly logger = new Logger(VideoProcessorService.name);
  private ffmpegPath: string | null = null;

  async onModuleInit() {
    // Primero intentar usar el ffmpeg instalado en el sistema (especialmente en Docker)
    try {
      const { stdout } = await this.executeCommand('which ffmpeg');
      const systemPath = stdout.trim();
      if (systemPath && fs.existsSync(systemPath)) {
        this.logger.log(`Encontrado ffmpeg del sistema en: ${systemPath}`);
        ffmpeg.setFfmpegPath(systemPath);
        this.ffmpegPath = systemPath;
        
        // Verificar que funciona correctamente
        try {
          await this.executeCommand(`${systemPath} -version`);
          this.logger.log('ffmpeg instalado en el sistema funcionando correctamente');
          return;
        } catch (verifyError) {
          this.logger.warn(`Advertencia al verificar ffmpeg: ${verifyError.message}`);
          // Continuamos con otros métodos
        }
      }
    } catch (error) {
      this.logger.warn(`No se encontró ffmpeg en el sistema: ${error.message}`);
    }
    
    // Forzar el uso de la instalación de Homebrew en macOS
    if (os.platform() === 'darwin') {
      // En macOS, usar prioritariamente la instalación de Homebrew
      const homebrewPath = '/opt/homebrew/bin/ffmpeg';
      if (fs.existsSync(homebrewPath)) {
        ffmpeg.setFfmpegPath(homebrewPath);
        this.ffmpegPath = homebrewPath;
        this.logger.log(`Usando ffmpeg de Homebrew: ${homebrewPath}`);
        return;
      }
    }
    
    try {
      // Instalar automáticamente si es posible
      const installerPath = require('@ffmpeg-installer/ffmpeg').path;
      ffmpeg.setFfmpegPath(installerPath);
      this.ffmpegPath = installerPath;
      this.logger.log(`Usando ffmpeg del paquete npm: ${installerPath}`);
      
    } catch (error) {
      this.logger.warn(`No se pudo usar el paquete @ffmpeg-installer/ffmpeg: ${error.message}`);
      
      // Intentar encontrar en el PATH
      try {
        const command = os.platform() === 'win32' ? 'where' : 'which';
        const { stdout } = await this.executeCommand(`${command} ffmpeg`);
        const detectedPath = stdout.trim();
        
        if (detectedPath) {
          ffmpeg.setFfmpegPath(detectedPath);
          this.ffmpegPath = detectedPath;
          this.logger.log(`Encontrado ffmpeg en PATH: ${detectedPath}`);
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
            this.logger.log(`Encontrado ffmpeg en ubicación común: ${potentialPath}`);
            break;
          }
        } catch (error) {
          this.logger.verbose(`No se encontró ffmpeg en: ${potentialPath}`);
        }
      }
    }
    
    // Verificación final
    if (this.ffmpegPath) {
      try {
        await this.executeCommand(`"${this.ffmpegPath}" -version`);
        this.logger.log('Verificación final de ffmpeg completada con éxito');
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

    // En Docker, siempre usar /tmp que es siempre accesible con permisos de escritura
    const tempDir = '/tmp';
    this.logger.log(`Usando directorio temporal: ${tempDir}`);
    
    // Verificar que el directorio existe y tiene permisos correctos
    try {
      fs.accessSync(tempDir, fs.constants.W_OK);
      this.logger.log(`Directorio temporal ${tempDir} tiene permisos de escritura`);
    } catch (err) {
      this.logger.error(`Error de acceso al directorio temporal ${tempDir}: ${err.message}`);
      // Intentar crear el directorio si no existe
      try {
        fs.mkdirSync(tempDir, { recursive: true, mode: 0o777 });
        this.logger.log(`Directorio temporal creado: ${tempDir}`);
      } catch (mkdirErr) {
        this.logger.error(`No se pudo crear el directorio temporal: ${mkdirErr.message}`);
        throw new Error(`No hay directorio temporal disponible: ${mkdirErr.message}`);
    }
    }
    
    // Crear nombres de archivo únicos con timestamp para evitar colisiones
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const tempInputPath = path.join(tempDir, `input-${timestamp}-${randomId}.mp4`);
    const tempOutputPath = path.join(tempDir, `output-${timestamp}-${randomId}.mp4`);

    try {
      // Escribir el buffer a un archivo
    await fs.promises.writeFile(tempInputPath, inputBuffer);
      this.logger.log(`Archivo de entrada escrito: ${tempInputPath} (${inputBuffer.length} bytes)`);
    } catch (writeErr) {
      this.logger.error(`Error al escribir archivo de entrada: ${writeErr.message}`);
      throw new Error(`Error al escribir archivo de entrada: ${writeErr.message}`);
    }
    
    this.logger.log(`Procesando video... Input: ${tempInputPath}, Output: ${tempOutputPath}`);

    return new Promise((resolve, reject) => {
      // Verificar que el archivo de entrada existe
      if (!fs.existsSync(tempInputPath)) {
        const error = new Error(`El archivo de entrada ${tempInputPath} no existe`);
        this.logger.error(error.message);
        reject(error);
        return;
      }

      // Usar el comando ffmpeg directamente si tenemos problemas con fluent-ffmpeg
      const useDirectCommand = process.env.USE_DIRECT_FFMPEG === 'true';
      
      if (useDirectCommand) {
        this.logger.log('Usando comando ffmpeg directo en lugar de fluent-ffmpeg');
        try {
          const ffmpegCmd = `${this.ffmpegPath} -i ${tempInputPath} -c:v libx264 -preset fast -metadata:s:v rotate=0 -acodec copy -movflags +faststart ${tempOutputPath}`;
          this.logger.log(`Ejecutando comando: ${ffmpegCmd}`);
          
          child_process.exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
              this.logger.error(`Error al ejecutar ffmpeg: ${error.message}`);
              if (fs.existsSync(tempInputPath)) {
                fs.unlinkSync(tempInputPath);
              }
              reject(error);
              return;
            }
            
            this.logger.log('Procesamiento de video completado con éxito (comando directo)');
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
          });
        } catch (cmdError) {
          this.logger.error(`Error con comando directo ffmpeg: ${cmdError.message}`);
          if (fs.existsSync(tempInputPath)) {
            fs.unlinkSync(tempInputPath);
          }
          reject(cmdError);
        }
      } else {
        // Usar fluent-ffmpeg (método original)
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
            this.logger.log(`Comando ffmpeg iniciado: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
              this.logger.verbose(`Progreso del procesamiento: ${progress.percent}%`);
          }
        })
        .on('end', () => {
            this.logger.log('Procesamiento de video completado con éxito');
            
            // Verificar que el archivo de salida existe y tiene tamaño
            try {
              const stats = fs.statSync(tempOutputPath);
              this.logger.log(`Archivo de salida generado correctamente: ${tempOutputPath} (${stats.size} bytes)`);
              
              if (stats.size === 0) {
                this.logger.error('El archivo de salida está vacío');
                fs.unlink(tempInputPath, () => {});
                reject(new Error('El archivo de salida está vacío'));
                return;
              }
            } catch (statErr) {
              this.logger.error(`Error al verificar archivo de salida: ${statErr.message}`);
              fs.unlink(tempInputPath, () => {});
              reject(statErr);
              return;
            }
          
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
      }
    });
  }
} 