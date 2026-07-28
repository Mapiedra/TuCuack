# Configurar el chat de TuCuack

El chat entre patos necesita un proyecto de **Supabase**. Sin él la app funciona con
normalidad (el pato camina, se cuida, se lanza…), pero la opción *Hablar…* no envía
nada.

Esta guía cubre los cuatro entornos: tu equipo, el CI, el instalador que reparten y
una instalación ya hecha.

---

## Paso 0 — Crear el proyecto en Supabase

Se hace una sola vez, y sirve para todos los entornos.

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta.
2. **New project**. Ponle nombre, contraseña de base de datos (no se usa, pero la
   pide) y la región más cercana. El plan **Free** sobra: sólo se usa Realtime.
3. Espera a que termine de aprovisionarse (~1 min).
4. Ve a **Project Settings → API Keys** y copia dos cosas:

   | Dato | Aspecto |
   |---|---|
   | **Project URL** | `https://abcdefghijklmnop.supabase.co` |
   | **Publishable key** | `sb_publishable_xxxxxxxxxxxxxxxx` |

> **No** hace falta crear tablas, ni activar Realtime, ni tocar RLS: el chat usa
> *broadcast*, que son mensajes efímeros y el canal se crea solo al conectarse.
>
> La *publishable key* sustituye a la antigua *anon key*. Si tu proyecto es viejo y
> sólo tienes la `anon key`, sirve igual (ponla como `"anonKey"`), pero la app avisará
> de que conviene migrar.

---

## Entorno 1 — Tu equipo (desarrollo)

Edita el fichero `supabase.json` de la raíz del proyecto (ya viene creado):

```json
{
  "url": "https://abcdefghijklmnop.supabase.co",
  "publishableKey": "sb_publishable_xxxxxxxxxxxxxxxx"
}
```

Reinicia con `npm start`. Está en `.gitignore`, así que **no se sube al repositorio**.

<details>
<summary>Alternativa: variables de entorno</summary>

Útil si prefieres no tener el fichero, o para lanzar con credenciales distintas:

```bash
SUPABASE_URL=https://abcdefghijklmnop.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx \
npm start
```

Las variables de entorno tienen prioridad sobre el fichero.
</details>

**Comprobar que funciona:** abre *Ajustes* con clic derecho sobre el pato. Si debajo
del nombre pone *«Se muestra en los bocadillos del chat»*, hay conexión. Si dice
*«Chat sin configurar…»*, las credenciales no se están leyendo.

---

## Entorno 2 — CI (GitHub Actions)

Aquí está la pregunta habitual: *si el fichero está ignorado, ¿cómo llega al
instalador?* El workflow **lo genera en el runner** justo antes de compilar, leyendo
los secrets del repositorio. Nunca pasa por el repositorio.

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**, y
crea estos dos:

| Nombre del secret | Valor |
|---|---|
| `SUPABASE_URL` | la Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | la publishable key |

Ya está. A partir de ahí, cada release que publiques llevará el chat activado.

Si **no** defines los secrets el build no falla: publica una versión sin chat.

---

## Entorno 3 — El instalador que reparten a otros

Quien instale el `.exe` **no tiene que configurar nada**: las credenciales van dentro.

Para publicar una versión:

```bash
# 1. sube la versión en package.json y anota los cambios en CHANGELOG.md
# 2. crea y sube el tag
git tag v0.1.0
git push origin v0.1.0
```

El workflow compila, crea el **GitHub Release** y sube el instalador junto con
`latest.yml`. Las instalaciones existentes detectan la nueva versión al arrancar, la
descargan en segundo plano y la aplican al reiniciar.

> **Importante:** para que dos personas se vean en el chat, sus dos instalaciones
> deben llevar **las mismas credenciales**, es decir salir del mismo Release (o
> compartir el mismo proyecto de Supabase).

> **Sobre la privacidad:** la clave viaja dentro del instalador, así que quien lo
> descargue puede extraerla. Es aceptable porque es pública por diseño, pero implica
> que cualquiera con ella puede entrar al canal. Si necesitas restringirlo, el paso
> siguiente es añadir autenticación de Supabase y Realtime Authorization.

---

## Entorno 4 — Cambiar las credenciales de una instalación ya hecha

Sin reinstalar ni recompilar: crea un `supabase.json` en la carpeta de datos de la app,
que tiene **prioridad** sobre el que trae el instalador.

En Windows:

```
%APPDATA%\TuCuack\supabase.json
```

(pega esa ruta en el explorador). Mismo formato que siempre. Reinicia TuCuack.

Útil para apuntar a otro proyecto de Supabase, para probar un canal aparte, o para
activar el chat en una versión que se compiló sin él.

---

## Orden de prioridad

Cuando hay varias fuentes, gana la primera que esté completa:

1. Variables de entorno `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
2. `%APPDATA%\TuCuack\supabase.json` (carpeta de datos del usuario)
3. El fichero empaquetado dentro de la app instalada
4. `supabase.json` en la raíz del proyecto (desarrollo)

Los ficheros que aún tienen los valores de ejemplo (`TU-PROYECTO`, `TU_CLAVE…`) se
ignoran, así que no dan errores de conexión falsos.

---

## Comprobar que dos patos se hablan

1. Abre TuCuack en dos equipos (o en dos cuentas de Windows) con las mismas
   credenciales.
2. En cada uno, clic derecho → **Ajustes** y pon un **nombre distinto**. Si eliges uno
   ya ocupado, el panel avisa: *«Ya hay un pato llamado X»*.
3. Clic derecho → **Hablar…**, escribe y pulsa Enter.
4. El mensaje aparece en un bocadillo sobre tu pato **y** sobre el del otro equipo, con
   el nombre de quien lo envió.

---

## Si algo no va

| Síntoma | Causa probable |
|---|---|
| Ajustes dice *«Chat sin configurar»* | El fichero no se encuentra o sigue con los valores de ejemplo. Revisa la ruta y que el JSON sea válido. |
| Configurado, pero no llegan mensajes | Las dos instalaciones apuntan a proyectos de Supabase distintos. |
| No avisa de nombres repetidos | La comprobación necesita conexión: sin chat no se puede saber qué nombres hay. |
| El instalador salió sin chat | Faltaban los secrets al lanzar esa release. Añádelos y publica un tag nuevo. |
| Aviso de *anon key* antigua | Estás usando `anonKey`; funciona, pero cámbiala por `publishableKey`. |

Para ver los mensajes de diagnóstico, lanza con `npm run dev`: la consola indica de
dónde ha leído las credenciales y el estado de la conexión.
