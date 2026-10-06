# Media Maratón 1:50

Plan de entrenamiento de 23 semanas para correr una media maratón en 1:50 y prevenir la
periostitis tibial, convertido en aplicación web multiusuario.

Cada atleta entra con su cuenta de Google, ve su plan y guarda su propio progreso. Nadie ve los
datos de nadie.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Autenticación | Supabase Auth con Google OAuth (flujo PKCE) |
| Base de datos | Supabase Postgres |
| Aislamiento de datos | Row Level Security (RLS) |
| Validación | Zod en servidor |
| Despliegue | Vercel |

---

## Seguridad

Esto es lo que hay implementado, y por qué.

### Autenticación

- **No hay contraseñas.** Google es quien autentica y Supabase quien emite la sesión. No existe
  ninguna base de datos de contraseñas que se pueda filtrar.
- **Flujo PKCE.** El `code` de OAuth solo se puede canjear una vez y va firmado.
- **`getUser()` y nunca `getSession()` en el servidor.** `getUser()` valida el token contra el
  servidor de auth; `getSession()` se cree lo que le llega en la cookie y es vulnerable a
  manipulación.
- **Cookies `httpOnly` + `Secure` + `SameSite=Lax`.** El JavaScript de la página no puede leer el
  token de sesión.

### Aislamiento de datos

- **Row Level Security activo en las cuatro tablas.** Cada política exige
  `auth.uid() = user_id`. Aunque alguien obtuviera la *anon key* (que es pública por diseño), el
  motor de base de datos le devolvería cero filas de otros usuarios. El aislamiento no depende del
  código de la aplicación: vive en Postgres.
- **GRANT retirados al rol `anon`.** Defensa en profundidad: además de RLS, los permisos a nivel de
  tabla están revocados para los no autenticados.
- **La `service_role` key nunca sale del servidor.** Si se usara en el cliente, se saltaría RLS por
  completo. Aquí solo se emplea, y de forma opcional, para el rate limiter.

### Entrada y salida

- **Validación Zod en el servidor** en todas las Server Actions, además de las restricciones
  `CHECK` de la base de datos. El cliente nunca es una fuente de confianza.
- **Comprobación de coherencia de negocio.** No basta con validar tipos: se verifica que la semana
  y el día existan de verdad y que la sesión sea marcable.
- **Errores genéricos hacia el navegador.** Los detalles se registran en el servidor, no se
  devuelven al cliente.
- **Sin enumeración de usuarios.** No hay formulario de login, así que no hay mensajes que
  distingan "existe" de "no existe".

### Red y navegador

- **CSP con nonce por petición** y `strict-dynamic`. Sin `unsafe-inline` en `script-src`. La CSP
  viaja también en las cabeceras de *petición* para que Next.js aplique el nonce a sus propios
  scripts.
- **HSTS** (2 años, `includeSubDomains`, `preload`), **`X-Content-Type-Options: nosniff`**,
  **`X-Frame-Options: DENY`** y **`frame-ancestors 'none'`** (anti-clickjacking),
  **`Referrer-Policy`**, **`Permissions-Policy`** y **COOP/CORP**.
- **Protección de open redirect** en el parámetro `?next=`: solo se aceptan rutas internas.
- **Rate limiting** por usuario en cada Server Action. Respaldado por Postgres (consistente entre
  instancias serverless) con reserva en memoria.
- **Cierre de sesión por POST** con comprobación de `Origin`. Un GET permitiría forzar el logout
  con un simple `<img src="/auth/signout">`.
- **Guardia de autenticación en el middleware.** Las páginas protegidas ni siquiera se renderizan
  para un anónimo.
- **`noindex` + `robots.txt`.** App privada, fuera de buscadores.

### Secretos

- `.env.local` está en `.gitignore`. **Nunca** se sube.
- Solo las variables `NEXT_PUBLIC_*` llegan al navegador, y son las dos que deben llegar.
- `.env.example` documenta lo necesario sin contener ningún valor real.

---

## Puesta en marcha

### 1. Requisitos

- Node.js 20 o superior
- Una cuenta de Supabase
- Una cuenta de Google (para el OAuth)

### 2. Crear las tablas

En el dashboard de Supabase: **SQL Editor → New query**, pega el contenido de
`supabase/migrations/0001_init.sql` y pulsa **Run**. El script es idempotente: puedes ejecutarlo
varias veces sin romper nada.

### 3. Crear las credenciales de Google

1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. **Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. En **URIs de redirección autorizados** añade exactamente:
   ```
   https://TU-PROYECTO.supabase.co/auth/v1/callback
   ```
   (el `TU-PROYECTO` es el de tu proyecto de Supabase, no el dominio de Vercel).
4. Copia el **Client ID** y el **Client Secret**.

### 4. Conectar Google con Supabase

En Supabase: **Authentication → Providers → Google** → actívalo y pega el Client ID y el Client
Secret del paso anterior.

Luego, en **Authentication → URL Configuration**:

- **Site URL**: la URL de producción (`https://tu-app.vercel.app`)
- **Redirect URLs**, añade las dos:
  ```
  https://tu-app.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  ```

### 5. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   # Settings → API → anon public
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

La **anon key** es pública por diseño: está protegida por RLS, no por secreto.

Opcional, solo si quieres que el rate limiting sea consistente entre instancias:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # Settings → API → service_role. ¡NUNCA en el cliente!
```

### 6. Arrancar

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

---

## Despliegue en Vercel

1. Sube el repositorio a GitHub.
2. En [vercel.com/new](https://vercel.com/new), importa el repositorio. Vercel detecta Next.js solo.
3. **Antes de desplegar**, añade las variables de entorno en *Environment Variables*:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` → `https://tu-proyecto.vercel.app`
   - `SUPABASE_SERVICE_ROLE_KEY` *(opcional, marca "Sensitive")*
4. Deploy.
5. Vuelve a Supabase → **Authentication → URL Configuration** y añade la URL de Vercel en
   *Site URL* y *Redirect URLs* (paso 4 de arriba). Si no lo haces, el login fallará con
   `redirect_uri_mismatch`.
6. En Google Cloud Console, añade también la URL de callback de producción si usas un proyecto de
   Supabase distinto.

---

## Estructura

```
app/
  layout.tsx              Layout raíz, metadatos PWA
  globals.css             Estilos
  page.tsx                Raíz: redirige a /plan o /login
  login/                  Pantalla de entrada + botón de Google
  auth/callback/          Canje del code de OAuth
  auth/signout/           Cierre de sesión (POST)
  plan/
    page.tsx              Página protegida: carga los datos del usuario
    actions.ts            Server Actions (marcar sesión, guardar registro, resetear)
components/
  PlanApp.tsx             Interfaz: pestañas Hoy / Plan / Prevención / Registro
  PreventionTab.tsx       Protocolo de prevención
lib/
  plan-data.ts            Las 23 semanas (datos puros, sin dependencias)
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

## Los documentos originales

En `docs/` está el material de partida:

- `guia-completa-media-maraton-v2.md` — el plan original sub-1:15 (se conserva como referencia)
- `plan-media-maraton-1h50-prevencion.md` — el plan real, con zonas, progresión y protocolo de prevención
- `calendario-entrenamiento-23-semanas.md` — el calendario día a día
