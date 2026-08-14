-- ASTERYON Catálogo · finalização funcional v3
-- Perfis de marcas, marketing e mídia permanente no D1.

CREATE TABLE IF NOT EXISTS brand_profiles (
  brand_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  banner_url TEXT,
  website TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_company_order
  ON brand_profiles(company_id, sort_order, brand_id);

CREATE TABLE IF NOT EXISTS marketing_settings (
  company_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_objects (
  media_key TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  entity_key TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_dedup
  ON media_objects(company_id, kind, COALESCE(entity_key,''), sha256);
CREATE INDEX IF NOT EXISTS idx_media_entity
  ON media_objects(company_id, kind, entity_key, created_at DESC);

CREATE TABLE IF NOT EXISTS media_chunks (
  media_key TEXT NOT NULL,
  chunk_no INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY (media_key, chunk_no)
);
CREATE INDEX IF NOT EXISTS idx_media_chunks_key
  ON media_chunks(media_key, chunk_no);

CREATE INDEX IF NOT EXISTS idx_products_company_brand_status
  ON products(company_id, brand_id, status);
CREATE INDEX IF NOT EXISTS idx_products_company_category_status
  ON products(company_id, category_id, status);
CREATE INDEX IF NOT EXISTS idx_hierarchy_company_level_parent_status
  ON hierarchy_nodes(company_id, level, parent_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_promotions_company_status_dates
  ON promotions(company_id, status, starts_at, ends_at, featured);
