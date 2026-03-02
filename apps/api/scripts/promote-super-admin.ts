/**
 * One-time script to promote a user to SUPER_ADMIN.
 * Run: cd apps/api && npm run promote:super-admin
 * Requires MONGODB_URI in .env
 */
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.join(__dirname, '../.env') });
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
import { MongoClient } from 'mongodb';

const EMAIL = 'augustoalejandro95@gmail.com';
const NEW_ROLE = 'super_admin';

async function promote() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Load .env or set it manually.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const users = db.collection('users');

  const result = await users.updateOne(
    { email: EMAIL },
    { $set: { role: NEW_ROLE } }
  );

  if (result.matchedCount === 0) {
    console.error(`User with email ${EMAIL} not found.`);
    await client.close();
    process.exit(1);
  }

  if (result.modifiedCount > 0) {
    console.log(`✓ User ${EMAIL} promoted to ${NEW_ROLE}`);
  } else {
    console.log(`User ${EMAIL} already has role ${NEW_ROLE}`);
  }

  await client.close();
}

promote().catch((err) => {
  console.error(err);
  process.exit(1);
});
