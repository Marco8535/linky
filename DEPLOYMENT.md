# Linky - Guia de Deployment Self-Hosted

> Deployment para **Amalgama Gastronomica** - plataforma link-in-bio para multiples sub-marcas.
>
> Ultima actualizacion: 2026-08-23 (sync con upstream; ver ficha 91 del repo SocialMedia)

---

## 1. Arquitectura General

```
                    ┌─────────────────────────────────────┐
                    │           Cloudflare DNS             │
                    │  links.dominio.com → Vercel          │
                    │  api.dominio.com   → CF Tunnel       │
                    └──────────┬──────────────┬────────────┘
                               │              │
                    ┌──────────▼──────┐  ┌────▼──────────────────┐
                    │   Vercel (Free) │  │  Cloudflare Tunnel    │
                    │   Next.js 16    │  │  (zero puertos)       │
                    │   Frontend SSR  │  └────┬──────────────────┘
                    └──────────┬──────┘       │
                               │         ┌────▼──────────────────┐
                               │         │  Oracle ARM Docker    │
                               │         │  Fastify API (:3001)  │
                               │         │  + cloudflared        │
                               │         └────┬──────────────────┘
                               │              │
                    ┌──────────▼──────────────▼──────────┐
                    │         Neon PostgreSQL (Free)      │
                    │         Pooled + Direct conn        │
                    └────────────────────────────────────┘

    Servicios auxiliares (todos free tier):
    ├── Tinybird ......... Analytics de clicks/vistas
    ├── Sentry ........... Error tracking (API + Frontend)
    ├── PostHog .......... Product analytics
    ├── Resend ........... Email transaccional
    ├── AWS S3 ........... Storage de imagenes/avatars
    └── Google OAuth ..... Autenticacion via better-auth

    DESHABILITADOS:
    ├── Stripe ........... Todos los usuarios son premium gratis
    └── DynamoDB ......... Reactions desactivado
```

**Flujo de requests:**
1. Usuario visita `links.dominio.com` → Vercel sirve el frontend Next.js
2. Frontend hace API calls a `api.dominio.com` → Cloudflare Tunnel → Oracle ARM → Fastify
3. Fastify conecta a Neon PostgreSQL para datos persistentes
4. Sin puertos expuestos en Oracle ARM (todo via tunnel)

---

## 2. Prerequisitos - Checklist de Cuentas

| Servicio | Proposito | Tier | Requerido | Notas |
|----------|-----------|------|-----------|-------|
| **Neon** | Base de datos PostgreSQL | Free | **Si** | Pooled + Direct connection strings |
| **Google Cloud** | OAuth login | Free | **Si** | OAuth consent screen + credentials |
| **Cloudflare** | DNS + Tunnel para API | Free | **Si** | Dominio ya en Cloudflare |
| **Oracle Cloud** | VM ARM para API Docker | Free | **Si** | A1.Flex (4 OCPU / 24GB RAM free) |
| **Vercel** | Frontend hosting | Free (Hobby) | **Si** | Conectado a GitHub |
| **AWS** | S3 storage de imagenes | Free tier | **Si** | Bucket + IAM user |
| **Resend** | Email transaccional | Free | **Si** | 100 emails/dia en free |
| **Tinybird** | Analytics de clicks | Free | Opcional | Recomendado para metricas |
| **Sentry** | Error tracking | Free | Opcional | Muy recomendado |
| **PostHog** | Product analytics | Free | Opcional | 1M eventos/mes gratis |

**Requisitos locales:**
- Node.js 24 (lo que fija `.nvmrc`; la imagen de la API tambien va en `node:24-slim`)
- pnpm 9+
- Docker + Docker Compose
- Git
- CLI de Cloudflare (`cloudflared`) para testeo local

---

## 3. Setup Paso a Paso

### 3a. Neon - Base de Datos

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto nuevo:
   - **Nombre**: `linky-amalgama`
   - **Region**: `us-east-1` (o la mas cercana al Oracle ARM)
   - **Postgres version**: 16+
3. En el dashboard, copiar ambas connection strings:

