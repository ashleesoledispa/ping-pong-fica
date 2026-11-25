# Torneo de Ping Pong por Fiestas de Quito · ASE UDLA FICA

Página de inscripción del torneo **1 vs 1**. Incluye:

- Portada con la información del torneo.
- Formato eliminatorio y reglamento.
- Premios.
- Formulario individual con ID Banner y subida del comprobante.
- **Panel secreto** de administración.

**Cómo se guardan los datos**

- **En tu computadora:** funciona sin configurar nada. Los datos se guardan en la carpeta `storage/`.
- **En Vercel:** usa **Supabase**. La base de datos guarda las inscripciones y Storage guarda los comprobantes.
- **Dependencias:** ninguna. No hace falta `npm install`.

---

## 1. Probarlo en tu computadora (VS Code)

1. Necesitas **Node.js 20.12 o superior**. Para comprobarlo, escribe `node -v` en la terminal.
2. Abre la carpeta `torneo-pingpong-fica` en VS Code.
3. En la terminal, ejecuta:
   ```bash
   npm start
   ```
4. Abre en el navegador:
   - Página: http://localhost:3000
   - Formulario: http://localhost:3000/inscripcion
   - **Panel:** http://localhost:3000/admin (usuario `Ashlee22`, contraseña `ashlee22`)

El panel no aparece en el menú. Para entrar, ve directo a `/admin` o haz **3 clics seguidos en la pelotita blanca** del pie de página, junto a "¡Que viva Quito!".

---

## 2. Publicarlo: GitHub → Supabase → Vercel

### Paso A · Supabase (base de datos + comprobantes)
1. Entra a https://supabase.com y crea un proyecto nuevo.
2. Ve a **SQL Editor → New query**. Pega todo el contenido de `supabase.sql` y presiona **Run**.
   Esto crea la tabla `inscripciones` y el bucket privado `comprobantes`.
3. Ve a **Project Settings → API Keys** y copia dos datos:
   - **Project URL** (algo como `https://xxxx.supabase.co`). Aparece en Settings → Data API.
   - La clave **`service_role`** (pestaña *Legacy API keys*) o una **Secret key**.
   ⚠️ Esta clave es secreta: va solo en Vercel. Nunca la pongas en el código ni la subas a GitHub.

### Paso B · GitHub
Sube la carpeta a un repositorio. Puede ser privado. El `.gitignore` ya excluye `.env` y `storage/`.

### Paso C · Vercel
1. Ve a **Add New → Project** e importa el repositorio.
2. En *Framework Preset*, deja **Other**. No cambies Build ni Output: `vercel.json` ya los configura.
3. En **Environment Variables**, agrega:

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | la Project URL de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clave service_role / secret |
   | `ADMIN_USER` | `Ashlee22` |
   | `ADMIN_PASS` | `ashlee22`, o mejor una contraseña más segura |
   | `SESSION_SECRET` | cualquier texto largo y aleatorio |

4. Presiona **Deploy**. El panel quedará en `https://tu-proyecto.vercel.app/admin`.

> Si cambias variables después, ve a **Deployments → ⋯ → Redeploy** para que se apliquen.

**Para revisar que todo quedó bien:** abre `https://tu-proyecto.vercel.app/api/config`. Debe mostrar algo como `{"abierto":true,...,"inscritos":0,"cupoMaximo":64}`.
Si sale un error de Supabase, revisa las variables y que hayas corrido el SQL.

---

## 3. Logos e imágenes

| Qué | Dónde | Nombre exacto |
|---|---|---|
| Logo ASE UDLA | `public/assets/logos/` | `logo-ase-udla.png` |
| Logo FICA | `public/assets/logos/` | `logo-fica.png` |
| Imagen de premios (opcional) | `public/assets/premio/` | `premio.png` |

Usa versiones **blancas con fondo transparente**. Mientras no existan los archivos, se ve un recuadro punteado en su lugar.

---

## 4. Configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `REG_DEADLINE` | Cierre de inscripciones | `2026-11-30T23:59:59-05:00` (lunes 30, 23:59) |
| `MAX_CUPOS` | Cupos máximos (0 = sin límite) | `64` |
| `PRECIO` | Valor para el total recaudado | `2.5` |
| `EMAIL_DOMAIN` | Dominio obligatorio del correo | `udla.edu.ec` |

Al llegar la fecha de cierre o llenarse los 64 cupos, el formulario se bloquea solo.
Las inscripciones **rechazadas** no ocupan cupo.

---

## 5. Uso del panel

- Ver cada inscripción con nombre, correo, ID Banner, celular, carrera y comprobante.
- Marcar como **Confirmada**, **Pendiente** o **Rechazada**.
- Botón **Confirmar por WhatsApp**: abre el chat con el jugador y un mensaje ya escrito.
- Notas internas, búsqueda, filtros, cupos usados y total recaudado.
- **Excel (CSV):** descarga todas las inscripciones.

No se permite que un mismo correo o ID Banner tenga dos inscripciones activas.

---

## Estructura

```
torneo-pingpong-fica/
├── api/index.js           ← función de Vercel (API)
├── lib/
│   ├── app.js             ← lógica de la API
│   ├── store-local.js     ← guardado en archivos (tu compu)
│   └── store-supabase.js  ← guardado en Supabase (Vercel)
├── public/                ← páginas, estilos, scripts e imágenes
├── server.js              ← servidor local (npm start)
├── supabase.sql           ← tabla y bucket para Supabase
├── vercel.json
└── .env.example
```
