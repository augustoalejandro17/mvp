const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

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

const envVars = loadEnvFile();
const mongoUri = envVars.MONGODB_URI;
const dbName = envVars.MONGODB_DB || 'dance-platform';
const jwtSecret = 'your-secret-key-here';

let db;

// Conectar a MongoDB
MongoClient.connect(mongoUri)
  .then(client => {
    console.log('✅ Conectado a MongoDB Atlas');
    db = client.db(dbName);
  })
  .catch(error => {
    console.error('❌ Error conectando a MongoDB:', error);
  });

// Endpoint de login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Intento de login:', email);
    
    if (!db) {
      return res.status(500).json({ message: 'Database not connected' });
    }
    
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    console.log('✅ Usuario encontrado:', user.email, 'Rol:', user.role);
    
    if (!user.password) {
      console.log('❌ Usuario sin contraseña');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const isValid = await argon2.verify(user.password, password);
    
    if (!isValid) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    console.log('✅ Login exitoso');
    
    // Crear token JWT
    const token = jwt.sign(
      { 
        sub: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para obtener usuarios (simulando /admin/users)
app.get('/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not connected' });
    }
    
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();
    
    console.log(`✅ Devolviendo ${users.length} usuarios`);
    
    res.json(users);
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`🚀 Backend simple corriendo en http://localhost:${PORT}`);
});
