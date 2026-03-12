-- ============================================
-- BATEX ERP - INITIALISATION DE LA BASE DE DONNÉES
-- ============================================

-- Supprimer les tables si elles existent (optionnel)
DROP TABLE IF EXISTS report_comments CASCADE;
DROP TABLE IF EXISTS report_access_requests CASCADE;
DROP TABLE IF EXISTS validations CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS objectives CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS journal_lines CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS research_items CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS maintenance_interventions CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS quality_controls CASCADE;
DROP TABLE IF EXISTS print_orders CASCADE;
DROP TABLE IF EXISTS designs CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS po_lines CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS it_tickets CASCADE;
DROP TABLE IF EXISTS it_systems CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;


-- ============================================
-- 1. Création des tables (dans le bon ordre)
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'department', 'public')),
  status VARCHAR(20) DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'soumis', 'valide', 'rejete')),
  submitted_at TIMESTAMP,
  validated_by INTEGER REFERENCES users(id),
  validated_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_department ON reports(department_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_period ON reports(period_start, period_end);

CREATE TABLE IF NOT EXISTS report_access_requests (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_requests_report ON report_access_requests(report_id);
CREATE INDEX idx_access_requests_requester ON report_access_requests(requester_id);
CREATE INDEX idx_access_requests_status ON report_access_requests(status);

CREATE TABLE IF NOT EXISTS report_comments (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  parent_id INTEGER REFERENCES report_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_report ON report_comments(report_id);
CREATE INDEX idx_comments_user ON report_comments(user_id);

CREATE TABLE IF NOT EXISTS validations (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  validator_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('valide', 'rejete')),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_validations_report ON validations(report_id);

-- ==========================================
-- SECTION 3: DIRECTION (Dept 1)
-- ==========================================

CREATE TABLE IF NOT EXISTS objectives (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_value DECIMAL(15,2),
  current_value DECIMAL(15,2) DEFAULT 0,
  unit VARCHAR(50),
  department_id INTEGER REFERENCES departments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'cancelled', 'delayed')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_objectives_department ON objectives(department_id);
CREATE INDEX idx_objectives_status ON objectives(status);

-- ==========================================
-- SECTION 4: COMPTABILITÉ (Dept 2)
-- ==========================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  account_code VARCHAR(20) UNIQUE NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('actif', 'passif', 'produit', 'charge', 'resultat')),
  parent_code VARCHAR(20),
  level INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chart_code ON chart_of_accounts(account_code);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  journal_type VARCHAR(50) NOT NULL CHECK (journal_type IN ('vente', 'achat', 'banque', 'caisse', 'od')),
  description TEXT,
  total_debit DECIMAL(15,2) NOT NULL CHECK (total_debit >= 0),
  total_credit DECIMAL(15,2) NOT NULL CHECK (total_credit >= 0),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_by INTEGER REFERENCES users(id),
  posted_at TIMESTAMP,
  fiscal_year INTEGER NOT NULL,
  fiscal_period INTEGER NOT NULL CHECK (fiscal_period BETWEEN 1 AND 12),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT balanced_entry CHECK (total_debit = total_credit)
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_number ON journal_entries(entry_number);

CREATE TABLE IF NOT EXISTS journal_lines (
  id SERIAL PRIMARY KEY,
  journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  cost_center VARCHAR(50),
  line_number INTEGER,
  CONSTRAINT debit_or_credit CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  department_id INTEGER REFERENCES departments(id),
  fiscal_year INTEGER NOT NULL,
  budget_type VARCHAR(50) NOT NULL CHECK (budget_type IN ('operational', 'capital', 'project')),
  account_code VARCHAR(20),
  account_name VARCHAR(200),
  budgeted_amount DECIMAL(15,2) NOT NULL CHECK (budgeted_amount >= 0),
  actual_amount DECIMAL(15,2) DEFAULT 0,
  variance DECIMAL(15,2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'locked')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budgets_department ON budgets(department_id);
CREATE INDEX idx_budgets_fiscal_year ON budgets(fiscal_year);

-- ==========================================
-- SECTION 5: BUREAU D'ÉTUDE (Dept 3)
-- ==========================================

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15,2),
  actual_cost DECIMAL(15,2) DEFAULT 0,
  project_manager_id INTEGER REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_code ON projects(project_code);
CREATE INDEX idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS research_items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  research_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
  priority VARCHAR(20) DEFAULT 'normal',
  researcher_id INTEGER REFERENCES users(id),
  start_date DATE,
  completion_date DATE,
  findings TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_research_status ON research_items(status);

-- ==========================================
-- SECTION 6: MAINTENANCE (Dept 4)
-- ==========================================

CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  machine_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  purchase_date DATE,
  status VARCHAR(20) DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'breakdown', 'retired')),
  location VARCHAR(100),
  last_maintenance DATE,
  next_maintenance DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_machines_code ON machines(machine_code);
