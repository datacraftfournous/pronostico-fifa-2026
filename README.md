# Polla FIFA 2026

App web gratuita para pronósticos del Mundial FIFA 2026 entre amigos y familiares.

## Características

- Login con usuario y contraseña
- Cada participante edita sus pronósticos partido a partido
- Bloqueo automático al inicio del partido (hora Colombia)
- Ranking en tiempo real
- Panel admin para crear usuarios, partidos y marcar resultados reales
- Sistema de puntuación de hasta 5 puntos por partido

## Requisitos

- [Node.js](https://nodejs.org) (versión 18 o superior)
- Cuenta gratis en [Supabase](https://supabase.com)

## Configuración paso a paso

### 1. Instalar dependencias

```bash
cd polla-fifa-2026
npm install
```

### 2. Configurar Supabase

1. Entra a tu proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** → **New query**
3. Copia y pega todo el contenido de `supabase/schema.sql`
4. Haz clic en **Run**

### 3. Desactivar confirmación de email (importante)

Para que puedas crear usuarios desde el panel admin:

1. Supabase → **Authentication** → **Providers** → **Email**
2. Desactiva **Confirm email**
3. Guarda

### 4. Crear usuario admin Beto

1. Supabase → **Authentication** → **Users** → **Add user**
2. Email: `beto@polla2026.local`
3. Password: `Loc.30320` (o la que prefieras)
4. Marca **Auto Confirm User**
5. En **User Metadata** (JSON), agrega:

```json
{
  "username": "beto",
  "display_name": "Beto",
  "role": "admin"
}
```

6. Si el perfil no se creó solo, ejecuta en SQL Editor:

```sql
insert into public.profiles (id, username, display_name, role)
select id, 'beto', 'Beto', 'admin'
from auth.users
where email = 'beto@polla2026.local'
on conflict (id) do update set role = 'admin';
```

### 5. Ejecutar la app localmente

```bash
npm run dev
```

Abre http://localhost:5173 e ingresa:
- **Usuario:** Beto
- **Contraseña:** Loc.30320

## Publicar gratis en internet (Vercel)

1. Crea cuenta en [vercel.com](https://vercel.com)
2. Sube el proyecto a GitHub (o conecta la carpeta)
3. En Vercel, importa el proyecto
4. Agrega las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy → comparte el link con tus 20 participantes

## Reglas de puntuación

| Criterio | Puntos |
|----------|--------|
| Marcador exacto | +1 |
| Ganador o empate | +1 |
| Goles del local | +1 |
| Goles del visitante | +1 |
| Diferencia de goles (si acertó ganador) | +1 |

**Máximo: 5 puntos por partido**

## Uso diario

1. **Admin (Beto):** crea cuentas para los 19 participantes en Admin → Usuarios
2. **Admin:** carga los partidos del calendario en Admin → Partidos
3. **Participantes:** entran al link, van a "Mis pronósticos" y rellenan
4. **Admin:** al terminar cada partido, marca el resultado en Admin → Resultados
5. Todos ven el ranking actualizado automáticamente

## Estructura del proyecto

```
polla-fifa-2026/
├── src/
│   ├── components/   # Layout, MatchCard
│   ├── context/      # Auth
│   ├── lib/          # Supabase, puntuación
│   └── pages/        # Login, Ranking, Pronósticos, Admin, Reglas
├── supabase/
│   └── schema.sql    # Script de base de datos
└── .env              # Credenciales (no subir a GitHub)
```
