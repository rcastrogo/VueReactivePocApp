# Resumen: Implementación de OAuth 2.0 con Google

## 1. Contexto del proyecto

* Aplicación desarrollada con **Vanilla JavaScript**, sin frameworks ni librerías externas en el frontend.
* Despliegue en **Vercel**.
* Directorio `/api` para funciones serverless.
* Base de datos **PostgreSQL en Neon** para almacenar usuarios y sesiones.

El objetivo es permitir que los usuarios inicien sesión con Google de forma segura.

---

# 2. Flujo general de autenticación

El proceso completo funciona así:

```text
1. El usuario pulsa «Iniciar sesión con Google».
                    ↓
2. Tu frontend lo redirige a Google.
                    ↓
3. El usuario autoriza el acceso.
                    ↓
4. Google devuelve un código temporal a Vercel.
                    ↓
5. Vercel intercambia el código por tokens.
                    ↓
6. Vercel obtiene los datos del usuario desde Google.
                    ↓
7. Guarda o actualiza al usuario en Neon.
                    ↓
8. Vercel crea una sesión para ese usuario.
                    ↓
9. El navegador recibe una cookie de sesión.
                    ↓
10. El usuario accede a las partes privadas de tu aplicación.
```

**Google verifica la identidad. Tu aplicación gestiona la sesión.**



---

# 3. Pasos que debes realizar

## PASO 1. Configurar Google Cloud

Debes crear y configurar un proyecto en Google Cloud.

Necesitas:

* Crear las credenciales OAuth 2.0.
* Obtener un `GOOGLE_CLIENT_ID`.
* Obtener un `GOOGLE_CLIENT_SECRET`.
* Configurar las URI de redireccionamiento autorizadas.

Ejemplos:

* Local: `http://localhost:3000/api/auth/callback`
* Producción: `https://tu-dominio.com/api/auth/callback`

⚠️ La URL de producción debe ser la dirección real de tu aplicación, no simplemente `https://vercel.app`.

---

## PASO 2. Crear la tabla de usuarios en Neon

Esta tabla almacenará la información básica de los usuarios que inicien sesión.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ¿Qué almacena cada campo?

| Campo        | Función                                   |
| ------------ | ----------------------------------------- |
| `id`         | Identificador interno de tu aplicación    |
| `google_id`  | Identificador único del usuario en Google |
| `email`      | Correo electrónico                        |
| `name`       | Nombre del usuario                        |
| `picture`    | URL de su foto de perfil                  |
| `created_at` | Fecha de creación del registro            |

El `google_id` permite reconocer al mismo usuario aunque cambie su nombre.

---

## PASO 3. Crear el botón de inicio de sesión

En tu frontend, debes crear un botón que redirija al usuario a Google.

La URL de autorización debe incluir:

* `client_id`: identifica tu aplicación.
* `redirect_uri`: indica dónde debe devolver Google al usuario.
* `response_type=code`: solicita un código de autorización.
* `scope`: permisos solicitados.
* `state`: valor aleatorio para proteger el proceso contra ataques CSRF.

Google mostrará la pantalla de inicio de sesión y autorización.

---

## PASO 4. Crear el callback en Vercel

Archivo:

```text
/api/auth/callback.js
```

Esta función recibe el código que Google devuelve después de la autorización.

### ¿Qué hace?

#### 1. Recibe el código

Google redirige al usuario a una URL similar a esta:

```text
/api/auth/callback?code=CODIGO_TEMPORAL
```

El código:

* Es temporal.
* Solo puede utilizarse una vez.
* No contiene directamente todos los datos del usuario.

#### 2. Comprueba el parámetro `state`

Tu servidor debe comprobar que el `state` recibido coincide con el generado al iniciar el proceso.

Esto ayuda a evitar ataques CSRF.

#### 3. Intercambia el código por tokens

Tu backend realiza una petición a Google enviando:

* `code`
* `client_id`
* `client_secret`
* `redirect_uri`
* `grant_type=authorization_code`

Google devuelve, según la configuración:

* `access_token`: permite acceder a las APIs autorizadas.
* `id_token`: contiene información sobre la identidad del usuario, cuando se solicita.
* `expires_in`: duración del token de acceso.

🔐 **El `client_secret` debe permanecer siempre en el servidor.**

---

## PASO 5. Obtener los datos del usuario

