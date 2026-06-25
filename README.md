# Tràmit Economistes — App Interna de Gestió

Aplicació web privada per a la gestió de vacances, absències, agenda, cites i clients de Tràmit Economistes.

**Stack:** Next.js 14 (App Router) + Supabase + Vercel + GitHub + Resend + Google APIs  
**Versió actual:** 0.1.0 — Fase 0 (base tècnica)

---

## Requisits previs

- Node.js 18.17 o superior
- Compte a [Supabase](https://supabase.com) (gratuït)
- Compte a [Vercel](https://vercel.com) (gratuït)
- Repositori privat a [GitHub](https://github.com)
- Compte a [Resend](https://resend.com) (gratuït fins a 3.000 emails/mes)
- Compte de Google dedicat per a l'empresa (tramit.calendari@gmail.com o similar)

---

## Pas 1 — Configuració de Supabase

1. Ves a [supabase.com](https://supabase.com) i crea un compte.
2. Crea un **nou projecte**:
   - Nom: `tramit-economistes`
   - Contrasenya de base de dades: genera-la i guarda-la en un lloc segur
   - Regió: **West EU (Ireland)** o **Central EU (Frankfurt)** (compliment RGPD)
3. Espera que el projecte s'inicialitzi (~2 minuts).
4. Ves a **Settings > API** i copia:
   - `Project URL` → serà el teu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → serà el teu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → serà el teu `SUPABASE_SERVICE_ROLE_KEY` ⚠️ mai al codi públic
5. Ves a **SQL Editor** i executa el fitxer `supabase-schema.sql` (copia i enganxa tot el contingut).
6. Ves a **Authentication > Settings** i configura:
   - Site URL: `https://app.tramiteconomistes.com` (o el teu domini)
   - Afegeix `http://localhost:3000` a Redirect URLs per al desenvolupament local

---

## Pas 2 — Creació d'usuaris a Supabase

1. Ves a **Authentication > Users** al tauler de Supabase.
2. Crea els usuaris manualment amb el botó **"Invite user"** o **"Add user"**:

| Email | Contrasenya inicial |
|-------|-------------------|
| marina@tramiteconomistes.com | (genera una contrasenya temporal) |
| rosa@tramiteconomistes.com | (genera una contrasenya temporal) |
| eva@tramiteconomistes.com | (genera una contrasenya temporal) |
| ferran@tramiteconomistes.com | (ídem) |
| neus@tramiteconomistes.com | (ídem) |
| maria@tramiteconomistes.com | (ídem) |
| carmina@tramiteconomistes.com | (ídem) |
| narcis@tramiteconomistes.com | (ídem) |
| pere@tramiteconomistes.com | (ídem) |
| andres@tramiteconomistes.com | (ídem) |

3. Un cop creats tots els usuaris, executa el fitxer `supabase-seed-workers.sql` al **SQL Editor**.
4. Verifica que la consulta final del seed mostra tots els treballadors amb els seus saldos.

---

## Pas 3 — Compte de Google i APIs

1. Accedeix al compte de Google dedicat de l'empresa (p. ex. `tramit.calendari@gmail.com`).
2. Ves a [Google Cloud Console](https://console.cloud.google.com):
   - Crea un **nou projecte**: `Tramit Economistes`
   - Activa les APIs: **Google Calendar API v3**, **Google Drive API v3**, **Google Sheets API v4**
   - Ves a **APIs & Services > Credentials**
   - Crea **OAuth 2.0 Client ID** (tipus: Web application)
   - Afegeix als Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://app.tramiteconomistes.com/api/auth/callback/google`
   - Copia `Client ID` → `GOOGLE_CLIENT_ID`
   - Copia `Client Secret` → `GOOGLE_CLIENT_SECRET`
3. Crea un **calendari central** a Google Calendar:
   - Nom: `Tràmit Economistes — Agenda`
   - Ves a la configuració del calendari i copia l'**ID del calendari** → `GOOGLE_CALENDAR_ID`
4. Crea la carpeta **CLIENTS** a Google Drive de l'empresa.
5. Crea un Google Sheet nou: **"Clients Tràmit Economistes"** amb les columnes:
   `ID | Nom | Empresa | Telèfon | Email | NIF/CIF | Responsable intern | Notes | Data creació | Origen`

---

## Pas 4 — Resend (email transaccional)

1. Crea un compte a [resend.com](https://resend.com).
2. Ves a **Domains** i afegeix el domini `tramiteconomistes.com`.
3. Segueix les instruccions per verificar el domini (cal afegir registres DNS).
4. Un cop verificat, crea una **API Key** → `RESEND_API_KEY`.

---

## Pas 5 — Repositori GitHub i Vercel

### GitHub
1. Crea un **repositori privat** a GitHub (p. ex. `tramit-economistes`).
2. Inicialitza el repositori local i puja el codi:
```bash
git init
git add .
git commit -m "feat: Fase 0 - base tècnica"
git remote add origin https://github.com/[usuari]/tramit-economistes.git
git push -u origin main
```

### Vercel
1. Ves a [vercel.com](https://vercel.com) i crea un compte.
2. Clica **"New Project"** i importa el repositori de GitHub.
3. Configura les **Environment Variables** (ves a Settings > Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
GOOGLE_CLIENT_ID                = xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET            = GOCSPX-xxxx
GOOGLE_CALENDAR_ID              = xxxx@group.calendar.google.com
RESEND_API_KEY                  = re_xxxx
NEXTAUTH_SECRET                 = [genera amb: openssl rand -base64 32]
NEXTAUTH_URL                    = https://app.tramiteconomistes.com
```

4. Clica **Deploy** i espera que es completi el desplegament.
5. Ves a **Settings > Domains** i configura el domini `app.tramiteconomistes.com`.

---

## Pas 6 — Instal·lació i execució local

```bash
# Clonar el repositori
git clone https://github.com/[usuari]/tramit-economistes.git
cd tramit-economistes

# Instal·lar dependències
npm install

# Crear fitxer d'entorn local (copia .env.example)
cp .env.example .env.local
# Edita .env.local i omple les variables amb els valors reals

# Executar en mode desenvolupament
npm run dev
```

Obre [http://localhost:3000](http://localhost:3000) al navegador.

### Verificar que compila sense errors
```bash
npm run build
```

---

## Estructura del projecte

```
tramit-economistes/
├── app/                          # Rutes Next.js (App Router)
│   ├── api/                      # API routes
│   │   ├── auth/callback/        # Callback d'autenticació Supabase
│   │   └── health/               # Health check
│   ├── dashboard/                # Panell admin/supervisor
│   │   ├── agenda/
│   │   ├── absencies/
│   │   ├── auditoria/
│   │   ├── clients/
│   │   ├── configuracio/
│   │   ├── informes/
│   │   ├── vacances/
│   │   ├── layout.tsx            # Layout amb auth check (admin)
│   │   └── page.tsx              # Tauler principal admin
│   ├── login/                    # Pàgina d'accés
│   ├── worker/                   # Panell treballador
│   │   ├── agenda/
│   │   ├── vacances/
│   │   │   └── nova/
│   │   ├── layout.tsx            # Layout amb auth check (worker)
│   │   └── page.tsx              # Inici treballador
│   ├── globals.css               # Estils globals + variables CSS
│   ├── layout.tsx                # Layout arrel amb ThemeProvider
│   └── page.tsx                  # Redirecció a /dashboard o /worker
├── components/
│   ├── ui/                       # Components shadcn/ui
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── separator.tsx
│   ├── layout/                   # Components de layout
│   │   ├── app-layout.tsx        # Layout principal amb sidebar + header
│   │   ├── header.tsx            # Header superior
│   │   ├── logo.tsx              # Logo SVG Tràmit Economistes
│   │   ├── sidebar.tsx           # Navegació lateral
│   │   └── theme-provider.tsx    # Proveïdor de tema clar/fosc
│   └── features/                 # Components per funcionalitat
│       ├── login-form.tsx        # Formulari de login
│       └── placeholder-page.tsx  # Placeholder per a fases futures
├── hooks/
│   ├── use-profile.ts            # Hook per carregar el perfil de l'usuari
│   └── use-vacation-balance.ts   # Hook per saldo de vacances
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Client de Supabase (navegador)
│   │   ├── middleware.ts         # Helper per al middleware de Next.js
│   │   └── server.ts             # Client de Supabase (servidor)
│   ├── google/
│   │   ├── calendar.ts           # Google Calendar API (Fase 9)
│   │   ├── drive.ts              # Google Drive API (Fase 8)
│   │   └── sheets.ts             # Google Sheets API (Fase 7)
│   ├── resend/
│   │   └── index.ts              # Plantilles d'email (Fase 10)
│   └── utils/
│       └── index.ts              # Funcions helpers generals
├── middleware.ts                  # Protecció de rutes Next.js
├── types/
│   ├── database.ts               # Interfícies TypeScript de la BD
│   └── index.ts                  # Exportació d'interfícies
├── supabase-schema.sql           # Esquema complet de Supabase + RLS
├── supabase-seed-workers.sql     # Càrrega de treballadors i dades 2026
├── .env.local                    # Variables d'entorn locals (NO pujar a Git)
├── .env.example                  # Exemple de variables d'entorn
└── README.md                     # Aquest fitxer
```

---

## Fases de construcció

| Fase | Objectiu | Estat |
|------|----------|-------|
| **Fase 0** | Base tècnica: Supabase, GitHub, Vercel, Google, Resend | ✅ En curs |
| **Fase 1** | Login, rols, RLS, layout, català/castellà, clar/fosc | ✅ Implementat |
| **Fase 2** | Usuaris reals, saldos 2026, festius, tancaments | ✅ SQL preparat |
| Fase 3 | Sol·licituds de vacances | 🔜 Pendent |
| Fase 4 | Baixes, permisos i altres absències | 🔜 Pendent |
| Fase 5 | Agenda global amb calendari | 🔜 Pendent |
| Fase 6 | Cites i flux d'acceptació | 🔜 Pendent |
| Fase 7 | Clients i Google Sheets | 🔜 Pendent |
| Fase 8 | Documents i Google Drive | 🔜 Pendent |
| Fase 9 | Google Calendar (sincronització) | 🔜 Pendent |
| Fase 10 | Notificacions i resums diaris | 🔜 Pendent |
| Fase 11 | Informes Excel/PDF | 🔜 Pendent |
| Fase 12 | IA i assistent intern (Claude API) | 🔜 Pendent |

---

## Decisions pendents (IMPORTANT)

Abans d'iniciar la fase corresponent, cal tancar:

- [ ] **URGENT** — Confirmar emails de Marina i Rosa per a les admins
- [ ] **URGENT** — Confirmar compte de Google dedicat (Calendar, Drive, Sheets)
- [ ] **URGENT** — Lliurar logo, colors corporatius i tipografia visual
- [ ] Taula de períodes crítics (renda, trimestrals, terminis) → Fase 3
- [ ] Hora del resum setmanal (dilluns a les 7:00h?) → Fase 10
- [ ] Tancaments d'empresa 2027 i posteriors → Configuració anual
- [ ] Domini de l'app (`app.tramiteconomistes.com`?) → Fase 0
- [ ] Acord especial de Narcís (13 dies pendents d'arrossegament) → Fase 2

---

## Seguretat

- **MAI** pujar `.env.local` a Git (ja és al `.gitignore`)
- Les claus `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY` són **secretes**
- RLS activat des del primer moment en totes les taules
- Les baixes mèdiques **només** les veuen Marina, Rosa i el propi treballador
- Tots els accessos sensibles queden registrats a `audit_logs`

---

## Suport tècnic

Per a qualsevol dubte tècnic durant el desenvolupament, treballar amb Claude Code
proporcionant el context d'aquest `README.md` i el document `tramit_economistes_MVP_v2.docx`.

---

*Document intern i confidencial — Tràmit Economistes — Versió 0.1.0*
