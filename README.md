# Media Maratón 1:50

Plan de entrenamiento de 23 semanas para correr una media maratón en 1:50 y prevenir la
periostitis tibial, convertido en aplicación web multiusuario.

Cada atleta crea su cuenta, ve su plan y guarda su propio progreso. Nadie ve los datos de nadie.

**Producción:** https://media-maraton-tawny.vercel.app

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Autenticación | Supabase Auth con email y contraseña |
| Base de datos | Supabase Postgres |
| Aislamiento de datos | Row Level Security (RLS) |
| Validación | Zod en servidor |
| Despliegue | Vercel (conectado al repositorio de GitHub) |

---

## Diseño

La interfaz no es un panel de control: es una **hoja de tiempos**. Papel, tinta, filetes de un
píxel, cifras grandes y **cero iconos**. El monoespaciado es la voz dominante porque esta
herramienta es, literalmente, números.

**Paleta.** Dos temas, ambos con el mismo par de materiales:

| | Papel (claro) | Tinta (oscuro) |
|---|---|---|
| Fondo | `#EFEBE3` | `#12100D` |
| Texto | `#17140F` | `#F0EBE1` |
| Señal | `#B0350F` | `#FF5C2B` |

El color **no** codifica la categoría de sesión, sino la **intensidad** (0-3). La categoría se dice
con tipografía: `FONDO`, `CALIDAD`, `CRUCE`, `FUERZA`, `LIBRE`, `TEST`, `CARRERA`.

Los grises están calibrados para superar **WCAG AA** sobre su fondo real (la letra mono de 10-11 px
es la voz de la interfaz, no puede ser un gris decorativo). Verificado con medición automática de
ratios en ambos temas.

**Elemento firma.** Las 23 semanas del plan son una tira de barras en la cabecera que se van
llenando a lo largo de cinco meses. Cada semana deja su muesca aunque esté a cero, de modo que la
tira se lee como una regla de medición y no como una fila de cajas vacías.

**Tema sin parpadeo.** La preferencia viaja en una cookie (`mm-theme`) y se resuelve **en el
servidor**, así que `data-theme` está en el primer byte de HTML. No se usa `localStorage` ni un
script inline: nuestra CSP es estricta con nonce y bloquearía el inline. Si no hay cookie manda la
preferencia del sistema.

**Detalles de iOS.** `100dvh` con respaldo `100vh`, `env(safe-area-inset-*)` en cabecera y raíl,
objetivos táctiles de 52 px, `-webkit-text-size-adjust: 100%`, `overscroll-behavior: contain`,
`viewport-fit: cover` y **campos a 16 px** — por debajo de eso Safari hace zoom al enfocar.

---

## Seguridad

### Autenticación

- **Las contraseñas las gestiona Supabase Auth.** Se almacenan con bcrypt y nunca pasan por
  nuestro código ni por nuestros logs.
- **Confirmación de email desactivada** (`mailer_autoconfirm`), para que el registro sea inmediato
  entre un grupo cerrado de amigos. Si algún día se abre al público, se activa y se configura SMTP.
- **Longitud mínima de 8 caracteres impuesta en el proveedor**, no solo en el formulario: un
  cliente manipulado no puede saltársela.
- **Cookies `httpOnly` + `Secure` + `SameSite=Lax`.** El JavaScript de la página no puede leer el
  token de sesión.
- **`getUser()` y nunca `getSession()` en el servidor.** `getUser()` valida el token contra el
  servidor de auth; `getSession()` se cree lo que le llega en la cookie.

### Aislamiento de datos

- **Row Level Security activo en las cuatro tablas.** Cada política exige `auth.uid() = user_id`.
  Aunque alguien obtuviera la *publishable key* (que es pública por diseño), Postgres le devolvería
  cero filas de otros usuarios. El aislamiento no depende del código de la aplicación: vive en el
  motor.
- **GRANT retirados al rol `anon`.** Defensa en profundidad sobre RLS.
- **La `service_role` key nunca sale del servidor.** Solo se usa, opcionalmente, para el rate
  limiter.

### Entrada y salida

- **Validación Zod en el servidor** en todas las Server Actions, además de las restricciones
  `CHECK` de la base de datos.
- **Comprobación de coherencia de negocio:** no basta con validar tipos, se verifica que la semana
  y el día existan y que la sesión sea marcable.
- **Errores genéricos hacia el navegador.** Los detalles se registran en el servidor.

### Red y navegador

- **CSP con nonce por petición** y `strict-dynamic`. Sin `unsafe-inline` en `script-src`. La CSP
  viaja también en las cabeceras de *petición* para que Next.js aplique el nonce a sus scripts.
- **HSTS** (2 años, `includeSubDomains`, `preload`), **`X-Content-Type-Options: nosniff`**,
  **`X-Frame-Options: DENY`** y **`frame-ancestors 'none'`**, **`Referrer-Policy`**,
  **`Permissions-Policy`** y **COOP/CORP**.