Con el `access_token`, tu backend solicita a Google los datos del perfil.

Puede recibir información como:

```json
{
  "id": "123456789",
  "email": "usuario@gmail.com",
  "verified_email": true,
  "name": "Juan Pérez",
  "picture": "https://..."
}
```

Estos datos se utilizan para identificar al usuario en tu aplicación.

---

## PASO 6. Guardar o actualizar el usuario en Neon

Tu backend almacena los datos obtenidos de Google en la tabla `users`.

Si el usuario ya existe, se actualizan sus datos.

Esto se consigue mediante un **UPSERT**:

```sql
INSERT INTO users (google_id, email, name, picture)
VALUES (${profile.id}, ${profile.email}, ${profile.name}, ${profile.picture})
ON CONFLICT (google_id) 
DO UPDATE SET name = ${profile.name}, picture = ${profile.picture}
RETURNING id; -- Recuperamos el ID autogenerado por nuestra base de datos
```

### Resultado

* Si es un usuario nuevo → se crea un registro.
* Si ya existe → se actualiza su información.

Al finalizar, recuperas el `id` interno de tu usuario.

Ejemplo:

```text
Google ID: 123456789
        ↓
users.id = 25
```

---

# 4. Crear un sistema de sesiones seguro

Una vez identificado el usuario, tu aplicación necesita recordar que ha iniciado sesión.

Para ello, debes crear una tabla `sessions`.

## PASO 7. Crear la tabla de sesiones

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ¿Qué relaciona esta tabla?

| Campo        | Función                            |
| ------------ | ---------------------------------- |
| `id`         | Identificador único de la sesión   |
| `user_id`    | Usuario al que pertenece la sesión |
| `expires_at` | Fecha de caducidad                 |
| `created_at` | Fecha de creación                  |

La relación sería:

```text
Google
   │
   │ google_id
   ▼
users
   │
   │ users.id
   ▼
sessions
   │
   │ sessions.id
   ▼
Cookie del navegador
```

### Ejemplo práctico

```text
Google ID: 123456789
      ↓
users.id = 25
      ↓
sessions.id = "uuid-aleatorio"
      ↓
Cookie: session_token="uuid-aleatorio"
```

La cookie identifica la sesión, no directamente al usuario.

---

# 5. Generar el identificador de sesión

En Node.js puedes utilizar el módulo nativo `crypto`.

```javascript
import crypto from 'crypto';

const sessionId = crypto.randomUUID();
```

Esto genera un identificador único, por ejemplo:

```text
550e8400-e29b-41d4-a716-446655440000
```

Después:

1. Generas el identificador.
2. Lo relacionas con `users.id`.
3. Lo guardas en `sessions`.
4. Lo envías al navegador mediante una cookie.

Puedes establecer, por ejemplo, una duración de 7 días.

---

# 6. Enviar la cookie al navegador

El servidor envía una cookie de sesión mediante `Set-Cookie`.

Ejemplo conceptual:

```text
Set-Cookie:
session_token=UUID_DE_SESION;
HttpOnly;
Secure;
SameSite=Lax;
Max-Age=604800;
Path=/
```

### ¿Qué significa cada atributo?

| Atributo       | Función                                  |
| -------------- | ---------------------------------------- |
| `HttpOnly`     | Impide que JavaScript lea la cookie      |
| `Secure`       | Solo permite enviarla mediante HTTPS     |
| `SameSite=Lax` | Reduce determinados riesgos de CSRF      |
| `Max-Age`      | Define cuánto dura la cookie             |
| `Path=/`       | Permite utilizarla en toda la aplicación |

⚠️ La cookie no debe considerarse «encriptada». Es un identificador aleatorio que debe ser difícil de adivinar.

---

# 7. Comprobar si el usuario está autenticado

## PASO 8. Crear `/api/auth/me.js`

Esta función se encarga de comprobar si existe una sesión válida.

### Flujo

```text
Frontend
   │
   │ GET /api/auth/me
   ▼
Vercel
   │
   │ Lee la cookie session_token
   ▼
Busca la sesión en Neon
   │
   │ Comprueba que no haya caducado
   ▼
Busca los datos del usuario
   │
   ▼
Devuelve la información al frontend
```

La consulta relaciona ambas tablas:

```sql
SELECT u.id, u.email, u.name, u.picture, s.expires_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.id = $1
  AND s.expires_at > NOW();
```