```
# Pooled (para la app - usa pgbouncer, puerto 5432 con -pooler en el host)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

# Direct (para migraciones Prisma - sin pooler)
DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

4. Anotar ambos valores para las env vars.

> **Importante**: `DATABASE_URL` usa la conexion pooled (tiene `-pooler` en el hostname). `DIRECT_URL` es la conexion directa sin pooler, necesaria para `prisma migrate`.

---

### 3b. Google OAuth

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear proyecto nuevo: `linky-amalgama`
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App name: `Linky Amalgama`
   - Authorized domains: `tudominio.com`
   - Scopes: `email`, `profile`, `openid`
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Linky Production`
   - Authorized redirect URIs:
     ```
     https://api.tudominio.com/api/auth/callback/google
     ```
5. Copiar (ojo con los nombres: el codigo lee `AUTH_GOOGLE_*`, no `GOOGLE_*`):
   ```
   AUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
   AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

> **Nota**: Si la app esta en "Testing", solo usuarios agregados manualmente pueden hacer login. Para produccion, publicar la app (requiere verificacion de Google si usas scopes sensibles, pero email/profile/openid no lo requieren).

---

### 3c. Cloudflare Tunnel

1. Ir a [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com) → Access → Tunnels
2. **Create a tunnel**:
   - Nombre: `linky-api`
   - Elegir **Cloudflared** como connector
   - Copiar el **tunnel token** (empieza con `eyJ...`)
3. **Public Hostnames → Add**:
   - Subdomain: `api`
   - Domain: `tudominio.com`
   - Service: `http://api:3001` (nombre del container Docker)
   - Configuracion adicional:
     - **HTTP Settings → No TLS Verify**: OFF (el backend es HTTP plano)
4. Guardar el token:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoixxxxxxxxx...
   ```

> **Nota**: El container `cloudflared` se conecta al servicio `api` por la red interna de Docker Compose. No se expone ningun puerto al host.

---

### 3d. Tinybird (Opcional pero recomendado)

1. Crear cuenta en [tinybird.co](https://www.tinybird.co)
2. Crear workspace: `linky-amalgama`
3. Instalar Tinybird CLI:
   ```bash
   pip install tinybird-cli
   tb auth --token <ADMIN_TOKEN>
   ```
4. Publicar datasources y pipes desde el repo:
   ```bash
   cd packages/tinybird/
   tb push --force
   ```
5. Copiar los valores:
   ```
   TINYBIRD_API_KEY=p.eyJ...          # Admin token (para la API)
   NEXT_PUBLIC_TINYBIRD_TRACKER_TOKEN=e.eyJ...  # Tracker token (publico, para frontend)
   ```

> El tracker token es seguro para exponer en el frontend. Solo permite escribir eventos, no leer datos.

---

### 3e. Sentry

1. Crear cuenta en [sentry.io](https://sentry.io)
2. Crear organizacion: `amalgama`
3. **Proyecto 1 - API**:
   - Platform: **Node.js**
   - Nombre: `linky-api`
   - Copiar DSN:
     ```
     SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/XXXXXXX
     ```
4. **Proyecto 2 - Frontend**:
   - Platform: **Next.js**
   - Nombre: `linky-frontend`
   - Copiar DSN:
     ```
     NEXT_PUBLIC_SENTRY_DSN=https://yyyyy@oXXXXX.ingest.sentry.io/YYYYYYY
     ```
5. **Settings → Auth Tokens** → Crear token con scope `project:releases`, `org:read`:
   ```
   SENTRY_AUTH_TOKEN=sntrys_eyJ...
   SENTRY_ORG=amalgama
   SENTRY_PROJECT=linky-frontend
   ```

---

### 3f. PostHog (Opcional)

1. Crear cuenta en [posthog.com](https://posthog.com) (US o EU)
2. Crear proyecto: `linky-amalgama`
3. Copiar:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # o https://eu.i.posthog.com si EU
   ```

---

### 3g. Resend

