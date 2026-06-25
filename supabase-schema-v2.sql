-- ============================================================
-- TRÀMIT ECONOMISTES — Schema v2 (COMPLET I CORREGIT)
-- Executar al SQL Editor de Supabase (substitueix l'anterior)
-- ============================================================

-- RESET DELS COPS ANTERIORS PER EVITAR COLUMNS FALTANTS (com is_critical o color)
DROP VIEW IF EXISTS public.vacation_balances_with_profile CASCADE;
DROP VIEW IF EXISTS public.active_absences_today CASCADE;

DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.fiscal_deadlines CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.appointment_attendees CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.client_exports_log CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.critical_periods CASCADE;
DROP TABLE IF EXISTS public.company_closures CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.absence_requests CASCADE;
DROP TABLE IF EXISTS public.vacation_balances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Extensió per a UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FUNCIÓ: handle_updated_at (compartida)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TAULA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'worker')),
  phone             TEXT,
  language          TEXT NOT NULL DEFAULT 'ca' CHECK (language IN ('ca', 'es')),
  telegram_chat_id  TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url        TEXT,
  color             TEXT DEFAULT '#3B82F6',
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles(active);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: crear perfil automàticament quan es registra un usuari
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
    '#3B82F6'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Funcions de seguretat definer per evitar bucle infinit RLS (infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('admin', 'supervisor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Usuaris veuen el seu propi perfil" ON public.profiles;
CREATE POLICY "Usuaris veuen el seu propi perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins i supervisors veuen tots els perfils" ON public.profiles;
CREATE POLICY "Admins i supervisors veuen tots els perfils"
  ON public.profiles FOR SELECT
  USING (public.is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Usuaris editen el seu propi perfil" ON public.profiles;
CREATE POLICY "Usuaris editen el seu propi perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins gestionen tots els perfils" ON public.profiles;
CREATE POLICY "Admins gestionen tots els perfils"
  ON public.profiles FOR ALL
  USING (public.is_admin(auth.uid()));



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
  deducts_vacation BOOLEAN DEFAULT TRUE,
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

ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Treballadors veuen les seves absències" ON public.absence_requests;
CREATE POLICY "Treballadors veuen les seves absències"
  ON public.absence_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins veuen totes les absències" ON public.absence_requests;
CREATE POLICY "Admins veuen totes les absències"
  ON public.absence_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Treballadors creen les seves absències" ON public.absence_requests;
CREATE POLICY "Treballadors creen les seves absències"
  ON public.absence_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

INSERT INTO public.company_closures (date, name, year, deducts_vacation) VALUES
  ('2026-08-03', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-04', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-05', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-06', 'Tancament d''estiu',   2026, FALSE),
  ('2026-08-07', 'Tancament d''estiu',   2026, FALSE),
  ('2026-12-07', 'Tancament de Nadal',   2026, FALSE),
  ('2026-12-24', 'Tancament de Nadal',   2026, FALSE),
  ('2026-12-31', 'Tancament de Nadal',   2026, FALSE),
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

-- Períodes crítics 2026 (Renda, Trimestrals, etc.)
INSERT INTO public.critical_periods (name, start_date, end_date, year, description) VALUES
  ('Renda i Patrimoni', '2026-04-02', '2026-06-30', 2026, 'Campanya de la Renda 2025'),
  ('Trimestral Q1',     '2026-04-01', '2026-04-20', 2026, 'Declaracions trimestrals 1r trimestre'),
  ('Trimestral Q2',     '2026-07-01', '2026-07-20', 2026, 'Declaracions trimestrals 2n trimestre'),
  ('Trimestral Q3',     '2026-10-01', '2026-10-20', 2026, 'Declaracions trimestrals 3r trimestre'),
  ('Tancament anual',   '2026-12-15', '2026-12-31', 2026, 'Tancament comptable i fiscal anual')
ON CONFLICT DO NOTHING;


-- ============================================================
-- TAULA: clients (AMPLIADA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT NOT NULL,
  company           TEXT,
  phone             TEXT,
  email             TEXT,
  nif_cif           TEXT,
  notes             TEXT,
  responsible_id    UUID REFERENCES public.profiles(id),
  origin            TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('appointment','manual','other')),
  -- Camps addicionals per a CRM
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect','lead','active','inactive','blocked')),
  client_type       TEXT NOT NULL DEFAULT 'particular' CHECK (client_type IN ('particular','autonomo','empresa','asociacion')),
  pipeline_stage    TEXT CHECK (pipeline_stage IN ('contact','proposal','negotiation','closed_won','closed_lost')),
  estimated_value   NUMERIC(10,2),
  last_contact_at   TIMESTAMPTZ,
  tags              TEXT[] DEFAULT '{}',
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  iae               TEXT,
  vat_regime        TEXT,
  legal_form        TEXT,
  -- Google integració
  drive_folder_id   TEXT,
  drive_folder_url  TEXT,
  sheets_row        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients(email);
CREATE INDEX IF NOT EXISTS clients_nif_cif_idx ON public.clients(nif_cif);
CREATE INDEX IF NOT EXISTS clients_name_idx ON public.clients(name);
CREATE INDEX IF NOT EXISTS clients_status_idx ON public.clients(status);
CREATE INDEX IF NOT EXISTS clients_responsible_idx ON public.clients(responsible_id);

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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

DROP POLICY IF EXISTS "Treballadors actualitzen clients" ON public.clients;
CREATE POLICY "Treballadors actualitzen clients"
  ON public.clients FOR UPDATE
  USING (auth.role() = 'authenticated');


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
-- TAULA: appointments (CITES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  client_id             UUID REFERENCES public.clients(id),
  main_attendee_id      UUID NOT NULL REFERENCES public.profiles(id),
  title                 TEXT,
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

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;


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
  token             TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  token_expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  proposed_time     TIMESTAMPTZ,
  CHECK (user_id IS NOT NULL OR external_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS appointment_attendees_appointment_idx ON public.appointment_attendees(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_attendees_user_idx ON public.appointment_attendees(user_id);
CREATE INDEX IF NOT EXISTS appointment_attendees_token_idx ON public.appointment_attendees(token);

ALTER TABLE public.appointment_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants veuen assistents" ON public.appointment_attendees;
CREATE POLICY "Participants veuen assistents"
  ON public.appointment_attendees FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND (a.created_by = auth.uid() OR a.main_attendee_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Admins gestionen assistents" ON public.appointment_attendees;
CREATE POLICY "Admins gestionen assistents"
  ON public.appointment_attendees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Sistema insereix assistents" ON public.appointment_attendees;
CREATE POLICY "Sistema insereix assistents"
  ON public.appointment_attendees FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Assistents actualitzen el seu estat" ON public.appointment_attendees;
CREATE POLICY "Assistents actualitzen el seu estat"
  ON public.appointment_attendees FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================
-- POLÍTIQUES RLS PER A appointments (CITES)
-- ============================================================
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

DROP POLICY IF EXISTS "Attendees actualitzen cites" ON public.appointments;
CREATE POLICY "Attendees actualitzen cites"
  ON public.appointments FOR UPDATE
  USING (
    auth.uid() = main_attendee_id OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );


-- ============================================================
-- TAULA: tasks (TASQUES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to     UUID REFERENCES public.profiles(id),
  client_id       UUID REFERENCES public.clients(id),
  appointment_id  UUID REFERENCES public.appointments(id),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks(due_date);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Treballadors veuen les seves tasques" ON public.tasks;
CREATE POLICY "Treballadors veuen les seves tasques"
  ON public.tasks FOR SELECT
  USING (
    auth.uid() = assigned_to OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Admins gestionen totes les tasques" ON public.tasks;
CREATE POLICY "Admins gestionen totes les tasques"
  ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Treballadors creen i actualitzen tasques" ON public.tasks;
CREATE POLICY "Treballadors creen i actualitzen tasques"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Assignats actualitzen tasques" ON public.tasks;
CREATE POLICY "Assignats actualitzen tasques"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);


-- ============================================================
-- TAULA: fiscal_deadlines (TERMINIS FISCALS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fiscal_deadlines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  model       TEXT,
  date        DATE NOT NULL,
  year        INTEGER NOT NULL,
  description TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiscal_deadlines_date_idx ON public.fiscal_deadlines(date);
CREATE INDEX IF NOT EXISTS fiscal_deadlines_year_idx ON public.fiscal_deadlines(year);

ALTER TABLE public.fiscal_deadlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris autenticats veuen terminis" ON public.fiscal_deadlines;
CREATE POLICY "Usuaris autenticats veuen terminis"
  ON public.fiscal_deadlines FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen terminis" ON public.fiscal_deadlines;
CREATE POLICY "Admins gestionen terminis"
  ON public.fiscal_deadlines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Terminis fiscals 2026
INSERT INTO public.fiscal_deadlines (name, model, date, year, description, is_critical) VALUES
  ('IVA 1r trimestre',        'Mod. 303', '2026-04-20', 2026, 'Liquidació IVA Q1 2026',              TRUE),
  ('IRPF retencionss Q1',     'Mod. 111', '2026-04-20', 2026, 'Retencions IRPF treballadors Q1',    TRUE),
  ('IVA 2n trimestre',        'Mod. 303', '2026-07-20', 2026, 'Liquidació IVA Q2 2026',              TRUE),
  ('IRPF retencions Q2',      'Mod. 111', '2026-07-20', 2026, 'Retencions IRPF treballadors Q2',    TRUE),
  ('Renda - final termini',   'IRPF',     '2026-06-30', 2026, 'Final de campanya de la Renda 2025', TRUE),
  ('IVA 3r trimestre',        'Mod. 303', '2026-10-20', 2026, 'Liquidació IVA Q3 2026',              TRUE),
  ('IRPF retencions Q3',      'Mod. 111', '2026-10-20', 2026, 'Retencions IRPF treballadors Q3',    TRUE),
  ('IVA resum anual',         'Mod. 390', '2027-01-30', 2026, 'Resum anual IVA 2026',               TRUE),
  ('IRPF resum anual',        'Mod. 190', '2027-01-31', 2026, 'Resum anual retencions 2026',        TRUE)
ON CONFLICT DO NOTHING;


-- ============================================================
-- TAULA: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('vacation_request','vacation_approved','vacation_rejected','appointment_assigned','appointment_confirmed','appointment_rejected','task_assigned','system','other')),
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuaris veuen les seves notificacions" ON public.notifications;
CREATE POLICY "Usuaris veuen les seves notificacions"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role insereix notificacions" ON public.notifications;
CREATE POLICY "Service role insereix notificacions"
  ON public.notifications FOR INSERT
  WITH CHECK (true);


-- ============================================================
-- TAULA: files (DOCUMENTS)
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

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants veuen fitxers" ON public.files;
CREATE POLICY "Participants veuen fitxers"
  ON public.files FOR SELECT
  USING (
    auth.uid() = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor')
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

DROP POLICY IF EXISTS "Sistema insereix auditoria" ON public.audit_logs;
CREATE POLICY "Sistema insereix auditoria"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

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

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tots els usuaris veuen configuració" ON public.settings;
CREATE POLICY "Tots els usuaris veuen configuració"
  ON public.settings FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionen configuració" ON public.settings;
CREATE POLICY "Admins gestionen configuració"
  ON public.settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

INSERT INTO public.settings (key, value, description) VALUES
  ('max_simultaneous_vacations_2026', '3',    'Màxim treballadors de vacances simultàniament el 2026'),
  ('max_simultaneous_vacations_default', '2', 'Màxim treballadors de vacances simultàniament'),
  ('default_vacation_days', '23',             'Dies de vacances per defecte per treballador'),
  ('carry_over_deadline', '15',               'Dia del mes de gener fins quan es poden arrossegar vacances'),
  ('working_hours_start', '08:00',            'Hora d''inici de la jornada laboral'),
  ('working_hours_end', '17:00',              'Hora de fi de la jornada laboral'),
  ('app_language', 'ca',                      'Idioma per defecte de l''aplicació'),
  ('company_name', 'Tràmit Economistes',      'Nom de l''empresa'),
  ('company_email', 'info@tramiteconomistes.com', 'Email de contacte de l''empresa')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- VISTES ÚTILS
-- ============================================================

CREATE OR REPLACE VIEW public.active_absences_today AS
SELECT
  ar.id,
  ar.user_id,
  ar.type,
  ar.start_date,
  ar.end_date,
  ar.status,
  p.full_name,
  p.color,
  CASE
    WHEN ar.type = 'vacation' THEN 'Vacances'
    WHEN ar.type = 'sick_leave' THEN 'Baixa mèdica'
    WHEN ar.type = 'permission' THEN 'Permís'
    ELSE 'Absència'
  END AS display_label
FROM public.absence_requests ar
JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.status = 'approved'
  AND ar.start_date <= CURRENT_DATE
  AND ar.end_date >= CURRENT_DATE;

CREATE OR REPLACE VIEW public.vacation_balances_with_profile AS
SELECT
  vb.*,
  p.full_name,
  p.email,
  p.role,
  p.color
FROM public.vacation_balances vb
JOIN public.profiles p ON p.id = vb.user_id;

-- ============================================================
-- FI DEL SCHEMA
-- ============================================================
