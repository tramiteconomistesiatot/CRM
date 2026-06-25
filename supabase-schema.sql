-- ============================================================
-- TRÀMIT ECONOMISTES — Esquema Supabase inicial (Fase 0 + 1)
-- Executar aquest SQL al SQL Editor de Supabase
-- ============================================================

-- Extensió per a UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TAULA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'worker')),
  phone       TEXT,
  language    TEXT NOT NULL DEFAULT 'ca' CHECK (language IN ('ca', 'es')),
  telegram_chat_id TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índexs
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles(active);

-- Trigger per actualitzar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger per crear perfil automàticament quan es registra un usuari
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nou usuari'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris veuen el seu propi perfil" ON public.profiles;
CREATE POLICY "Usuaris veuen el seu propi perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins veuen tots els perfils" ON public.profiles;
CREATE POLICY "Admins veuen tots els perfils"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Usuaris editen el seu propi perfil" ON public.profiles;
CREATE POLICY "Usuaris editen el seu propi perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins editen tots els perfils" ON public.profiles;
CREATE POLICY "Admins editen tots els perfils"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: roles_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles_permissions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'worker')),
  permission  TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (role, permission)
);

-- RLS roles_permissions
ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionen permisos" ON public.roles_permissions;
CREATE POLICY "Admins gestionen permisos"
  ON public.roles_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Permisos inicials
INSERT INTO public.roles_permissions (role, permission, enabled) VALUES
  ('admin',      'manage_users',         TRUE),
  ('admin',      'manage_vacations',     TRUE),
  ('admin',      'manage_absences',      TRUE),
  ('admin',      'view_sick_leave',      TRUE),
  ('admin',      'manage_appointments',  TRUE),
  ('admin',      'manage_clients',       TRUE),
  ('admin',      'manage_documents',     TRUE),
  ('admin',      'view_reports',         TRUE),
  ('admin',      'manage_settings',      TRUE),
  ('admin',      'view_audit_logs',      TRUE),
  ('admin',      'force_overlaps',       TRUE),
  ('supervisor', 'view_vacations',       TRUE),
  ('supervisor', 'view_appointments',    TRUE),
  ('supervisor', 'view_reports',         TRUE),
  ('worker',     'request_vacations',    TRUE),
  ('worker',     'view_own_absences',    TRUE),
  ('worker',     'view_agenda',          TRUE),
  ('worker',     'request_appointments', TRUE)
ON CONFLICT (role, permission) DO NOTHING;


-- ============================================================
-- TAULA: vacation_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vacation_balances (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year                  INTEGER NOT NULL,
  total_days            INTEGER NOT NULL DEFAULT 23,
  used_days             INTEGER NOT NULL DEFAULT 0,
  pending_days          INTEGER NOT NULL DEFAULT 0,
  remaining_days        INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
  carry_over_days       INTEGER NOT NULL DEFAULT 0,
  carry_over_expires_at DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year)
);

CREATE INDEX IF NOT EXISTS vacation_balances_user_year_idx ON public.vacation_balances(user_id, year);

DROP TRIGGER IF EXISTS vacation_balances_updated_at ON public.vacation_balances;
CREATE TRIGGER vacation_balances_updated_at
  BEFORE UPDATE ON public.vacation_balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS vacation_balances
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Treballadors veuen el seu saldo" ON public.vacation_balances;
CREATE POLICY "Treballadors veuen el seu saldo"
  ON public.vacation_balances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins veuen tots els saldos" ON public.vacation_balances;
CREATE POLICY "Admins veuen tots els saldos"
  ON public.vacation_balances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );


-- ============================================================
-- TAULA: absence_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.absence_requests (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('vacation', 'sick_leave', 'permission', 'other')),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  working_days     INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes            TEXT,
  admin_note       TEXT,
  deducts_vacation BOOLEAN,
  approved_by      UUID REFERENCES public.profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS absence_requests_user_idx ON public.absence_requests(user_id);
