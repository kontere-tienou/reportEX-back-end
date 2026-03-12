-- ============================================
-- BATEX ERP - INITIALISATION DE LA BASE DE DONNÉES
-- ============================================

-- Supprimer les tables si elles existent (optionnel)
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================
-- 1. Création des tables (dans le bon ordre)
-- ============================================

-- Table: roles (doit être créée en premier car users en dépend)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(50),
  description TEXT,
  manager_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Table: users (dépend de roles et departments)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  department_id INTEGER REFERENCES departments(id),
  phone VARCHAR(50),
  avatar VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (role) REFERENCES roles(code)
);
-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
-- ============================================
-- 2. Insertion des données initiales
-- ============================================

-- Insertion des rôles (en premier car users en a besoin)
INSERT INTO roles (code, name, level, description) VALUES
  ('ADMIN', 'Administrateur', 10, 'Accès complet à toutes les fonctionnalités'),
  ('DG', 'Direction Générale', 9, 'Vision globale et validation des rapports'),
  ('MANAGER', 'Manager', 7, 'Gestion d''équipe et création de rapports'),
  ('SUPERVISOR', 'Superviseur', 5, 'Supervision des activités'),
  ('USER', 'Utilisateur', 3, 'Création de rapports de base'),
  ('VIEWER', 'Lecteur', 1, 'Consultation uniquement')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  description = EXCLUDED.description;

-- Insertion des départements
INSERT INTO departments (id, code, name, icon, color, description) VALUES
  (1, 'DG', 'Direction Générale', 'briefcase', 'red', 'Direction générale et stratégie'),
  (2, 'COMPTA', 'Comptabilité', 'calculator', 'green', 'Gestion comptable et financière'),
  (3, 'BUREAU_ETUDE', 'Bureau d''Étude', 'lightbulb', 'blue', 'Études et développement'),
  (4, 'MAINTENANCE', 'Maintenance', 'wrench', 'gray', 'Maintenance technique'),
  (5, 'FILATURE', 'Filature', 'package', 'purple', 'Production filature'),
  (6, 'IMPRESSION', 'Impression', 'printer', 'pink', 'Service impression'),
  (7, 'STOCK', 'Stock', 'archive', 'orange', 'Gestion des stocks'),
  (8, 'ACHAT', 'Achats', 'shopping-cart', 'amber', 'Achats et approvisionnements'),
  (9, 'COMMERCIAL', 'Commercial', 'trending-up', 'rose', 'Ventes et commercial'),
  (10, 'IT', 'Informatique', 'monitor', 'violet', 'Support informatique'),
  (11, 'RH', 'Ressources Humaines', 'users', 'cyan', 'Gestion des ressources humaines')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description = EXCLUDED.description;

-- Reset de la séquence
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

-- ============================================
-- 3. Création de l'utilisateur admin
-- ============================================
-- Le hash sera remplacé automatiquement par le script Node.js
INSERT INTO users (
  email, 
  password, 
  full_name, 
  role, 
  department_id,
  is_active
) VALUES (
  'admin@batex-ci.com',
  'Admin123',
  'Administrateur',
  'ADMIN',
  10,
  true
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 4. Création des index
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id);

-- ============================================
-- 5. Vérifications (MAINTENANT les tables existent !)
-- ============================================
SELECT '✅ Base de données initialisée avec succès!' as message;

-- Comptages
SELECT COUNT(*) as nombre_roles FROM roles;
SELECT COUNT(*) as nombre_departements FROM departments;
SELECT COUNT(*) as nombre_utilisateurs FROM users;

-- Détails
SELECT 'Rôles créés:' as info, code, name, level FROM roles ORDER BY level DESC;
SELECT 'Départements créés:' as info, code, name FROM departments ORDER BY id;
SELECT 'Utilisateur admin:' as info, email, full_name, role FROM users WHERE role = 'ADMIN';