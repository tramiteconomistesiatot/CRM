-- ============================================================
-- TRÀMIT ECONOMISTES — Càrrega de treballadors i dades 2026
-- Executar DESPRÉS de supabase-schema.sql i DESPRÉS de
-- crear els usuaris a Supabase Auth (Dashboard > Authentication > Users)
-- ============================================================
-- IMPORTANT: Substitueix els UUIDs pels reals de cada usuari
-- un cop creats a Supabase Auth.
-- ============================================================

-- Pas 1: Crear els comptes a Supabase Auth (Dashboard > Authentication > Users)
--   eva@tramiteconomistes.com
--   ferran@tramiteconomistes.com
--   neus@tramiteconomistes.com
--   maria@tramiteconomistes.com
--   carmina@tramiteconomistes.com
--   narcis@tramiteconomistes.com
--   pere@tramiteconomistes.com
--   andres@tramiteconomistes.com
--   marina@tramiteconomistes.com
--   rosa@tramiteconomistes.com

-- Pas 2: Actualitzar perfils (el trigger handle_new_user ja els crea,
-- cal actualitzar rol, telèfon i nom complet)

-- Admins
UPDATE public.profiles SET
  full_name = 'Marina Recio',
  role = 'admin',
  phone = NULL,
  language = 'ca'
WHERE email = 'marina@tramiteconomistes.com';

UPDATE public.profiles SET
  full_name = 'Rosa',
  role = 'admin',
  phone = NULL,
  language = 'ca'
WHERE email = 'rosa@tramiteconomistes.com';

-- Treballadors
UPDATE public.profiles SET full_name = 'Eva',     role = 'worker', phone = '647757502' WHERE email = 'eva@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Ferran',  role = 'worker', phone = '637254586' WHERE email = 'ferran@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Neus',    role = 'worker', phone = '609153957' WHERE email = 'neus@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Maria',   role = 'worker', phone = '638381760' WHERE email = 'maria@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Carmina', role = 'worker', phone = '651745946' WHERE email = 'carmina@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Narcís',  role = 'worker', phone = '630453926' WHERE email = 'narcis@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Pere',    role = 'worker', phone = '686375167' WHERE email = 'pere@tramiteconomistes.com';
UPDATE public.profiles SET full_name = 'Andrés',  role = 'worker', phone = '692898391' WHERE email = 'andres@tramiteconomistes.com';


-- ============================================================
-- Pas 3: Saldos de vacances 2026
-- Nota: used_days = dies laborables de les vacances JA APROVADES
-- pending_days = sol·licituds pendents d'aprovació
-- ============================================================

-- Eva: 18 dies totals. Aprovades: 24-27 abril(2d), 9-21 agost(9d), 2-6 nov(5d) = ~16. Pendents: 1
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 18, 16, 1 FROM public.profiles WHERE email = 'eva@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=18, used_days=16, pending_days=1;

-- Ferran: 12 dies totals. Aprovades: 25 ago(1d), 1-4 set(4d), 9-10 set(2d), 2 oct(1d), 18-23 des(4d) = 12. Pendents: 0
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 12, 12, 0 FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=12, used_days=12, pending_days=0;

-- Neus: 16 dies totals. Aprovades: 16-20 febr(5d), 14-18 set(5d), 23 oct(1d) = 11. Pendents: 5
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 16, 11, 5 FROM public.profiles WHERE email = 'neus@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=16, used_days=11, pending_days=5;

-- Maria: 16 dies totals. Aprovades: 1-5 juny(5d), 24 ago-4 set(10d) = ~15. Pendents: 1
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 16, 14, 1 FROM public.profiles WHERE email = 'maria@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=16, used_days=14, pending_days=1;

-- Carmina: 16 dies totals. Aprovades: 17-31 ago(11d), 28-30 set(3d), 22-23 oct(2d) = 16. Pendents: 0
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 16, 16, 0 FROM public.profiles WHERE email = 'carmina@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=16, used_days=16, pending_days=0;

-- Narcís: 16 dies totals. Aprovades: 4,11,18 març(3d). Pendents: 13
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 16, 3, 13 FROM public.profiles WHERE email = 'narcis@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=16, used_days=3, pending_days=13;

-- Pere: 26 dies totals. Aprovades: molts dies (aprox 24). Pendents: 2
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 26, 24, 2 FROM public.profiles WHERE email = 'pere@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=26, used_days=24, pending_days=2;

