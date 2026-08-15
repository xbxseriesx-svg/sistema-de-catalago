CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, product_id TEXT, kind TEXT NOT NULL, storage_kind TEXT NOT NULL DEFAULT 'external' CHECK (storage_kind = 'external'), url TEXT NOT NULL, alt_text TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_media_product ON media_assets(product_id, sort_order);

CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', starts_at TEXT, ends_at TEXT, banner_url TEXT, cta TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), featured INTEGER NOT NULL DEFAULT 0, data_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS promotion_products (promotion_id TEXT NOT NULL, product_id TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(promotion_id, product_id));

CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, kind TEXT NOT NULL, filename TEXT NOT NULL, status TEXT NOT NULL, total_rows INTEGER NOT NULL DEFAULT 0, inserted_rows INTEGER NOT NULL DEFAULT 0, updated_rows INTEGER NOT NULL DEFAULT 0, ignored_rows INTEGER NOT NULL DEFAULT 0, error_rows INTEGER NOT NULL DEFAULT 0, summary_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT);

CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details_json TEXT NOT NULL DEFAULT '{}', ip_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_audit_company_time ON audit_logs(company_id, created_at DESC);
