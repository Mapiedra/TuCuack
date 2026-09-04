-- Marcador global de TuCuack.
--
-- Se ejecuta en el editor SQL del panel de Supabase del proyecto. Es
-- idempotente: se puede volver a lanzar entero sin romper nada.
--
--
-- El problema que resuelve, y por qué está hecho así
-- --------------------------------------------------
--
-- El pato se conecta con la clave PUBLICABLE, que viaja dentro de la app. O sea
-- que la tiene cualquiera que instale TuCuack. Con eso, unas políticas de fila
-- normales no protegen nada: no hay `auth.uid()` contra el que comparar, así que
-- «sólo puedes escribir en tu fila» es inverificable —el cliente dice quién es y
-- el servidor se lo cree—. Cualquiera podría inflar el récord de otro, y como
-- las marcas sólo suben, ese destrozo sería permanente.
--
-- Así que escribir no lo puede hacer nadie directamente. La única puerta es
-- `guardar_record`, una función `security definer`. Y la clave del asunto está
-- en CÓMO se identifica una fila:
--
--   **El dueño de una fila es el HASH de su secreto.**
--
-- No el `patoId`. Esto importa mucho y es el segundo intento: en el primero la
-- fila iba por `patoId` y se guardaba aparte el hash del secreto para
-- comprobarlo. Pero el `patoId` VIAJA EN LA PRESENCIA DEL CANAL —cualquiera que
-- esté conectado ve el de los demás— así que se podía coger el de otro y
-- reclamar sus filas ANTES de que él jugara a ese juego, dejándole sin marcador
-- para siempre. Con el dueño derivado del secreto, reclamar la fila de alguien
-- exige saber su secreto, y el secreto no sale del disco de su dueño.
--
-- El secreto lo genera el pato la primera vez y lo guarda en sus ajustes. No es
-- una identidad de verdad —quien borre sus ajustes pierde sus filas para
-- siempre, y dos ordenadores del mismo dueño son dos identidades— pero impide lo
-- único que de verdad haría daño: que alguien reviente el marcador de los demás.
-- Nadie puede bajar una marca, ni borrar una fila, ni tocar la de otro.
--
-- Y eso vale también para nosotros desde la app: NO hay forma de borrar una fila
-- con la clave publicable, ni siquiera una de pruebas. Limpiar se hace desde el
-- panel, que va con `service_role` y se salta el RLS. Conviene saberlo antes de
-- ponerse a probar contra la tabla de verdad.
--
-- Lo que NO impide, y hay que decirlo en la interfaz: que alguien declare una
-- marca que no ha hecho. Sin un servidor que juegue la partida eso no se puede
-- comprobar, así que el marcador enseña siempre el nombre de quien la declara.
--
--
-- Sobre los avisos del panel
-- --------------------------
--
--   * «Security Definer View» — ya no sale: la vista va con `security_invoker`,
--     así que no añade permisos a nadie.
--   * «RLS Enabled No Policy» — ya no sale: hay política de lectura.
--   * «Public / Signed-In Users Can Execute SECURITY DEFINER Function» — ese SÍ
--     sale, y es **a propósito**. Esa función ES la puerta de escritura, y tiene
--     que poder llamarla el pato, que se conecta como `anon`. Quitarle el
--     `execute` deja el marcador de sólo lectura para siempre; ponerla en
--     `security invoker` la deja sin permiso para escribir en su propia tabla.
--     Lo que hace que sea segura no es quién puede llamarla, sino que no se
--     puede sacar nada de ella sin el secreto: valida lo que recibe, no devuelve
--     datos de nadie y sólo deja subir marcas.


-- `digest` viene de pgcrypto, que en Supabase vive en el esquema `extensions`.
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------- La tabla --

-- Si ya está la versión anterior —la que iba por `pato_id` y guardaba el hash
-- aparte—, se tira. Pero SÓLO si está vacía: con datos dentro, esto para y avisa,
-- porque tirar el marcador de la gente no es algo que deba pasar por ejecutar un
-- fichero dos veces.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'records' and column_name = 'pato_id'
  ) then
    if (select count(*) from public.records) = 0 then
      drop table public.records cascade;
      raise notice 'Tirada la tabla anterior, que estaba vacia.';
    else
      raise exception
        'La tabla records es de la version anterior y TIENE DATOS. Migralos o tirala a mano antes de seguir.';
    end if;
  end if;
end $$;

