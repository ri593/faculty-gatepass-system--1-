USE gatepass;

ALTER TABLE users
  MODIFY role ENUM('faculty','hod','dean','student','registrar','security','admin') NOT NULL;

ALTER TABLE departments
  MODIFY department_name VARCHAR(255) NOT NULL;

ALTER TABLE gate_passes
  MODIFY status ENUM('Pending HOD','Pending Dean','Pending Registrar','Approved','Rejected','Completed')
  NOT NULL DEFAULT 'Pending HOD';