CREATE INDEX IF NOT EXISTS absence_requests_status_idx ON public.absence_requests(status);
CREATE INDEX IF NOT EXISTS absence_requests_dates_idx ON public.absence_requests(start_date, end_date);

DROP TRIGGER IF EXISTS absence_requests_updated_at ON public.absence_requests;
CREATE TRIGGER absence_requests_updated_at
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS absence_requests
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;

-- Treballadors veuen les seves pròpies (excepte baixes mèdiques d'altres)
DROP POLICY IF EXISTS "Treballadors veuen les seves absències" ON public.absence_requests;
CREATE POLICY "Treballadors veuen les seves absències"
  ON public.absence_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins veuen totes
DROP POLICY IF EXISTS "Admins veuen totes les absències" ON public.absence_requests;
CREATE POLICY "Admins veuen totes les absències"
  ON public.absence_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

-- Treballadors poden crear les seves pròpies
DROP POLICY IF EXISTS "Treballadors creen les seves absències" ON public.absence_requests;
CREATE POLICY "Treballadors creen les seves absències"
  ON public.absence_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Treballadors poden cancel·lar les seves pròpies pendents
DROP POLICY IF EXISTS "Treballadors cancel·len les seves pendents" ON public.absence_requests;
CREATE POLICY "Treballadors cancel·len les seves pendents"
  ON public.absence_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');


-- ============================================================
-- TAULA: holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date          DATE NOT NULL,
  name          TEXT NOT NULL,
  calendar_type TEXT NOT NULL DEFAULT 'local',
  year          INTEGER NOT NULL,
  UNIQUE (date, calendar_type)
);

-- RLS holidays (lectura pública per a usuaris autenticats)
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris autenticats veuen festius" ON public.holidays;
CREATE POLICY "Usuaris autenticats veuen festius"
  ON public.holidays FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen festius" ON public.holidays;
CREATE POLICY "Admins gestionen festius"
  ON public.holidays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Festius 2026 (Sant Feliu de Guíxols / Girona / Catalunya)
INSERT INTO public.holidays (date, name, calendar_type, year) VALUES
  ('2026-02-13', 'Carnestoltes',                 'local',    2026),
  ('2026-04-03', 'Divendres Sant',                'nacional', 2026),
  ('2026-04-06', 'Dilluns de Pasqua',             'nacional', 2026),
  ('2026-05-01', 'Festa del Treball',             'nacional', 2026),
  ('2026-06-24', 'Sant Joan',                     'nacional', 2026),
  ('2026-09-11', 'Diada Nacional de Catalunya',   'nacional', 2026),
  ('2026-10-12', 'Festa Nacional d''Espanya',     'nacional', 2026),
  ('2026-12-08', 'Immaculada Concepció',          'nacional', 2026),
  ('2026-12-25', 'Nadal',                         'nacional', 2026)
ON CONFLICT (date, calendar_type) DO NOTHING;