create table if not exists public.records (
  -- sha256 del secreto del dueño, en hexadecimal. Es la identidad: no se puede
  -- reclamar la fila de otro sin saber su secreto.
  dueno       text        not null,
  juego       text        not null,
  nombre      text        not null,
  marca       integer     not null,
  mejor_es    text        not null default 'mas',
  actualizado timestamptz not null default now(),
  primary key (dueno, juego),

  -- Topes, para que una fila disparatada no reviente la tabla ni la interfaz.
  constraint records_dueno_ok  check (dueno ~ '^[0-9a-f]{64}$'),
  constraint records_juego_ok  check (char_length(juego) between 1 and 40),
  constraint records_nombre_ok check (char_length(nombre) between 1 and 40),
  constraint records_marca_ok  check (marca >= 0 and marca <= 10000000),
  constraint records_mejor_ok  check (mejor_es in ('mas', 'menos'))
);

-- Para el marcador: «los mejores de este juego». Un índice por (juego, marca)
-- sirve en las dos direcciones, porque Postgres sabe recorrerlo hacia atrás.
create index if not exists records_juego_marca on public.records (juego, marca);


-- --------------------------------------------------------------- El acceso --

alter table public.records enable row level security;

-- Se quita todo y se devuelve sólo lo justo: LEER, y sólo las columnas que se
-- enseñan. El `dueno` no se da ni en columna: es un hash, no hace falta para
-- nada fuera y no tiene sentido dejar que se enumere.
revoke all on public.records from anon, authenticated;
grant select (juego, nombre, marca, mejor_es, actualizado)
  on public.records to anon, authenticated;

-- Y las filas: todas, que para eso es un marcador. Escribir no lo permite
-- ninguna política, así que la única forma es la función de abajo.
drop policy if exists records_leer on public.records;
create policy records_leer on public.records
  for select to anon, authenticated using (true);

-- La vista es comodidad, no seguridad.
--
-- Va con `security_invoker` a propósito: una vista normal corre con los permisos
-- de QUIEN LA CREÓ, y eso es lo que el panel avisa como «Security Definer View»
-- —se salta el RLS de quien consulta, que es justo lo que no debe pasar sin
-- darse cuenta—. Con `security_invoker` no añade ningún permiso: quien la
-- consulta ve lo mismo que vería mirando la tabla.
drop view if exists public.records_publicos;
create view public.records_publicos
  with (security_invoker = true) as
  select juego, nombre, marca, mejor_es, actualizado
  from public.records;

grant select on public.records_publicos to anon, authenticated;


-- --------------------------------------------------------- La única puerta --

-- Se borra la versión anterior: la firma cambió al quitar el `p_pato_id`, y sin
-- esto quedarían las dos y la vieja seguiría dejando reclamar filas ajenas.
drop function if exists public.guardar_record(text, text, text, text, integer, text);

create or replace function public.guardar_record(
  p_secreto  text,
  p_juego    text,
  p_nombre   text,
  p_marca    integer,
  p_mejor_es text
)
returns text
language plpgsql
security definer
-- Sin esto, `security definer` es un agujero clásico: quien pueda crear objetos
-- en su propio esquema podría secuestrar los nombres sin cualificar. Y
-- `extensions` tiene que estar, que es donde vive `digest`.
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text;
  v_fila  public.records%rowtype;
begin
  -- Un secreto corto se podría adivinar a fuerza de llamadas, y aquí no hay
  -- quien las cuente. Los que genera el pato son de 32.
  if p_secreto is null or char_length(p_secreto) < 24 then
    return 'secreto-corto';
  end if;
  if p_mejor_es not in ('mas', 'menos') then
    return 'direccion-mala';
  end if;

  v_dueno := encode(digest(p_secreto, 'sha256'), 'hex');

  select * into v_fila from public.records
    where dueno = v_dueno and juego = p_juego;

  -- Primera vez con este juego.
  if not found then
    insert into public.records (dueno, juego, nombre, marca, mejor_es)
      values (v_dueno, p_juego, left(p_nombre, 40), p_marca, p_mejor_es);
    return 'nueva';
  end if;

  -- La marca sólo si MEJORA. El nombre se actualiza siempre: cambiarle el
  -- nombre al pato no debería obligar a batir un récord para que se note.
  if (p_mejor_es = 'menos' and p_marca >= v_fila.marca)
     or (p_mejor_es = 'mas' and p_marca <= v_fila.marca) then
    update public.records set nombre = left(p_nombre, 40)
      where dueno = v_dueno and juego = p_juego;
    return 'no-mejora';
  end if;

  update public.records
    set nombre = left(p_nombre, 40),
        marca = p_marca,
        mejor_es = p_mejor_es,
        actualizado = now()
    where dueno = v_dueno and juego = p_juego;
  return 'mejorada';
end;
$$;

revoke all on function public.guardar_record(text, text, text, integer, text) from public;
grant execute on function public.guardar_record(text, text, text, integer, text)
  to anon, authenticated;