CREATE INDEX idx_machines_status ON machines(status);

CREATE TABLE IF NOT EXISTS maintenance_interventions (
  id SERIAL PRIMARY KEY,
  intervention_number VARCHAR(50) UNIQUE NOT NULL,
  machine_id INTEGER REFERENCES machines(id),
  intervention_date DATE NOT NULL,
  intervention_type VARCHAR(20) CHECK (intervention_type IN ('preventive', 'curative', 'predictive')),
  description TEXT NOT NULL,
  technician_id INTEGER REFERENCES users(id),
  duration_hours DECIMAL(5,2),
  cost DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interventions_machine ON maintenance_interventions(machine_id);
CREATE INDEX idx_interventions_status ON maintenance_interventions(status);

-- ==========================================
-- SECTION 7: FILATURE/PRODUCTION (Dept 5)
-- ==========================================

CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  order_date DATE NOT NULL,
  product_type VARCHAR(50),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_of_measure VARCHAR(20),
  specifications JSONB,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'normal',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_production_orders_number ON production_orders(order_number);
CREATE INDEX idx_production_orders_status ON production_orders(status);

CREATE TABLE IF NOT EXISTS quality_controls (
  id SERIAL PRIMARY KEY,
  control_number VARCHAR(50) UNIQUE NOT NULL,
  production_order_id INTEGER REFERENCES production_orders(id),
  control_date DATE NOT NULL,
  inspector_id INTEGER REFERENCES users(id),
  control_type VARCHAR(50),
  sample_size INTEGER,
  defects_found INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'passed' CHECK (status IN ('passed', 'failed', 'pending')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_controls_production ON quality_controls(production_order_id);
CREATE INDEX idx_quality_controls_status ON quality_controls(status);

-- ==========================================
-- SECTION 8: IMPRESSION (Dept 6)
-- ==========================================

CREATE TABLE IF NOT EXISTS print_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255),
  order_date DATE NOT NULL,
  delivery_date DATE,
  design_file VARCHAR(255),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  motif VARCHAR(200),
  color_scheme VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'printing', 'completed', 'cancelled')),
  total_amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_print_orders_number ON print_orders(order_number);
CREATE INDEX idx_print_orders_status ON print_orders(status);

CREATE TABLE IF NOT EXISTS designs (
  id SERIAL PRIMARY KEY,
  design_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  designer_id INTEGER REFERENCES users(id),
  design_file VARCHAR(255),
  thumbnail VARCHAR(255),
  category VARCHAR(100),
  colors_used JSONB,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_designs_code ON designs(design_code);
CREATE INDEX idx_designs_status ON designs(status);

-- ==========================================
-- SECTION 9: STOCK (Dept 7)
-- ==========================================

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit_of_measure VARCHAR(20),
  quantity_in_stock DECIMAL(10,2) DEFAULT 0 CHECK (quantity_in_stock >= 0),
  minimum_quantity DECIMAL(10,2) DEFAULT 0,
  unit_cost DECIMAL(15,2),
  location VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_items_code ON stock_items(item_code);
CREATE INDEX idx_stock_items_category ON stock_items(category);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  movement_date DATE NOT NULL,
  movement_number VARCHAR(50) UNIQUE NOT NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('entree', 'sortie', 'transfert', 'ajustement', 'retour')),
  item_id INTEGER REFERENCES stock_items(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(15,2),
  reference_type VARCHAR(50),
  reference_id INTEGER,
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);

