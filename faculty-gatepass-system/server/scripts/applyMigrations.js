require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatepass',
  });

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

  await conn.end();
  console.log('Database migrations applied.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
