/**
 * Script para verificar y configurar ffmpeg
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🎬 Iniciando verificación de ffmpeg...');

// Determinar el sistema operativo
const platform = os.platform();
console.log(`Sistema operativo detectado: ${platform}`);

try {
  // Comprobar si ffmpeg ya está instalado
  let ffmpegPath = '';
  
  try {
    const command = platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    ffmpegPath = execSync(command).toString().trim();
    console.log(`✅ ffmpeg encontrado en: ${ffmpegPath}`);
  } catch (error) {
    console.log('❌ ffmpeg no encontrado en PATH.');
    
    // Comprobar ubicaciones comunes según el sistema operativo
    const commonPaths = platform === 'darwin' 
      ? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'] 
      : platform === 'win32'
        ? ['C:\\ffmpeg\\bin\\ffmpeg.exe']
        : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
    
    for (const potentialPath of commonPaths) {
      try {
        if (fs.existsSync(potentialPath)) {
          ffmpegPath = potentialPath;
          console.log(`✅ ffmpeg encontrado en ubicación alternativa: ${ffmpegPath}`);
          break;
        }
      } catch (err) {
        // Continuar con la siguiente ubicación
      }
    }
  }
  
  // Si se encontró ffmpeg, verificar que funciona
  if (ffmpegPath) {
    try {
      const version = execSync(`"${ffmpegPath}" -version`).toString().split('\n')[0];
      console.log(`✅ Versión de ffmpeg: ${version}`);
      
      // Crear un enlace simbólico si es necesario (solo en sistemas Unix)
      if (platform !== 'win32') {
        try {
          // Verificar si ya existe un enlace en /usr/local/bin
          if (!fs.existsSync('/usr/local/bin/ffmpeg')) {
            console.log('Creando enlace simbólico en /usr/local/bin/ffmpeg...');
            execSync(`sudo ln -sf "${ffmpegPath}" /usr/local/bin/ffmpeg`);
            console.log('✅ Enlace simbólico creado correctamente');
          }
        } catch (linkError) {
          console.log(`⚠️ No se pudo crear el enlace simbólico: ${linkError.message}`);
        }
      }
      
      console.log('✅ ffmpeg está correctamente configurado y funcionando.');
    } catch (error) {
      console.error(`❌ Error al verificar ffmpeg: ${error.message}`);
    }
  } else {
    console.error('❌ No se pudo encontrar ffmpeg en ninguna ubicación.');
    
    // Sugerir instalación
    if (platform === 'darwin') {
      console.log('Sugerencia: Instala ffmpeg usando Homebrew: brew install ffmpeg');
    } else if (platform === 'win32') {
      console.log('Sugerencia: Descarga ffmpeg desde https://ffmpeg.org/download.html');
    } else {
      console.log('Sugerencia: Instala ffmpeg usando apt: sudo apt-get install ffmpeg');
    }
  }
  
  // Verificar la instalación de paquete npm
  try {
    const packageJson = require('../package.json');
    const hasFfmpegInstaller = packageJson.dependencies && packageJson.dependencies['@ffmpeg-installer/ffmpeg'];
    
    if (hasFfmpegInstaller) {
      console.log('✅ Dependencia @ffmpeg-installer/ffmpeg encontrada en package.json');
    } else {
      console.log('⚠️ Dependencia @ffmpeg-installer/ffmpeg NO está en package.json');
      console.log('Instalando @ffmpeg-installer/ffmpeg...');
      execSync('npm install @ffmpeg-installer/ffmpeg --save');
      console.log('✅ @ffmpeg-installer/ffmpeg instalado correctamente');
    }
  } catch (error) {
    console.error(`❌ Error verificando/instalando ffmpeg-installer: ${error.message}`);
  }
  
} catch (error) {
  console.error(`❌ Error general: ${error.message}`);
} 