### Si la sesión es válida

Devuelve algo similar a:

```json
{
  "authenticated": true,
  "user": {
    "id": 25,
    "name": "Juan Pérez",
    "email": "usuario@gmail.com",
    "picture": "https://..."
  }
}
```

### Si la sesión no existe o ha caducado

Devuelve:

```json
{
  "authenticated": false
}
```

El frontend decide entonces si muestra la aplicación privada o el botón de inicio de sesión.

---

# 8. ¿Qué ocurre con los tokens de Google?

Para un inicio de sesión básico, **no necesitas guardar los tokens de Google en Neon**.

| Dato            | ¿Dónde se utiliza?                            |
| --------------- | --------------------------------------------- |
| `code`          | Se recibe temporalmente en el callback        |
| `access_token`  | Se utiliza para acceder a APIs autorizadas    |
| `id_token`      | Puede aportar información de identidad        |
| `google_id`     | Se guarda en `users`                          |
| `users.id`      | Identifica al usuario dentro de tu aplicación |
| `session.id`    | Identifica la sesión del navegador            |
| `session_token` | Se almacena en la cookie del navegador        |

Si en el futuro quieres acceder al calendario, Gmail u otras APIs de Google, podrías necesitar guardar un `refresh_token`.

En ese caso, deberías:

* Cifrarlo antes de almacenarlo.
* Proteger las claves de cifrado.
* Limitar su acceso.
* Gestionar su revocación y renovación.

---

# 9. Medidas de seguridad imprescindibles

Antes de utilizar este sistema en producción, debes tener en cuenta:

### ✅ 1. Protección CSRF

Utilizar y validar correctamente el parámetro `state`.

### ✅ 2. Sesiones aleatorias

No guardar directamente el ID numérico del usuario en la cookie.

### ✅ 3. Cookies seguras

Utilizar `HttpOnly`, `Secure` y una configuración adecuada de `SameSite`.

### ✅ 4. Variables de entorno

