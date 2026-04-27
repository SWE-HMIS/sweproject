import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Connection config — supports three styles, in priority order:
//   1. MYSQL_URL / DATABASE_URL (single connection string, what Railway/Heroku give you)
//   2. DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (the local-dev style)
//   3. Railway-flavored MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
function buildPoolConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    // mysql2 accepts a URL via the `uri` field. We still apply the pool options below.
    return { uri: url };
  }
  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'hmis',
  };
}

const pool = mysql.createPool({
  ...buildPoolConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export default pool;
