const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatepass',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

async function ensureSchemaCompatibility(conn) {
  await conn.query(
    `ALTER TABLE users
     MODIFY role ENUM('faculty','hod','dean','student','registrar','security','admin') NOT NULL`
  );
  await conn.query(
    `ALTER TABLE departments
     MODIFY department_name VARCHAR(255) NOT NULL`
  );
  await conn.query(
    `ALTER TABLE gate_passes
     MODIFY status ENUM('Pending HOD','Pending Dean','Pending Registrar','Approved','Rejected','Completed')
     NOT NULL DEFAULT 'Pending HOD'`
  );
}

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    await ensureSchemaCompatibility(conn);
    conn.release();
    console.log('MySQL connection pool ready');
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
    console.error('Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in your .env file.');
  }
}

module.exports = { pool, testConnection, ensureSchemaCompatibility };
