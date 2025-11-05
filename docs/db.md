# Database Configuration - MongoDB

## Overview

The application uses MongoDB with Mongoose ODM for data persistence. This document covers the database setup, environment variables, and local development.

## Environment Variables

### Required Variables

- `MONGODB_URI`: MongoDB connection string
  - Development: `mongodb://localhost:27017/inti_dev`
  - Production: Your MongoDB Atlas or hosted MongoDB URI

### Optional Variables

- `MONGODB_DB`: Database name override (if not specified in URI)
  - Only needed if you want to override the database name from the URI

## Local Development Setup

### Option 1: Local MongoDB Instance

1. **Install MongoDB**:
   ```bash
   # macOS with Homebrew
   brew tap mongodb/brew
   brew install mongodb-community
   
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # Windows: Download from mongodb.com
   ```

2. **Start MongoDB**:
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Ubuntu/Debian
   sudo systemctl start mongod
   
   # Manual start
   mongod --dbpath /path/to/data/directory
   ```

3. **Set Environment Variable**:
   ```bash
   # In your .env file
   MONGODB_URI=mongodb://localhost:27017/inti_dev
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create Atlas Account**: Sign up at [mongodb.com/atlas](https://mongodb.com/atlas)

2. **Create Cluster**: Follow Atlas setup wizard

3. **Get Connection String**: 
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

4. **Set Environment Variable**:
   ```bash
   # In your .env file
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inti_dev?retryWrites=true&w=majority
   ```

### Option 3: Docker

```bash
# Start MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Set environment variable
MONGODB_URI=mongodb://localhost:27017/inti_dev
```

## Database Schema

### Collections

The application uses the following MongoDB collections:

- **users**: User accounts and profiles
- **analyses**: Individual dance analysis results (original feature)
- **drills**: Teacher-created reference drills (coach feature)
- **attempts**: Student attempts at drills (coach feature)

### Key Schemas

#### User Schema
```typescript
{
  _id: ObjectId,
  email: string (unique, indexed),
  name: string,
  role: string,
  createdAt: Date
}
```

#### Analysis Schema
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  source: string,
  fps: number,
  durationMs: number,
  bpm?: number,
  landmarks?: Mixed, // Optional pose data
  metrics: Mixed,    // Analysis results
  feedback: Mixed[],
  timeline: Mixed[],
  overallScore: number,
  createdAt: Date
}
```

#### Drill Schema (Coach Feature)
```typescript
{
  _id: ObjectId,
  teacherId: ObjectId (ref: User, indexed),
  title: string,
  bpm?: number,
  weights: {
    timing: number,
    hips: number,
    posture: number,
    arms: number
  },
  hints: string[],
  refFeatures: {
    featureNames: string[],
    perBeat: number[][]
  },
  phases: [{
    id: string,
    name: string,
    beatFrom: number,
    beatTo: number
  }],
  createdAt: Date
}
```

#### Attempt Schema (Coach Feature)
```typescript
{
  _id: ObjectId,
  drillId: ObjectId (ref: Drill, indexed),
  studentId: ObjectId (ref: User, indexed),
  fps: number,
  durationMs: number,
  bpm?: number,
  landmarks?: Mixed,
  scores: {
    global: number,
    timing: number,
    hips: number,
    posture: number,
    arms: number,
    perPhase: [{
      phaseId: string,
      score: number
    }]
  },
  timeline: Mixed[],
  feedback: string[],
  drills: Mixed[],
  createdAt: Date
}
```

## Indexes

The application automatically creates the following indexes for performance:

- `users.email` (unique)
- `analyses.userId + createdAt` (compound, descending on createdAt)
- `drills.teacherId + createdAt` (compound, descending on createdAt)
- `attempts.drillId + studentId + createdAt` (compound)
- `attempts.studentId + createdAt` (compound)

## Connection Configuration

The application uses the following MongoDB connection settings:

```typescript
{
  // Connection pool settings
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  
  // Connection timeout settings
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  
  // Retry settings
  retryWrites: true,
  retryReads: true,
  
  // Heartbeat settings
  heartbeatFrequencyMS: 10000,
  
  // Connection monitoring
  monitorCommands: true,
}
```

## Testing

### In-Memory MongoDB

For testing, the application uses `mongodb-memory-server` to create an in-memory MongoDB instance:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function connect() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}
```

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Considerations

### Performance
- Use MongoDB Atlas or a properly configured MongoDB instance
- Ensure proper indexing (automatically handled by the application)
- Monitor connection pool usage
- Consider read replicas for high-traffic applications

### Security
- Use strong authentication credentials
- Enable SSL/TLS encryption
- Restrict network access (IP whitelisting)
- Regular security updates

### Backup
- Enable automated backups (Atlas provides this)
- Test backup restoration procedures
- Consider point-in-time recovery requirements

### Monitoring
- Monitor connection pool metrics
- Track query performance
- Set up alerts for connection issues
- Monitor disk space and memory usage

## Troubleshooting

### Common Issues

1. **Connection Refused**:
   - Check if MongoDB is running
   - Verify MONGODB_URI is correct
   - Check network connectivity

2. **Authentication Failed**:
   - Verify username/password in connection string
   - Check database user permissions

3. **Timeout Errors**:
   - Check network latency
   - Increase timeout settings if needed
   - Verify MongoDB server performance

4. **Memory Issues**:
   - Monitor connection pool size
   - Check for memory leaks in queries
   - Optimize query patterns

### Debug Mode

Enable MongoDB debug logging:

```bash
# Set environment variable
DEBUG=mongoose:*

# Or in code
mongoose.set('debug', true);
```

## Migration from Previous Setup

If migrating from a different database system:

1. **Data Export**: Export existing data in JSON format
2. **Schema Mapping**: Map old schema to new MongoDB collections
3. **Data Import**: Use MongoDB import tools or custom scripts
4. **Validation**: Verify data integrity after migration
5. **Testing**: Run comprehensive tests with migrated data

## Support

For database-related issues:

1. Check MongoDB logs
2. Verify environment variables
3. Test connection with MongoDB client tools
4. Review application logs for Mongoose errors
5. Consult MongoDB documentation for specific error codes
