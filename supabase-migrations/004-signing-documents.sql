-- ============================================================
-- MIGRACIÓ: signing_documents
-- Mòdul de firma digital per a Tràmit Economistes
-- ============================================================

-- Bucket de Supabase Storage per a documents de firma (privat)
-- Crear manualment des del dashboard si no existeix: "signing-documents"

-- Taula principal de documents a firmar
CREATE TABLE IF NOT EXISTS signing_documents (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name         TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  file_hash         TEXT NOT NULL,             -- SHA-256 del PDF original
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'signed', 'rejected', 'expired')),

  -- Relació amb client del CRM
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name       TEXT,
  client_email      TEXT,
  client_phone      TEXT,

  -- Qui ha pujat el document
  uploaded_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Yousign integration
  yousign_request_id TEXT,
  signed_file_url   TEXT,
  audit_pdf_url     TEXT,

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  sent_at           TIMESTAMPTZ,
  signed_at         TIMESTAMPTZ,
  notes             TEXT
);

-- Índexos per performance
CREATE INDEX IF NOT EXISTS idx_signing_documents_status
  ON signing_documents(status);

CREATE INDEX IF NOT EXISTS idx_signing_documents_client_id
  ON signing_documents(client_id);

CREATE INDEX IF NOT EXISTS idx_signing_documents_created_at
  ON signing_documents(created_at DESC);

-- RLS: habilitar
ALTER TABLE signing_documents ENABLE ROW LEVEL SECURITY;

-- Política: admins i supervisors poden veure tots els documents
CREATE POLICY "Admins can view all signing documents"
  ON signing_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
        AND profiles.active = true
    )
  );

-- Política: admins poden inserir
CREATE POLICY "Admins can insert signing documents"
  ON signing_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
        AND profiles.active = true
    )
  );

-- Política: admins poden actualitzar
CREATE POLICY "Admins can update signing documents"
  ON signing_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
        AND profiles.active = true
    )
  );

-- Nota: els workers NO poden veure documents de firma (dades privades de clients)