-- Andrés: 16 dies totals. Aprovades: 16 febr(1d), 10-14 ago(5d), 21 oct-2 nov(9d) = ~15. Pendents: 1
INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
SELECT id, 2026, 16, 15, 1 FROM public.profiles WHERE email = 'andres@tramiteconomistes.com'
ON CONFLICT (user_id, year) DO UPDATE SET total_days=16, used_days=15, pending_days=1;


-- ============================================================
-- Pas 4: Registre de les vacances JA APROVADES 2026
-- (absències en estat 'approved')
-- ============================================================

-- EVA
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-04-24', '2026-04-27', 2, 'approved', TRUE FROM public.profiles WHERE email = 'eva@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-09', '2026-08-21', 9, 'approved', TRUE FROM public.profiles WHERE email = 'eva@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-11-02', '2026-11-06', 5, 'approved', TRUE FROM public.profiles WHERE email = 'eva@tramiteconomistes.com';

-- FERRAN
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-25', '2026-08-25', 1, 'approved', TRUE FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-09-01', '2026-09-04', 4, 'approved', TRUE FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-09-09', '2026-09-10', 2, 'approved', TRUE FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-10-02', '2026-10-02', 1, 'approved', TRUE FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-12-18', '2026-12-23', 4, 'approved', TRUE FROM public.profiles WHERE email = 'ferran@tramiteconomistes.com';

-- NEUS
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-02-16', '2026-02-20', 5, 'approved', TRUE FROM public.profiles WHERE email = 'neus@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-09-14', '2026-09-18', 5, 'approved', TRUE FROM public.profiles WHERE email = 'neus@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-10-23', '2026-10-23', 1, 'approved', TRUE FROM public.profiles WHERE email = 'neus@tramiteconomistes.com';

-- MARIA
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-06-01', '2026-06-05', 5, 'approved', TRUE FROM public.profiles WHERE email = 'maria@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-24', '2026-09-04', 9, 'approved', TRUE FROM public.profiles WHERE email = 'maria@tramiteconomistes.com';

-- CARMINA
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-17', '2026-08-31', 11, 'approved', TRUE FROM public.profiles WHERE email = 'carmina@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-09-28', '2026-09-30', 3, 'approved', TRUE FROM public.profiles WHERE email = 'carmina@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-10-22', '2026-10-23', 2, 'approved', TRUE FROM public.profiles WHERE email = 'carmina@tramiteconomistes.com';

-- NARCÍS
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-03-04', '2026-03-04', 1, 'approved', TRUE FROM public.profiles WHERE email = 'narcis@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-03-11', '2026-03-11', 1, 'approved', TRUE FROM public.profiles WHERE email = 'narcis@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-03-18', '2026-03-18', 1, 'approved', TRUE FROM public.profiles WHERE email = 'narcis@tramiteconomistes.com';

-- PERE
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-02-19', '2026-02-19', 1, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-03-04', '2026-03-05', 2, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-03-23', '2026-03-23', 1, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-04-07', '2026-04-08', 2, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-05-18', '2026-05-22', 5, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-07-22', '2026-07-22', 1, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-17', '2026-08-21', 5, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-09-21', '2026-09-25', 5, 'approved', TRUE FROM public.profiles WHERE email = 'pere@tramiteconomistes.com';

-- ANDRÉS
INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-02-16', '2026-02-16', 1, 'approved', TRUE FROM public.profiles WHERE email = 'andres@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-08-10', '2026-08-14', 5, 'approved', TRUE FROM public.profiles WHERE email = 'andres@tramiteconomistes.com';

INSERT INTO public.absence_requests (user_id, type, start_date, end_date, working_days, status, deducts_vacation)
SELECT id, 'vacation', '2026-10-21', '2026-11-02', 9, 'approved', TRUE FROM public.profiles WHERE email = 'andres@tramiteconomistes.com';

-- ============================================================
-- Verificació final
-- ============================================================
SELECT p.full_name, p.email, p.role, vb.total_days, vb.used_days, vb.pending_days, vb.remaining_days
FROM public.profiles p
LEFT JOIN public.vacation_balances vb ON vb.user_id = p.id AND vb.year = 2026
ORDER BY p.role, p.full_name;