1. Crear cuenta en [resend.com](https://resend.com)
2. **API Keys → Create API Key**:
   ```
   RESEND_API_KEY=re_xxxxxxxxxx
   ```
3. (Opcional) **Domains → Add Domain**: Agregar `tudominio.com` y configurar DNS records (DKIM, SPF, DMARC) para enviar desde `noreply@tudominio.com` en vez de `onboarding@resend.dev`
4. (Opcional) **Audiences → Create Audience**: Para newsletter. Copiar el audience ID:
   ```
   RESEND_AUDIENCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

---

### 3h. AWS S3

1. Ir a [AWS Console → S3](https://s3.console.aws.amazon.com)
2. **Create bucket**:
   - Nombre: `linky-amalgama-uploads`
   - Region: `us-east-1` (o cercana)
   - **Block all public access**: OFF (las imagenes deben ser publicas)
   - Bucket policy para acceso publico de lectura:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "PublicRead",
           "Effect": "Allow",
           "Principal": "*",
           "Action": "s3:GetObject",
           "Resource": "arn:aws:s3:::linky-amalgama-uploads/*"
         }
       ]
     }
     ```
3. **Permissions → CORS**:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": [
         "https://links.tudominio.com",
         "https://tudominio.com",
         "http://localhost:3000"
       ],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. **IAM → Users → Create user**: `linky-s3-user`
   - Attach policy: `AmazonS3FullAccess` (o una policy custom limitada al bucket)
   - Create access key (Use case: Application running outside AWS)
5. Copiar:
   ```
   S3_ACCESS_KEY=AKIAxxxxxxxxxxxxxxxx
   S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   S3_BUCKET=linky-amalgama-uploads
   S3_REGION=us-east-1
   ```

---

### 3i. Vercel - Frontend