-- ============================================================
-- TAULA: company_closures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_closures (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date              DATE NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  year              INTEGER NOT NULL,
  deducts_vacation  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS company_closures_year_idx ON public.company_closures(year);

-- RLS company_closures
ALTER TABLE public.company_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris veuen tancaments" ON public.company_closures;
CREATE POLICY "Usuaris veuen tancaments"
  ON public.company_closures FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen tancaments" ON public.company_closures;
CREATE POLICY "Admins gestionen tancaments"
  ON public.company_closures FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Tancaments 2026
INSERT INTO public.company_closures (date, name, year, deducts_vacation) VALUES
  ('2026-08-03', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-04', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-05', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-06', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-07', 'Tancament d''estiu',   2026, FALSE),
  ('2026-12-07', 'Tancament de Nadal',   2026, FALSE),
  ('2026-12-24', 'Tancament de Nadal',   2026, FALSE),
  ('2026-12-31', 'Tancament de Nadal',   2026, FALSE)
ON CONFLICT (date) DO NOTHING;

-- Tancaments 2027
INSERT INTO public.company_closures (date, name, year, deducts_vacation) VALUES
  ('2027-01-04', 'Tancament de Cap d''Any', 2027, FALSE),
  ('2027-01-05', 'Tancament de Cap d''Any', 2027, FALSE)
ON CONFLICT (date) DO NOTHING;


-- ============================================================
-- TAULA: critical_periods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.critical_periods (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  year        INTEGER NOT NULL,
  description TEXT,
  CHECK (end_date >= start_date)
);

-- RLS critical_periods
ALTER TABLE public.critical_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris veuen períodes crítics" ON public.critical_periods;
CREATE POLICY "Usuaris veuen períodes crítics"
  ON public.critical_periods FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen períodes crítics" ON public.critical_periods;
CREATE POLICY "Admins gestionen períodes crítics"
  ON public.critical_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  client_id             UUID,
  main_attendee_id      UUID NOT NULL REFERENCES public.profiles(id),
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ NOT NULL,
  topic                 TEXT NOT NULL CHECK (topic IN ('fiscal','labor','accounting','income_tax','freelance','companies','internal_meeting','client_query','documentation','other')),
  channel               TEXT NOT NULL CHECK (channel IN ('in_person','phone','video','email','other')),
  priority              TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent','other')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','cancelled','completed','rescheduled')),
  location              TEXT,
  meet_link             TEXT,
  internal_notes        TEXT,
  send_email_to_client  BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id       TEXT,
  expedient_ref         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS appointments_start_time_idx ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS appointments_main_attendee_idx ON public.appointments(main_attendee_id);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS appointments_created_by_idx ON public.appointments(created_by);

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants veuen les seves cites" ON public.appointments;
CREATE POLICY "Participants veuen les seves cites"
  ON public.appointments FOR SELECT
  USING (
    auth.uid() = created_by OR
    auth.uid() = main_attendee_id OR
    EXISTS (
      SELECT 1 FROM public.appointment_attendees aa
      WHERE aa.appointment_id = id AND aa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins gestionen totes les cites" ON public.appointments;
CREATE POLICY "Admins gestionen totes les cites"
  ON public.appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Treballadors creen cites" ON public.appointments;
CREATE POLICY "Treballadors creen cites"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = created_by);


-- ============================================================
-- TAULA: appointment_attendees
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_attendees (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id    UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.profiles(id),
  external_email    TEXT,
  external_name     TEXT,
  is_main           BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','proposed_new_time')),
  token             TEXT UNIQUE,
  token_expires_at  TIMESTAMPTZ,
  proposed_time     TIMESTAMPTZ,
  CHECK (user_id IS NOT NULL OR external_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS appointment_attendees_appointment_idx ON public.appointment_attendees(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_attendees_user_idx ON public.appointment_attendees(user_id);
CREATE INDEX IF NOT EXISTS appointment_attendees_token_idx ON public.appointment_attendees(token);

-- RLS appointment_attendees
ALTER TABLE public.appointment_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants veuen assistents de les seves cites" ON public.appointment_attendees;
CREATE POLICY "Participants veuen assistents de les seves cites"
  ON public.appointment_attendees FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND (a.created_by = auth.uid() OR a.main_attendee_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins gestionen tots els assistents" ON public.appointment_attendees;
CREATE POLICY "Admins gestionen tots els assistents"
  ON public.appointment_attendees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );


-- ============================================================
-- TAULA: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  email           TEXT,
  nif_cif         TEXT,
  notes           TEXT,
  responsible_id  UUID REFERENCES public.profiles(id),
  origin          TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('appointment','manual','other')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients(email);
CREATE INDEX IF NOT EXISTS clients_nif_cif_idx ON public.clients(nif_cif);
CREATE INDEX IF NOT EXISTS clients_name_idx ON public.clients(name);

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Treballadors veuen clients" ON public.clients;
CREATE POLICY "Treballadors veuen clients"
  ON public.clients FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen clients" ON public.clients;
CREATE POLICY "Admins gestionen clients"
  ON public.clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Treballadors creen clients" ON public.clients;
CREATE POLICY "Treballadors creen clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- TAULA: client_exports_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_exports_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  exported_by UUID NOT NULL REFERENCES public.profiles(id),
  export_type TEXT NOT NULL DEFAULT 'sheets',
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.client_exports_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veuen exports" ON public.client_exports_log;
CREATE POLICY "Admins veuen exports"
  ON public.client_exports_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.files (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  drive_url       TEXT NOT NULL,
  drive_file_id   TEXT NOT NULL UNIQUE,
  client_id       UUID REFERENCES public.clients(id),
  appointment_id  UUID REFERENCES public.appointments(id),
  uploaded_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS files_client_idx ON public.files(client_id);
CREATE INDEX IF NOT EXISTS files_appointment_idx ON public.files(appointment_id);

-- RLS files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants veuen fitxers" ON public.files;
CREATE POLICY "Participants veuen fitxers"
  ON public.files FOR SELECT
  USING (
    auth.uid() = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND (a.created_by = auth.uid() OR a.main_attendee_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins gestionen fitxers" ON public.files;
CREATE POLICY "Admins gestionen fitxers"
  ON public.files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, read);

-- RLS notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris veuen les seves notificacions" ON public.notifications;
CREATE POLICY "Usuaris veuen les seves notificacions"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins gestionen notificacions" ON public.notifications;
CREATE POLICY "Admins gestionen notificacions"
  ON public.notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: daily_summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE NOT NULL UNIQUE,
  content     TEXT NOT NULL,
  sent_at     TIMESTAMPTZ,
  sent_to     TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veuen resums" ON public.daily_summaries;
CREATE POLICY "Admins veuen resums"
  ON public.daily_summaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- TAULA: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);

-- RLS audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veuen auditoria" ON public.audit_logs;
CREATE POLICY "Admins veuen auditoria"
  ON public.audit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Funció helper per registrar auditoria
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   TEXT,
  p_old_values  JSONB DEFAULT NULL,
  p_new_values  JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- TAULA: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key           TEXT NOT NULL UNIQUE,
  value         TEXT NOT NULL,
  description   TEXT,
  updated_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionen configuració" ON public.settings;
CREATE POLICY "Admins gestionen configuració"
  ON public.settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Configuració inicial
INSERT INTO public.settings (key, value, description) VALUES
  ('max_simultaneous_vacations_2026', '3',    'Màxim treballadors de vacances simultàniament el 2026'),
  ('max_simultaneous_vacations_default', '2', 'Màxim treballadors de vacances simultàniament des de 2027'),
  ('default_vacation_days', '23',             'Dies de vacances per defecte per treballador des de 2027'),
  ('carry_over_deadline', '15',               'Dia del mes de gener fins quan es poden arrossegar vacances'),
  ('working_hours_start', '08:00',            'Hora d''inici de la jornada laboral'),
  ('working_hours_end', '17:00',              'Hora de fi de la jornada laboral'),
  ('daily_summary_time', '07:00',             'Hora d''enviament del resum diari'),
  ('weekly_summary_day', '1',                 'Dia de la setmana del resum setmanal (1=dilluns)'),
  ('app_language', 'ca',                      'Idioma per defecte de l''aplicació')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- VISTES útils
-- ============================================================

-- Vista: absències actives avui (sense motiu per a treballadors)
CREATE OR REPLACE VIEW public.active_absences_today AS
SELECT
  ar.id,
  ar.user_id,
  ar.type,
  ar.start_date,
  ar.end_date,
  ar.status,
  p.full_name,
  CASE
    WHEN ar.type = 'vacation' THEN 'Vacances'
    ELSE 'No disponible'
  END AS display_label
FROM public.absence_requests ar
JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.status = 'approved'
  AND ar.start_date <= CURRENT_DATE
  AND ar.end_date >= CURRENT_DATE;

-- Vista: saldos amb nom de treballador
CREATE OR REPLACE VIEW public.vacation_balances_with_profile AS
SELECT
  vb.*,
  p.full_name,
  p.email,
  p.role
FROM public.vacation_balances vb
JOIN public.profiles p ON p.id = vb.user_id;