-- ==========================================
-- SECTION 10: ACHATS (Dept 8)
-- ==========================================

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  supplier_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(50),
  payment_terms VARCHAR(100),
  bank_account VARCHAR(100),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_code ON suppliers(supplier_code);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  order_date DATE NOT NULL,
  delivery_date DATE,
  delivery_address TEXT,
  subtotal DECIMAL(15,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  payment_terms VARCHAR(100),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);

CREATE TABLE IF NOT EXISTS po_lines (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  line_number INTEGER
);

CREATE INDEX idx_po_lines_po ON po_lines(po_id);

-- ==========================================
-- SECTION 11: COMMERCIAL (Dept 9)
-- ==========================================

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  client_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(50),
  payment_terms VARCHAR(100),
  credit_limit DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_code ON clients(client_code);
CREATE INDEX idx_clients_active ON clients(is_active);

CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  order_date DATE NOT NULL,
  delivery_date DATE,
  subtotal DECIMAL(15,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'shipped', 'delivered')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_client ON sales_orders(client_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(payment_status);

-- ==========================================
-- SECTION 12: INFORMATIQUE (Dept 10)
-- ==========================================

CREATE TABLE IF NOT EXISTS it_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) CHECK (category IN ('hardware', 'software', 'network', 'access', 'other')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'reopened')),
  reported_by INTEGER REFERENCES users(id),
  assigned_to INTEGER REFERENCES users(id),
  reported_date TIMESTAMP NOT NULL,
  resolved_date TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_it_tickets_number ON it_tickets(ticket_number);
CREATE INDEX idx_it_tickets_status ON it_tickets(status);
CREATE INDEX idx_it_tickets_reported_by ON it_tickets(reported_by);

CREATE TABLE IF NOT EXISTS it_systems (
  id SERIAL PRIMARY KEY,
  system_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  system_type VARCHAR(50),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  ip_address VARCHAR(50),
  location VARCHAR(100),
  responsible_id INTEGER REFERENCES users(id),
  last_maintenance DATE,
  next_maintenance DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_it_systems_code ON it_systems(system_code);
CREATE INDEX idx_it_systems_status ON it_systems(status);

-- ==========================================
-- SECTION 13: RH (Dept 11)
-- ==========================================

-- ==========================================
-- SECTION 14: TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON objectives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SECTION 15: VIEWS
-- ==========================================

CREATE OR REPLACE VIEW v_users_by_department AS
SELECT 
  d.id as department_id,
  d.name as department_name,
  d.code as department_code,
  COUNT(u.id) as user_count,
  COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_users
FROM departments d
LEFT JOIN users u ON d.id = u.department_id
GROUP BY d.id, d.name, d.code
ORDER BY user_count DESC;

CREATE OR REPLACE VIEW v_reports_summary AS
SELECT 
  r.id,
  r.period_start,
  r.period_end,
  r.status,
  r.visibility,
  u.full_name as author_name,
  d.name as department_name,
  r.created_at,
  (SELECT COUNT(*) FROM report_comments WHERE report_id = r.id) as comment_count,
  (SELECT COUNT(*) FROM report_access_requests WHERE report_id = r.id AND status = 'pending') as pending_requests
FROM reports r
JOIN users u ON r.user_id = u.id
JOIN departments d ON r.department_id = d.id
ORDER BY r.created_at DESC;

CREATE OR REPLACE VIEW v_stock_alerts AS
SELECT 
  s.item_code,
  s.name,
  s.category,
  s.quantity_in_stock,
  s.minimum_quantity,
  s.minimum_quantity - s.quantity_in_stock as shortage,
  s.location
FROM stock_items s
WHERE s.is_active = true 
AND s.quantity_in_stock < s.minimum_quantity
ORDER BY shortage DESC;


-- ============================================
-- 5. Vérifications (MAINTENANT les tables existent !)
-- ============================================
SELECT '✅ Base de données initialisée avec succès!' as message;