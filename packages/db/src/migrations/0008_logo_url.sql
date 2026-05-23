-- 0008_logo_url — Add logo_url to tenants for salon branding + SEO
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