Guardar en Vercel:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DATABASE_URL
```

No incluir secretos en el frontend.

### ✅ 5. Control de sesiones

Implementar:

* Caducidad de sesiones.
* Cierre de sesión.
* Revocación de sesiones cuando sea necesario.
* Eliminación de sesiones antiguas.

### ✅ 6. Validación de tokens y respuestas

Comprobar los errores de Google y validar correctamente las respuestas recibidas.

---

# 10. ¿Es gratuito Google OAuth 2.0?

El uso básico de OAuth 2.0 para iniciar sesión con Google no requiere pagar por cada inicio de sesión.

Sin embargo:

* Google puede imponer restricciones a las aplicaciones en desarrollo o no verificadas.
* Las aplicaciones que solicitan determinados permisos pueden estar sujetas a procesos de verificación.
* Otros servicios de Google Cloud pueden requerir facturación.

**La disponibilidad de determinadas funciones y límites debe comprobarse en la configuración actual de Google.**

---

# 📌 Resumen final: qué tienes que construir

| Orden | Elemento                | Función                            |
| ----- | ----------------------- | ---------------------------------- |
| 1     | Google Cloud            | Crear las credenciales OAuth       |
| 2     | Tabla `users`           | Guardar los usuarios               |
| 3     | Botón de login          | Iniciar el proceso OAuth           |
| 4     | `/api/auth/callback.js` | Recibir el código de Google        |
| 5     | Google Token API        | Intercambiar el código por tokens  |
| 6     | Google UserInfo API     | Obtener los datos del usuario      |
| 7     | Neon PostgreSQL         | Guardar o actualizar el usuario    |
| 8     | Tabla `sessions`        | Relacionar usuarios y sesiones     |
| 9     | `crypto.randomUUID()`   | Generar sesiones aleatorias        |
| 10    | Cookie `session_token`  | Recordar la sesión del navegador   |
| 11    | `/api/auth/me.js`       | Comprobar si hay una sesión válida |
| 12    | Logout                  | Eliminar o invalidar la sesión     |

### 🔑 Idea fundamental

**Google confirma quién es el usuario. Neon guarda quién es ese usuario. La tabla `sessions` relaciona al usuario con una sesión. La cookie permite que el navegador mantenga esa sesión.**

Este es el esquema general que debes implementar para completar la autenticación.



A continuación, tienes la estructura de la base de datos y el flujo exacto de código para conectar el ID de Google, tu ID de usuario y el ID de sesión.
1. El modelo de datos en Neon (PostgreSQL)
Necesitas dos tablas. La tabla de users (que ya mapea el ID de Google con tu ID secuencial) y la tabla sessions (que mapea tu ID de usuario con el token del navegador).
Ejecuta esto en tu consola de Neon:
sql
-- 1. Tabla de Usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Sesiones (La relación)
CREATE TABLE sessions (
    id UUID PRIMARY KEY, -- Usamos un UUID como ID de sesión único
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Relación directa con tu tabla de usuarios
    expires_at TIMESTAMP NOT NULL, -- Fecha de caducidad de la sesión
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Usa el código con precaución.
￼
2. Guardar y Relacionar todo en el Callback (/api/auth/callback.js)
Modificamos el Paso 5 de tu función serverless. Tras recibir los datos de Google, generamos el identificador único con crypto.randomUUID() [1] y guardamos la relación en Neon.
javascript
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto'; // Módulo nativo de Node.js (Sin librerías externas)

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Falta el código' });

  const sql = neon(process.env.DATABASE_URL);
  const redirectUri = `${req.headers['x-forwarded-proto']}://${req.headers['host']}/api/auth/callback`;

  try {
    // [PASO A] Intercambio de tokens con Google (Omitido por brevedad, igual al anterior)
    // ... tu fetch a google/token ...
    // ... tu fetch a google/userinfo para obtener 'profile' ...

    // [PASO B] Guardar/Actualizar usuario y obtener el ID interno de tu tabla (id)
    const [user] = await sql`
      INSERT INTO users (google_id, email, name, picture)
      VALUES (${profile.id}, ${profile.email}, ${profile.name}, ${profile.picture})
      ON CONFLICT (google_id) 
      DO UPDATE SET name = ${profile.name}, picture = ${profile.picture}
      RETURNING id; -- Recuperamos el ID autogenerado por nuestra base de datos
    `;

    // [PASO C] Generar el identificador de sesión único (UUID)
    const sessionId = crypto.randomUUID(); // Genera una cadena única tipo '123e4567-e89b-12d3-a456-426614174000'
    
    // Definimos que la sesión expire en 7 días en la base de datos
    const daysToExpire = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToExpire);

    // [PASO D] Relacionar en Neon: Guardamos el sessionId vinculado al user.id
    await sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (${sessionId}, ${user.id}, ${expiresAt});
    `;

    // [PASO E] Enviar el ID de sesión al navegador en una Cookie encriptada por el navegador
    const cookieMaxAge = daysToExpire * 24 * 60 * 60; // Convertido a segundos
    res.setHeader('Set-Cookie', `session_token=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${cookieMaxAge}`);
    
    // Redirección final
    res.writeHead(302, { Location: '/' });
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
Usa el código con precaución.
￼
3. Recuperar los datos del usuario usando el ID de sesión (/api/auth/me.js)
Cuando el usuario entra a tu web, tu frontend (Vanilla JS) hace un fetch('/api/auth/me'). El navegador envía la cookie automáticamente de forma interna. Tu función serverless lee el sessionId, busca en la tabla intermedia y obtiene los datos del usuario:
javascript
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // 1. Extraer el session_token de las cookies
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/session_token=([^;]+)/);
  
  if (!match) return res.status(401).json({ authenticated: false });
  const sessionId = match[1];

  const sql = neon(process.env.DATABASE_URL);

  try {
    // 2. Consulta Relacional (JOIN): Buscamos la sesión y traemos los datos del usuario
    const [sessionData] = await sql`
      SELECT u.id, u.email, u.name, u.picture, s.expires_at 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${sessionId} AND s.expires_at > NOW();
    `;

    // Si la sesión no existe o ya caducó (expires_at es menor que NOW())
    if (!sessionData) {
      // Opcional: Podrías borrar la cookie vieja aquí
      return res.status(401).json({ authenticated: false, message: "Sesión inválida o expirada" });
    }

    // 3. Responder al frontend con los datos limpios del usuario
    res.status(200).json({
      authenticated: true,
      user: {
        id: sessionData.id,
        name: sessionData.name,
        email: sessionData.email,
        picture: sessionData.picture
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
}
