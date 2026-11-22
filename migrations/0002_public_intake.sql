CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments(updated_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(updated_at);
CREATE TABLE IF NOT EXISTS intake_limits (fingerprint TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