- **Protección de open redirect** en el parámetro `?next=`: solo se aceptan rutas internas.
- **Rate limiting** por usuario en cada Server Action, respaldado en Postgres.
- **Cierre de sesión por POST** con comprobación de `Origin`.
- **Guardia de autenticación en el middleware:** las páginas protegidas ni se renderizan para un
  anónimo.
- **`noindex` + `robots.txt`.**

### Secretos

- `.env.local` está en `.gitignore` (`.env*`). **Nunca** se sube.
- Solo las variables `NEXT_PUBLIC_*` llegan al navegador, y son las dos que deben llegar.
- `.env.example` documenta lo necesario sin contener valores reales.

---

## Puesta en marcha

### 1. Requisitos

- Node.js 20 o superior
- Una cuenta de Supabase

### 2. Crear las tablas

En el dashboard de Supabase: **SQL Editor → New query**, pega el contenido de
`supabase/migrations/0001_init.sql` y pulsa **Run**. Es idempotente.

### 3. Activar el acceso con email

En Supabase: **Authentication → Sign In / Providers**:

- **Email** debe estar habilitado.
- **Confirm email**: desactivado (para que el registro sea inmediato).
- **Minimum password length**: 8.

O por API:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/TU_REF/config/auth" \
  -H "Authorization: Bearer TU_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external_email_enabled":true,"mailer_autoconfirm":true,"password_min_length":8}'
```

### 4. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # Settings → API Keys
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

La **publishable key** es pública por diseño: está protegida por RLS, no por secreto.

Opcional, solo para que el rate limiting sea consistente entre instancias serverless:

```bash
SUPABASE_SERVICE_ROLE_KEY=...   # ¡NUNCA en el cliente!
```

### 5. Arrancar

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

---

## Despliegue en Vercel

El repositorio ya está conectado, así que **cada push a `main` despliega solo**. Para hacerlo desde
la CLI:

```bash
npx vercel link --yes --project media-maraton
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel deploy --prod
```

Después, en Supabase → **Authentication → URL Configuration**, pon el dominio de producción como
**Site URL**. Con email y contraseña no hacen falta *Redirect URLs*: no hay ida y vuelta a un
proveedor externo.

---

## Estructura

```
app/
  layout.tsx              Layout raíz, fuentes, metadatos PWA, tema desde cookie
  globals.css             Sistema de diseño completo (tokens + primitivas)
  theme-actions.ts        Server Action que guarda el tema en cookie
  page.tsx                Raíz: redirige a /plan o /login
  login/
    page.tsx              Pantalla de acceso
    AuthForm.tsx          Formulario de entrar / crear cuenta
  auth/signout/           Cierre de sesión (POST)
  plan/
    page.tsx              Página protegida: carga los datos del usuario
    actions.ts            Server Actions (marcar sesión, guardar registro, resetear)
components/
  PlanApp.tsx             Interfaz: Hoy / Plan / Protección / Registro
  PreventionTab.tsx       Protocolo de prevención
  ThemeToggle.tsx         Conmutador papel / tinta
lib/
  plan-data.ts            Las 23 semanas (datos puros)
  theme.ts                Constante y tipos del tema
  env.ts                  Validación de variables de entorno
  validation.ts           Esquemas Zod
  rate-limit.ts           Limitador de peticiones
  url.ts                  Protección de open redirect
  supabase/               Clientes de servidor, navegador y middleware
supabase/migrations/      Esquema SQL + RLS
docs/                     Los documentos originales del plan
legacy/                   La versión anterior en un solo HTML
scripts/make-icon.ps1     Genera los iconos de la PWA
middleware.ts             Guardia de auth + cabeceras de seguridad
```

---

## Base de datos

| Tabla | Contenido | Políticas RLS |
|---|---|---|
| `profiles` | Nombre y avatar, uno por cuenta | SELECT y UPDATE solo de la fila propia |
| `session_completions` | Casillas marcadas (usuario, semana, día) | SELECT, INSERT y DELETE propios |
| `weekly_logs` | Cierre semanal: km, dolor, cadencia, sueño, palpación, ACWR | SELECT, INSERT, UPDATE y DELETE propios |
| `rate_limits` | Contadores del limitador | Sin políticas: solo `service_role` |

El perfil se crea automáticamente con un trigger `SECURITY DEFINER` y `search_path` vacío cuando
alguien se registra.

---

## Limitaciones conocidas

- **Recuperar contraseña**: requiere envío de email. Supabase trae un servicio de desarrollo con
  límites muy bajos. Para producción hay que configurar SMTP propio (Resend, SendGrid…) en
  **Authentication → Emails**. Sin eso, un amigo que olvide su contraseña no puede recuperarla.
- **El registro es abierto**: cualquiera con la URL puede crear una cuenta. Para cerrarlo, activa
  `disable_signup` y crea las cuentas a mano desde el dashboard.

---

## Los documentos originales

En `docs/`:

- `guia-completa-media-maraton-v2.md` — el plan original sub-1:15 (referencia)
- `plan-media-maraton-1h50-prevencion.md` — el plan real, con zonas y protocolo de prevención
- `calendario-entrenamiento-23-semanas.md` — el calendario día a día
