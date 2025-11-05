const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Función para cargar variables de entorno desde .env
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('Archivo .env no encontrado');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      envVars[key] = value;
    }
  });
  
  return envVars;
}

async function checkUserRole() {
  const envVars = loadEnvFile();
  const mongoUri = envVars.MONGODB_URI;
  const dbName = envVars.MONGODB_DB || 'dance-platform';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB Atlas');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    const email = 'augustoalejandro95@gmail.com';
    
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    console.log('\n👤 INFORMACIÓN DEL USUARIO:');
    console.log('📧 Email:', user.email);
    console.log('👤 Nombre:', user.name);
    console.log('🎭 Rol actual:', user.role);
    console.log('🏠 Provider:', user.provider);
    
    // Verificar si el rol permite acceso a /users
    const allowedRoles = ['super_admin', 'admin', 'school_owner', 'administrative'];
    const hasAccess = allowedRoles.includes(user.role?.toLowerCase());
    
    console.log('\n🔐 PERMISOS:');
    console.log('Puede acceder a /admin/users:', hasAccess ? '✅ SÍ' : '❌ NO');
    console.log('Roles permitidos:', allowedRoles.join(', '));
    
    if (!hasAccess) {
      console.log('\n🔧 ACTUALIZANDO ROL A SUPER_ADMIN...');
      
      await usersCollection.updateOne(
        { email },
        { 
          $set: { 
            role: 'super_admin',
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Rol actualizado a super_admin');
      
      // Verificar el cambio
      const updatedUser = await usersCollection.findOne({ email });
      console.log('🎭 Nuevo rol:', updatedUser.role);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUserRole();
