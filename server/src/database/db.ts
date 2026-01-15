import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PostgreSQL connection pool
export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'autochess',
  password: process.env.POSTGRES_PASSWORD || 'autochess123',
  database: process.env.POSTGRES_DB || 'autochess_db',
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

// Initialize database schema
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database schema...');

    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Helper function to execute queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Extract query type (INSERT, SELECT, UPDATE, etc.)
    const queryType = text.trim().split(' ')[0].toUpperCase();
    const tableName = text.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i)?.[1] || 'unknown';

    console.log(`📊 ${queryType} ${tableName} (${duration}ms, ${res.rowCount} rows)`);
    return res;
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  try {
    await pool.end();
    console.log('👋 Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}
