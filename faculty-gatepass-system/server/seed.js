const { notify } = require('./services/notificationService');
/**
 * Seeds the gatepass database with demo departments, users, and sample
 * gate pass requests so the system is immediately explorable after setup.
 *
 * Run from /server:
 *   npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DEMO_PASSWORD = 'Passw0rd!'; // same password for every seeded demo account

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Shobh7376@',
    database: process.env.DB_NAME || 'gatepass',
    multipleStatements: true,
  });

  console.log('Clearing existing demo data...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE approval_history');
  await conn.query('TRUNCATE TABLE gate_passes');
  await conn.query('TRUNCATE TABLE users');
  await conn.query('TRUNCATE TABLE departments');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log('Creating departments...');
  const [cse] = await conn.query(`INSERT INTO departments (department_name, dept_code) VALUES ('Computer Science & Engineering','CSE')`);
  const [mech] = await conn.query(`INSERT INTO departments (department_name, dept_code) VALUES ('Mechanical Engineering','MECH')`);
  const [ece] = await conn.query(`INSERT INTO departments (department_name, dept_code) VALUES ('Electronics & Communication','ECE')`);
  const [admin] = await conn.query(`INSERT INTO departments (department_name, dept_code) VALUES ('Administration','ADMIN')`);
  const deptId = { CSE: cse.insertId, MECH: mech.insertId, ECE: ece.insertId, ADMIN: admin.insertId };
  const programs = [
    'B.Tech In Computer Science & Engineering',
    'B.Tech In Civil Engineering',
    'Bachelor Of Education',
    'B.Tech In Mechanical Engineering',
    'B.Tech In Electronics And Communication Engineering',
    'B.Sc. In Information Technology',
    'Bachelor Of Computer Application',
    'Bachelor Of Arts In Journalism And Mass Communication',
    'Bachelor Of Library Science',
    'B.Com.(Bachelor OF Commerce)',
    'Bachelor Of Arts',
    'Bachelor Of Business Administration',
    'Bachelor Of Arts And Bachelor Of Legislative Law',
    'Bachelor Of Legislative Law',
    'B. Tech In Electrical & Electronics Engineering',
    'Bsc In Nursing',
    'Bachelor Of Science In Yoga',
    'Bachelor Of Physiotherapy',
    'Bachelor In Medical Lab Technician',
    'Bachelor Of Science In Physics',
    'Bachelor Of Science In Chemistry',
    'Bachelor Of Science In Mathematics',
    'Bachelor Of Science In Forensic Sciences',
    'B.Sc. In Botany',
    'B.Sc. In Biotechnology',
    'B.Sc. In Microbiology',
    'B.Sc. In Zoology',
    'Bachelor Of Education (Part Time)',
    'Bachelor Of Physical Education',
    'Bachelor Of Physical Education And Sports',
    'Bachelor Of Pharmacy',
    'B.Sc. In Computer Science',
    'B.Sc. In Data Science',
    'Bachelor Of Science (Honours) Agriculture',
    'Post Basic B.Sc. Nursing Programme (2-Year Programme For Diploma Nurses)',
    'B.Tech In Computer Science Engineering (AI/ML)',
    'B.Tech In Computer Science Engineering (Data Science)',
    'BBA In Hospital Administration',
    'BBA (Business Analytics) SAMATRIX',
    'B.Tech (M.E.) (Digital Manufacturing Using AI And CPS)',
    'B.Tech (EEE) (Smart Semiconductor Device & Sustainable Power Engineering With AI Integration)',
    'B.Tech. (E.C.E.) (Semi-Conductor Design Framework For Industrial ICs)',
    'BCA Full Stack Web Development (Java)',
    'BCA AIML In Collaboration With Samatrix',
    'B Sc DS AIML In Collaboration With IBM',
    'B Sc CS AIML In Collaboration With IBM',
    'B Sc IT AIML In Collaboration With IBM',
    'B.Tech.(CSE) (Data Science) With Samatrix.io',
    'B.Tech. (CSE) (Full Stack Web Development) With L&T',
    'B.Tech AIML With SAMATRIX',
    'B.Com Banking & Finance In Collaboration With IIBF',
    'B.Com Practitioner Approach To Finance Essentials',
  ];
  for (const [index, program] of programs.entries()) {
    await conn.query(
      `INSERT INTO departments (department_name, dept_code) VALUES (?, ?)`,
      [program, `PRG${String(index + 1).padStart(3, '0')}`]
    );
  }

  console.log('Creating users...');
  async function addUser(name, employeeId, email, role, department) {
    const [r] = await conn.query(
      `INSERT INTO users (name, employee_id, email, password_hash, department_id, role) VALUES (?,?,?,?,?,?)`,
      [name, employeeId, email, hash, deptId[department], role]
    );
    return r.insertId;
  }

  const rajesh = await addUser('Shobhnath Shukla', 'AU250505', 'shobhnath.shukla.au250505@rntu.ac.in', 'faculty', 'CSE');
  const priya = await addUser('Dr. Priya Nair', 'EMP1044', 'priya.nair@rntu.ac.in', 'faculty', 'CSE');
  const sameer = await addUser('Dr. Sameer Joshi', 'EMP1077', 'sameer.joshi@rntu.ac.in', 'faculty', 'MECH');
  const kavita = await addUser('Dr. Kavita Rao', 'EMP1091', 'kavita.rao@rntu.ac.in', 'faculty', 'ECE');

  const meera = await addUser('Dr. Meera Iyer', 'EMP0410', 'meera.iyer@rntu.ac.in', 'hod', 'CSE');
  const ashok = await addUser('Dr. Ashok Verma', 'EMP0355', 'ashok.verma@rntu.ac.in', 'hod', 'MECH');
  const sunita = await addUser('Dr. Sunita Rao', 'EMP0512', 'sunita.rao@rntu.ac.in', 'hod', 'ECE');

  const deanCse = await addUser('Dr. Rajesh Gupta', 'DEAN001', 'dean.cse@rntu.ac.in', 'dean', 'CSE');
  const deanMech = await addUser('Dr. Sameer Malviya', 'DEAN002', 'dean.mech@rntu.ac.in', 'dean', 'MECH');

  const sharma = await addUser('Prof. A. K. Sharma', 'EMP0002', 'registrar@rntu.ac.in', 'registrar', 'ADMIN');
  const ramesh = await addUser('Ramesh Chauhan', 'SEC0088', 'security@rntu.ac.in', 'security', 'ADMIN');
  const neha = await addUser('Neha Kapoor', 'EMP0001', 'admin@rntu.ac.in', 'admin', 'ADMIN');

  await conn.query(`UPDATE departments SET hod_id = ? WHERE id = ?`, [meera, deptId.CSE]);
  await conn.query(`UPDATE departments SET hod_id = ? WHERE id = ?`, [ashok, deptId.MECH]);
  await conn.query(`UPDATE departments SET hod_id = ? WHERE id = ?`, [sunita, deptId.ECE]);

  console.log('Creating sample gate passes...');
  async function addPass(passCode, facultyId, deptKey, purpose, date, outTime, expectedReturn, status, history) {
    const submittedAt = history[0]?.date || null;
    await conn.query(
      `INSERT INTO gate_passes (pass_code, faculty_id, department_id, purpose, pass_date, out_time, expected_return, status, created_at)
       VALUES (?,?,?,?,?,?,?,?, COALESCE(?, NOW()))`,
      [passCode, facultyId, deptId[deptKey], purpose, date, outTime, expectedReturn, status, submittedAt]
    );
    const [[row]] = await conn.query(`SELECT id FROM gate_passes WHERE pass_code = ?`, [passCode]);
    for (const h of history) {
      await conn.query(
        `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks, created_at)
         VALUES (?,?,?,?,?,?)`,
        [row.id, h.by, h.role, h.decision, h.remarks || null, h.date]
      );
    }
    return row.id;
  }

  await addPass('GP-1001', rajesh, 'CSE', 'Bank Work', '2026-07-02', '11:00 AM', '2:00 PM', 'Pending Registrar', [
    { by: rajesh, role: 'Faculty', decision: 'Submitted', date: '2026-07-02 09:12:00' },
    { by: meera, role: 'HOD', decision: 'Approved', remarks: 'Approved for bank work.', date: '2026-07-02 09:40:00' },
  ]);

  await addPass('GP-1000', rajesh, 'CSE', 'Medical Appointment', '2026-07-01', '10:30 AM', '12:30 PM', 'Pending HOD', [
    { by: rajesh, role: 'Faculty', decision: 'Submitted', date: '2026-07-01 08:55:00' },
  ]);

  await addPass('GP-0998', priya, 'CSE', 'Conference Travel', '2026-06-29', '8:00 AM', '6:00 PM', 'Pending Registrar', [
    { by: priya, role: 'Faculty', decision: 'Submitted', date: '2026-06-29 07:40:00' },
    { by: meera, role: 'HOD', decision: 'Approved', date: '2026-06-29 07:58:00' },
  ]);

  await addPass('GP-0990', kavita, 'ECE', 'Vendor Meeting', '2026-06-25', '9:00 AM', '11:00 AM', 'Rejected', [
    { by: kavita, role: 'Faculty', decision: 'Submitted', date: '2026-06-25 08:20:00' },
    { by: sunita, role: 'HOD', decision: 'Rejected', remarks: 'Clashes with scheduled lab session.', date: '2026-06-25 08:35:00' },
  ]);

  await addPass('GP-0985', sameer, 'MECH', 'Vendor Site Visit', '2026-07-02', '1:00 PM', '4:00 PM', 'Approved', [
    { by: sameer, role: 'Faculty', decision: 'Submitted', date: '2026-07-02 07:30:00' },
    { by: ashok, role: 'HOD', decision: 'Approved', date: '2026-07-02 07:45:00' },
    { by: sharma, role: 'Registrar', decision: 'Approved', remarks: 'QR pass generated.', date: '2026-07-02 08:00:00' },
  ]);

  await addPass('GP-0970', sameer, 'MECH', 'Personal Work', '2026-06-27', '1:00 PM', '3:00 PM', 'Completed', [
    { by: sameer, role: 'Faculty', decision: 'Submitted', date: '2026-06-27 12:30:00' },
    { by: ashok, role: 'HOD', decision: 'Approved', date: '2026-06-27 12:40:00' },
    { by: sharma, role: 'Registrar', decision: 'Approved', date: '2026-06-27 12:45:00' },
    { by: ramesh, role: 'Security', decision: 'Exit Recorded', date: '2026-06-27 13:05:00' },
    { by: ramesh, role: 'Security', decision: 'Entry Recorded', date: '2026-06-27 14:50:00' },
  ]);
  await conn.query(
    `UPDATE gate_passes SET actual_exit = '2026-06-27 13:05:00', actual_return = '2026-06-27 14:50:00' WHERE pass_code = 'GP-0970'`
  );

  console.log('Done. Demo login credentials (all use the same password):');
  console.table([
    { role: 'faculty', email: 'shobhnath.shukla.au250505@rntu.ac.in' },
    { role: 'hod (CSE)', email: 'meera.iyer@rntu.ac.in' },
    { role: 'dean (CSE)', email: 'dean.cse@rntu.ac.in' },
    { role: 'registrar', email: 'registrar@rntu.ac.in' },
    { role: 'security', email: 'security@rntu.ac.in' },
    { role: 'admin', email: 'admin@rntu.ac.in' },
  ]);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);

  await conn.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
notify(
  process.env.EMAIL_USER,
  'ExitLine Test Email',
  '<h3>ExitLine email service is working ✅</h3><p>Your SMTP configuration is correct.</p>'
)
.then(() => console.log('Test email sent successfully'))
.catch(err => console.error('Email test failed:', err));