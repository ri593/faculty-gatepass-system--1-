-- Faculty Gate Out Pass Management System
-- Database schema (MySQL 8+)

CREATE DATABASE IF NOT EXISTS gatepass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gatepass;

-- ============================================================
-- Departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(255) NOT NULL,
  dept_code     VARCHAR(20) NOT NULL UNIQUE,
  hod_id        INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Users  (faculty / hod / dean / student / registrar / security / admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  employee_id   VARCHAR(30) NOT NULL UNIQUE,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  department_id INT NULL,
  role          ENUM('faculty','hod','dean','student','registrar','security','admin') NOT NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

ALTER TABLE departments
  ADD CONSTRAINT fk_dept_hod FOREIGN KEY (hod_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- Gate Pass requests
-- ============================================================
CREATE TABLE IF NOT EXISTS gate_passes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pass_code       VARCHAR(20) NOT NULL UNIQUE,      -- e.g. GP-2031, used in QR payload
  faculty_id      INT NOT NULL,                  -- requester user id (faculty/hod/dean/student)
  department_id   INT NOT NULL,
  purpose         VARCHAR(255) NOT NULL,
  destination     VARCHAR(255),
  pass_date       DATE NOT NULL,
  out_time        VARCHAR(20) NOT NULL,
  expected_return VARCHAR(20) NOT NULL,
  actual_exit     DATETIME NULL,
  actual_return   DATETIME NULL,
  status          ENUM('Pending HOD','Pending Dean','Pending Registrar','Approved','Rejected','Completed')
                  NOT NULL DEFAULT 'Pending HOD',
  qr_code_path    VARCHAR(255) NULL,
  pdf_path        VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- ============================================================
-- Approval history (audit trail for every action on a pass)
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_history (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  gatepass_id   INT NOT NULL,
  approved_by   INT NOT NULL,
  role          VARCHAR(30) NOT NULL,
  decision      VARCHAR(40) NOT NULL,   -- Submitted / Approved / Rejected / Exit Recorded / Entry Recorded
  remarks       VARCHAR(500),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gatepass_id) REFERENCES gate_passes(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_gatepass_status ON gate_passes(status);
CREATE INDEX idx_gatepass_faculty ON gate_passes(faculty_id);
CREATE INDEX idx_gatepass_dept ON gate_passes(department_id);
CREATE INDEX idx_history_gatepass ON approval_history(gatepass_id);
