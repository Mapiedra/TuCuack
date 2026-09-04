-- Marcador global de TuCuack.
--
-- Se ejecuta UNA vez, en el editor SQL del panel de Supabase del proyecto.
-- Es idempotente: se puede volver a lanzar entero sin romper nada.
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
-- Así que la tabla NO acepta escrituras, ni lecturas, de nadie que venga con esa
-- clave. Sólo hay dos puertas:
--
--   * `records_publicos`, una vista que enseña el marcador sin el secreto.
--   * `guardar_record`, una función `security definer` que comprueba un secreto
--     que sólo conoce el dueño de la fila.
--
-- La primera vez que un pato guarda un juego, la fila se crea y se queda con el
-- hash de su secreto: eso es reclamarla. A partir de ahí sólo se puede tocar
-- presentando el mismo secreto, y sólo si la marca MEJORA en la dirección que
-- diga el juego.
--
-- El secreto lo genera el pato la primera vez y lo guarda en sus ajustes, al
-- lado del `patoId`. No es una identidad de verdad —quien borre sus ajustes
-- pierde sus filas para siempre, y quien quiera puede estrenar identidad— pero
-- impide lo único que de verdad haría daño: que alguien reviente el marcador de
-- los demás. Nadie puede bajar una marca, ni borrar una fila, ni tocar la de
-- otro.
--
-- Lo que NO impide, y hay que decirlo en la interfaz: que alguien declare una
-- marca que no ha hecho. Sin un servidor que juegue la partida, eso no se puede
-- comprobar. Por eso el marcador enseña siempre el nombre de quien la declara.


-- `digest` viene de pgcrypto, que en Supabase vive en el esquema `extensions`.
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------- La tabla --

create table if not exists public.records (
  pato_id      text        not null,
  juego        text        not null,
  nombre       text        not null,
  marca        integer     not null,
  mejor_es     text        not null default 'mas',
  -- Hash del secreto del dueño. No sale de aquí: la vista no lo lleva.
  secreto_hash text        not null,
  actualizado  timestamptz not null default now(),
  primary key (pato_id, juego),

  -- Topes, para que una fila disparatada no reviente la tabla ni la interfaz.
  constraint records_pato_ok   check (pato_id ~ '^p-[a-zA-Z0-9]{1,32}$'),
  constraint records_juego_ok  check (char_length(juego) between 1 and 40),
  constraint records_nombre_ok check (char_length(nombre) between 1 and 40),
  constraint records_marca_ok  check (marca >= 0 and marca <= 10000000),
  constraint records_mejor_ok  check (mejor_es in ('mas', 'menos'))
);

-- Para el marcador: «los mejores de este juego». Un índice por (juego, marca)
-- sirve en las dos direcciones, porque Postgres sabe recorrerlo hacia atrás.
create index if not exists records_juego_marca on public.records (juego, marca);


-- --------------------------------------------------------------- El acceso --

-- RLS encendido y SIN políticas: así, a la tabla no llega nadie de fuera. No
-- hace falta escribir una política de «prohibido»; la ausencia ya lo es.
alter table public.records enable row level security;
revoke all on public.records from anon, authenticated;

-- El marcador, sin el secreto. Una vista normal corre con los permisos de su
-- dueño, así que ésta sí puede leer la tabla aunque quien la consulte no pueda.
create or replace view public.records_publicos as
  select pato_id, juego, nombre, marca, mejor_es, actualizado
  from public.records;

grant select on public.records_publicos to anon, authenticated;


-- --------------------------------------------------------- La única puerta --

create or replace function public.guardar_record(
  p_pato_id  text,
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
  v_hash text := encode(digest(p_secreto, 'sha256'), 'hex');
  v_fila public.records%rowtype;
begin
  if p_secreto is null or char_length(p_secreto) < 16 then
    return 'secreto-corto';
  end if;
  if p_mejor_es not in ('mas', 'menos') then
    return 'direccion-mala';
  end if;

  select * into v_fila from public.records
    where pato_id = p_pato_id and juego = p_juego;

  -- Primera vez con este juego: se crea la fila y se queda con el secreto.
  if not found then
    insert into public.records (pato_id, juego, nombre, marca, mejor_es, secreto_hash)
      values (p_pato_id, p_juego, left(p_nombre, 40), p_marca, p_mejor_es, v_hash);
    return 'nueva';
  end if;

  -- Ya existe: sólo la toca quien la creó.
  if v_fila.secreto_hash <> v_hash then
    return 'no-es-tuya';
  end if;

  -- Y la marca sólo si MEJORA. El nombre se actualiza siempre: cambiarle el
  -- nombre al pato no debería obligar a batir un récord para que se note.
  if (p_mejor_es = 'menos' and p_marca >= v_fila.marca)
     or (p_mejor_es = 'mas' and p_marca <= v_fila.marca) then
    update public.records set nombre = left(p_nombre, 40)
      where pato_id = p_pato_id and juego = p_juego;
    return 'no-mejora';
  end if;

  update public.records
    set nombre = left(p_nombre, 40),
        marca = p_marca,
        mejor_es = p_mejor_es,
        actualizado = now()
    where pato_id = p_pato_id and juego = p_juego;
  return 'mejorada';
end;
$$;

revoke all on function public.guardar_record(text, text, text, text, integer, text) from public;
grant execute on function public.guardar_record(text, text, text, text, integer, text)
  to anon, authenticated;