1. Ir a [vercel.com](https://vercel.com) → Add New Project
2. Importar el repositorio de GitHub
3. **Configuracion del proyecto**:
   - **Root Directory**: `apps/frontend`
   - **Framework Preset**: Next.js (autodetectado)
   - **Build Command**: dejar default (turborepo lo maneja)
   - **Install Command**: `pnpm install`
4. **Settings → Environment Variables**: Agregar todas las variables del frontend:
   ```
   NEXT_PUBLIC_APP_URL=https://links.tudominio.com
   NEXT_PUBLIC_API_URL=https://api.tudominio.com
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   NEXT_PUBLIC_TINYBIRD_TRACKER_TOKEN=e.eyJ...
   SENTRY_AUTH_TOKEN=sntrys_xxx
   SENTRY_ORG=amalgama
   SENTRY_PROJECT=linky-frontend
   ```
5. **Settings → Domains**: Agregar `links.tudominio.com`
6. Deploy.

---

### 3j. DNS - Configuracion de Registros

En Cloudflare DNS para `tudominio.com`:

| Tipo | Nombre | Valor | Proxy |
|------|--------|-------|-------|
| CNAME | `api` | (gestionado automaticamente por CF Tunnel) | Proxied |
| CNAME | `links` | `cname.vercel-dns.com` | **DNS Only** (gris) |

> **Importante**: El registro para Vercel debe ser **DNS Only** (nube gris), no Proxied. Cloudflare proxy interfiere con el SSL de Vercel.

---

## 4. API Deployment (Oracle ARM)

### Preparacion del servidor

```bash
# Conectar al servidor Oracle ARM
ssh arm-oracle-worker

# Crear directorio de trabajo
sudo mkdir -p /opt/linky
sudo chown ubuntu:ubuntu /opt/linky
cd /opt/linky

# Clonar repositorio
git clone https://github.com/tu-org/linky.git .
```

### Configurar variables de entorno

```bash
# Crear archivo de env de produccion
cp .env.example .env.production
nano .env.production
```

Completar `.env.production` con todos los valores recopilados:

> Los nombres de abajo son los que el codigo lee de verdad (verificados contra
> `.env.production` del deployment en produccion, 23/08/2026). La version anterior de esta
> guia inventaba varios — `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `APP_URL`,
> `S3_ACCESS_KEY`, `STRIPE_ENABLED`, `DYNAMODB_ENABLED` — que **no existen en el codigo**;
> seguirlos producia un deployment que no arranca.

```env
# === Entorno ===
NODE_ENV=production
APP_ENV=production
PORT=3001

# === Base de Datos ===
# Pooled para la app, direct para las migraciones de Prisma.
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require

# === Auth ===
AUTH_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -base64 32>
AUTH_TRUST_HOST=true
AUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
# El dominio padre de las dos puntas, para que la cookie de sesion cruce subdominios.
AUTH_COOKIE_DOMAIN=.tudominio.com

# === URLs ===
# API_BASE_URL debe ser la URL publica de la API: better-auth arma con ella el
# redirect_uri de OAuth. BETTER_AUTH_URL apunta al mismo lugar.
API_BASE_URL=https://linky-api.tudominio.com
BETTER_AUTH_URL=https://linky-api.tudominio.com
APP_FRONTEND_URL=https://links.tudominio.com
# Origenes que pueden mandar credenciales. Sin esto la API cae en los de lin.ky.
TRUSTED_ORIGINS=https://links.tudominio.com,https://linky-api.tudominio.com

# === Clave interna (API <-> frontend) ===
# La usa el puente de revalidacion de cache. Tiene que ser IDENTICA a la del
# proyecto de Vercel, o las paginas publicas no se invalidan y nadie avisa.
INTERNAL_API_KEY=<openssl rand -hex 32>

# === AWS S3 ===
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=sa-east-1
S3_BUCKET_NAME=linky-amalgama-uploads
CDN_URL=https://cdn.tudominio.com

# === Token de automatizacion (opcional) ===
# Deja que n8n o un script editen paginas y bloques sin sesion de browser.
# Actua como el usuario indicado, que debe ser miembro de la organizacion.
# Solo lo aceptan las rutas /pages y /blocks; billing y auth nunca.
LINKY_AUTOMATION_TOKEN=<openssl rand -hex 32>
LINKY_AUTOMATION_USER_ID=<id de la tabla "User">

# === Opcionales: si no estan, la feature se apaga sola ===
# Stripe: sin esta clave, todos los usuarios son premium y las rutas de
# billing quedan mockeadas (modo self-hosted).
# STRIPE_API_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# Reactions: sin tabla configurada, no se instancia el cliente de DynamoDB.
# REACTIONS_TABLE_NAME=
# SLACK_TOKEN=          # avisos de alta de usuario
# RESEND_API_KEY=       # email transaccional
# TINYBIRD_API_KEY=     # analytics de clicks
# SENTRY_DSN=           # error tracking
# POSTHOG_API_KEY=      # product analytics
```

### Inicializar base de datos

```bash
# Ejecutar migraciones de Prisma contra Neon
./scripts/init-db.sh
```

Si el script no existe o falla, correr manualmente:

```bash
# Desde el directorio del proyecto
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

### Deploy con Docker Compose

```bash
# Build y levantar los servicios
./scripts/deploy-api.sh
```

Si el script no existe, usar Docker Compose directamente:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

### Verificar que los containers estan corriendo

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f api
```

Deberia verse algo como:
```
api         | Server listening on 0.0.0.0:3001
cloudflared | Connection established
```

---

## 5. Frontend Deployment (Vercel)

El deploy del frontend es automatico una vez configurado Vercel (seccion 3i):

1. Cada push a `main` en GitHub dispara un build automatico
2. Vercel detecta el monorepo y buildea desde `apps/frontend`
3. Las env vars configuradas en Vercel se inyectan en build time

### Deploy manual (si es necesario)

```bash
# Instalar Vercel CLI
pnpm add -g vercel

# Desde la raiz del repo
vercel --prod
```

### Preview deploys

Cada pull request genera un preview deploy automatico en Vercel con una URL unica para testing.

---

## 6. Dominios Custom para Multiples Marcas

Linky soporta multiples dominios custom, ideal para las sub-marcas de Amalgama Gastronomica.

### Ejemplo de estructura

| Sub-marca | Dominio | Uso |
|-----------|---------|-----|
| Amalgama principal | `links.amalgamagastronomica.com` | Link-in-bio principal |
| Marca 1 | `links.marca1.com` | Link-in-bio de marca 1 |
| Marca 2 | `links.marca2.com` | Link-in-bio de marca 2 |
| Marca 3 | `bio.marca3.com` | Link-in-bio de marca 3 |

### Paso 1: Agregar dominio en Vercel

```
Vercel Dashboard → Project → Settings → Domains → Add
→ links.marca1.com
```

Vercel va a mostrar los DNS records necesarios.

### Paso 2: Configurar DNS del dominio de la marca

En el panel DNS de cada dominio (puede ser Cloudflare, GoDaddy, etc.):

```
Tipo:   CNAME
Nombre: links  (o bio, o el subdominio elegido)
Valor:  cname.vercel-dns.com
TTL:    Auto
```

> Si el dominio esta en Cloudflare, usar **DNS Only** (nube gris).

### Paso 3: Configurar trusted origins en la API

Agregar cada dominio nuevo a la variable de entorno `TRUSTED_ORIGINS` en `.env.production`:

```env
TRUSTED_ORIGINS=https://links.amalgamagastronomica.com,https://links.marca1.com,https://links.marca2.com,https://bio.marca3.com
```

Luego reiniciar la API:

```bash
cd /opt/linky
docker compose -f docker-compose.production.yml restart api
```

### Paso 4: Configurar CORS en S3

Agregar los nuevos origenes a la configuracion CORS del bucket S3 (seccion 3h).

### Paso 5: Actualizar Google OAuth

En Google Cloud Console, agregar los nuevos dominios como **Authorized redirect URIs** si las marcas usan login propio. Si todas comparten el mismo auth endpoint (`api.tudominio.com`), no es necesario.

---

## 7. Verificacion Post-Deployment

### Checklist

- [ ] **Health check de la API**: `curl https://api.tudominio.com/health` → `200 OK`
- [ ] **Tunnel conectado**: `docker logs cloudflared` muestra "Connection established"
- [ ] **Frontend carga**: `https://links.tudominio.com` muestra la landing page
- [ ] **OAuth login**: Click "Sign in with Google" → redirect → vuelve logueado
- [ ] **Usuario es premium**: Despues del login, verificar en la DB que el usuario tiene subscripcion premium (o que Stripe esta deshabilitado y todos son premium por defecto)
- [ ] **Crear pagina**: Login → crear nueva pagina → agregar bloques (link, texto, imagen)
- [ ] **Publicar pagina**: Publicar → verificar que la pagina publica es accesible
- [ ] **Subir imagen**: Agregar avatar o imagen → verificar que sube a S3
- [ ] **Dominio custom**: Si ya esta configurado, verificar que `links.marca.com/slug` resuelve correctamente
- [ ] **Tinybird analytics**: Visitar una pagina publica → verificar eventos en Tinybird dashboard
- [ ] **PostHog analytics**: Navegar por el frontend → verificar eventos en PostHog
- [ ] **Sentry errors**: Forzar un error → verificar que aparece en Sentry
- [ ] **Email**: Probar flujo que envia email (si aplica) → verificar llegada

### Comandos de verificacion rapida

```bash
# Health check API
curl -s https://api.tudominio.com/health | jq .

# Estado de containers
ssh arm-oracle-worker "cd /opt/linky && docker compose -f docker-compose.production.yml ps"

# Logs de la API (ultimas 50 lineas)
ssh arm-oracle-worker "cd /opt/linky && docker compose -f docker-compose.production.yml logs --tail=50 api"

# Logs del tunnel
ssh arm-oracle-worker "cd /opt/linky && docker compose -f docker-compose.production.yml logs --tail=20 cloudflared"

# Verificar conexion a Neon desde la API
ssh arm-oracle-worker "cd /opt/linky && docker compose -f docker-compose.production.yml exec api npx prisma db execute --stdin <<< 'SELECT 1'"
```

---

## 8. Mantenimiento

### Backups de Base de Datos

Neon tiene backups automaticos con point-in-time recovery (7 dias en free tier). Adicionalmente, configurar un backup manual:

```bash
# Backup manual con pg_dump
pg_dump "postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --format=custom \
  --file="/opt/linky/backups/linky-$(date +%Y%m%d-%H%M%S).dump"
```

Automatizar con cron:

```bash
# Editar crontab
crontab -e

# Backup diario a las 04:00
0 4 * * * /opt/linky/scripts/backup-db.sh >> /opt/linky/logs/backup.log 2>&1
```

### Actualizacion de la API

```bash
ssh arm-oracle-worker
cd /opt/linky

# Pull cambios
git pull origin main

# Rebuild y restart
docker compose -f docker-compose.production.yml up -d --build

# Verificar
docker compose -f docker-compose.production.yml logs -f api
```

O, mas corto:

```bash
./scripts/deploy-api.sh
```

> **Si el pull trae migraciones de Prisma, backup primero.** Son las unicas actualizaciones
> que no se revierten volviendo el codigo atras:
>
> ```bash
> DU=$(sudo grep -E "^DIRECT_URL=" /opt/linky/.env.production | cut -d= -f2- | tr -d '"')
> sudo docker run --rm -e PGURL="$DU" postgres:17-alpine sh -c 'pg_dump "$PGURL"' \
>   | gzip | sudo tee /opt/linky/backups/pre-sync-$(date +%Y%m%d_%H%M%S).sql.gz > /dev/null
> ```
>
> Y antes de reconstruir, etiquetar la imagen que esta corriendo para poder volver:
>
> ```bash
> sudo docker tag linky-api:latest linky-api:pre-$(date +%Y%m%d)
> ```

### Actualizacion del Frontend

El frontend se actualiza automaticamente con cada push a `main` via Vercel. No requiere accion manual.

### Monitoreo

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.production.yml logs -f

# Ver solo errores
docker compose -f docker-compose.production.yml logs -f api 2>&1 | grep -i error

# Estado de containers
docker compose -f docker-compose.production.yml ps

# Uso de recursos
docker stats --no-stream
```

### Limpieza periodica

```bash
# Limpiar imagenes Docker sin uso (ejecutar mensualmente)
docker image prune -f

# Limpiar backups viejos (mantener ultimos 30)
find /opt/linky/backups/ -name "*.dump" -mtime +30 -delete
```

---

## 9. Troubleshooting

### Cookie domain mismatch / Login no persiste

**Sintoma**: El usuario hace login con Google, la API responde correctamente pero la sesion no se mantiene al volver al frontend.

**Causa**: Las cookies de sesion requieren que `APP_URL` y `API_URL` esten en el mismo dominio raiz, o que la configuracion de cookies permita cross-domain.

**Solucion**:
1. Verificar que `APP_FRONTEND_URL` y `API_BASE_URL` cuelgan del mismo dominio raiz, y que
   `AUTH_COOKIE_DOMAIN` es ese dominio raiz con punto adelante (`.tudominio.com`).
2. Revisar que `TRUSTED_ORIGINS` incluye la URL del frontend.
3. Verificar que Cloudflare no esta strippeando headers `Set-Cookie`.

### Redirect loop entre el editor y el login

**Sintoma**: el login con Google termina bien, el cliente ve la sesion, pero al entrar a `/e`
el editor rebota a `/?redirectTo=...` y de ahi vuelve al editor, en loop. El chequeo de sesion
del **lado cliente** pasa y el del **lado servidor** falla.

**Causa**: los server components leen la sesion con
`getSession({ fetchOptions: { headers: await headers() } })`, es decir le reenvian a la API
**todos** los headers del request entrante, incluido `host: <dominio del frontend>`. Mandado a
la API, que vive en otro dominio, ese Host enruta el pedido de vuelta al frontend, que responde
404. La sesion vuelve vacia siempre.

**Diagnostico** (reproduce la falla en dos comandos):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://linky-api.tudominio.com/api/auth/get-session
# 200
curl -s -o /dev/null -w "%{http_code}\n" https://linky-api.tudominio.com/api/auth/get-session \
  -H "Host: links.tudominio.com"
# 404  <- el pedido nunca llego a la API
```

**Solucion**: reenviar solo la cookie, que es lo unico que el endpoint de sesion necesita. Ya
esta hecho en `apps/frontend/app/lib/auth.ts`; si alguien vuelve a pasar `headers()` entero,
el loop reaparece.

> Historia util: esto se habia diagnosticado como "el tunel devuelve respuestas mal
> descomprimidas" y se habia parcheado desactivando el chequeo de state, el `cookieCache` y el
> atributo `partitioned` de las cookies. Ninguno de esos tres hacia falta.

### El build pasa pero el deploy de Vercel falla

**Sintoma**: `next build` termina bien y el deployment queda en `Error`, con un mensaje sobre
el tamano de una Edge Function.

**Causa**: `app/[domain]/[slug]/opengraph-image.tsx` bundleado con `next/og` pesa ~1,06 MB, y
el plan Hobby de Vercel corta las Edge Functions en 1 MB. El limite se evalua al desplegar, no
al compilar.

**Solucion**: esa ruta declara `export const runtime = 'nodejs'`. Las funciones Node no tienen
ese techo. No volver a ponerla en `edge`.

### Errores de CORS

**Sintoma**: `Access-Control-Allow-Origin` error en la consola del browser.

**Solucion**:
1. Verificar `TRUSTED_ORIGINS` en `.env.production` incluye el dominio del frontend (con `https://`)
2. Verificar CORS en S3 si el error es al subir imagenes
3. Reiniciar la API despues de cambiar env vars:
   ```bash
   docker compose -f docker-compose.production.yml restart api
   ```

### Prisma migration failures

**Sintoma**: `init-db.sh` o `prisma migrate deploy` falla.

**Solucion**:
1. Verificar que `DIRECT_URL` (no pooled) es correcta y accesible:
   ```bash
   # Desde el servidor Oracle ARM
   psql "$DIRECT_URL" -c "SELECT 1"
   ```
2. Si hay migraciones pendientes con conflictos:
   ```bash
   npx prisma migrate resolve --applied "MIGRATION_NAME" \
     --schema=packages/database/prisma/schema.prisma
   ```
3. En caso extremo (DB nueva), resetear:
   ```bash
   npx prisma migrate reset --schema=packages/database/prisma/schema.prisma
   ```
   > **CUIDADO**: Esto borra todos los datos.

### sharp ARM64 issues

**Sintoma**: Error al procesar imagenes: `Could not load the "sharp" module` o similar en ARM64.

**Causa**: `sharp` necesita binarios nativos compilados para ARM64/linux.

**Solucion**:
1. Verificar que el Dockerfile instala sharp correctamente para la plataforma:
   ```dockerfile
   RUN npm install --platform=linux --arch=arm64 sharp
   ```
2. O agregar en `.env.production`:
   ```env
   SHARP_IGNORE_GLOBAL_LIBVIPS=1
   ```
3. Rebuild completo sin cache:
   ```bash
   docker compose -f docker-compose.production.yml build --no-cache api
   docker compose -f docker-compose.production.yml up -d api
   ```

### Cloudflare Tunnel no conecta

**Sintoma**: `cloudflared` muestra errores de conexion o la API no responde externamente.

**Solucion**:
1. Verificar el token:
   ```bash
   docker compose -f docker-compose.production.yml logs cloudflared
   ```
2. Si el token expiro, regenerar en Cloudflare Zero Trust y actualizar `.env.production`
3. Verificar que el servicio `api` esta en la misma red Docker que `cloudflared`:
   ```bash
   docker network ls
   docker compose -f docker-compose.production.yml exec cloudflared wget -q -O- http://api:3001/health
   ```
4. Si el tunnel conecta pero la API no responde, verificar que la API escucha en `0.0.0.0:3001` (no `127.0.0.1`)

### API responde pero muy lento

**Sintoma**: Requests tardan >2 segundos.

**Causa probable**: Latencia a Neon DB desde Oracle ARM.

**Solucion**:
1. Verificar latencia a Neon:
   ```bash
   # Desde Oracle ARM
   time psql "$DATABASE_URL" -c "SELECT 1"
   ```
2. Asegurar que se usa la connection string **pooled** (con `-pooler` en el host)
3. Considerar mover el proyecto Neon a la region mas cercana al Oracle ARM

### Frontend no buildea en Vercel

**Sintoma**: Build falla con errores de TypeScript o dependencias.

**Solucion**:
1. Verificar que todas las env vars necesarias estan en Vercel Settings
2. Las env vars con prefijo `NEXT_PUBLIC_` deben estar disponibles en build time
3. Revisar build logs en Vercel Dashboard para el error especifico
4. Si es error de monorepo, verificar que Root Directory esta en `apps/frontend`

---

## Apendice: Variables de Entorno Completas

### API (.env.production)

```env
# Database
DATABASE_URL=
DIRECT_URL=

# Auth
BETTER_AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# URLs
APP_URL=
API_URL=
FRONTEND_URL=
TRUSTED_ORIGINS=

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=

# AWS S3
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=

# Email
RESEND_API_KEY=
RESEND_AUDIENCE_ID=

# Analytics
TINYBIRD_API_KEY=
SENTRY_DSN=

# Disabled features
STRIPE_ENABLED=false
DYNAMODB_ENABLED=false
```

### Frontend (Vercel env vars)

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_TINYBIRD_TRACKER_TOKEN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```
