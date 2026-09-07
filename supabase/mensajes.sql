-- Mensajes privados de TuCuack.
--
-- Se ejecuta en el editor SQL del panel de Supabase del proyecto. Es
-- idempotente: se puede volver a lanzar entero sin romper nada.
--
-- Lee antes `supabase/records.sql`, que es donde está explicado el patrón que
-- aquí se copia: la clave publicable viaja dentro de la app, así que las
-- políticas de fila normales no protegen nada y la única puerta son funciones
-- `security definer` donde el dueño se DERIVA del secreto.
--
--
-- Sobre los avisos del panel
-- --------------------------
--
-- El linter de Supabase avisa de que estas funciones son `security definer` y
-- que las puede ejecutar `anon`. **Sale a propósito**, y es el mismo aviso que
-- ya explica `records.sql`: estas funciones SON la puerta, y quien llama es el
-- pato, que se conecta como `anon`. Quitarles el `execute` las deja
-- inservibles; ponerlas en `security invoker` las deja sin permiso sobre su
-- propia tabla. Lo que las hace seguras no es quién puede llamarlas, sino que
-- sin el secreto no devuelven ni tocan nada de nadie.
--
-- Lo que NO debe salir es «Function Search Path Mutable». Toda función de este
-- fichero fija su `search_path`, incluidas las auxiliares de una línea: sin
-- eso, quien pueda crear objetos en su propio esquema podría secuestrar los
-- nombres sin cualificar. A las auxiliares se les quita además el `execute`
-- público, que por defecto lo tienen: sólo las llaman las de aquí dentro, y
-- ésas corren como el dueño.
--
--
-- Lo que esto cambia, y hay que decirlo en voz alta
-- -------------------------------------------------
--
-- Hasta ahora el chat era efímero EN EL SERVIDOR: los mensajes viajaban por
-- broadcast y no quedaban en ninguna parte. Desde la 0.29 se guardan en el
-- equipo de cada uno. Esto es otra cosa: **TuCuack pasa a almacenar mensajes de
-- sus usuarios**. Con todo lo que eso trae:
--
--   * hay retención, y por tanto hay que decidirla (aquí abajo: 200 por
--     conversación, y nada más viejo de 90 días);
--   * hay que poder borrar a petición (hay función para ello, y se dice cómo);
--   * y **quien tenga la `service_role` puede leerlo todo**. No hay forma de
--     evitarlo desde aquí, así que lo que toca es decirlo en la interfaz y no
--     esconderlo.
--
-- El cifrado extremo a extremo está descartado a conciencia, no por pereza: no
-- hay intercambio de claves, y las identidades son un fichero de ajustes que se
-- puede borrar. Montarlo sería teatro: daría una sensación de privacidad que el
-- diseño no puede sostener, y eso es peor que no darla.
--
--
-- La dirección de un pato
-- -----------------------
--
-- Para escribirle a alguien hace falta una dirección, y hasta ahora no había
-- ninguna: la clave de presencia se regenera en cada reconexión.
--
-- La dirección es el MISMO `sha256(recordSecreto)` que ya identifica al dueño en
-- `records` y en `partidas`, y se publica en la presencia del canal. Publicarla
-- no rompe nada de aquello: para escribir en tus filas hace falta el SECRETO, y
-- el secreto no sale de tu disco. Lo que la dirección permite es exactamente lo
-- que se quiere —que te escriban— y nada más.
--
-- Se corresponde con una persona sólo mientras no borre sus ajustes. Es la misma
-- limitación que ya asume el marcador, y **hay que decirla en la interfaz**.
--
--
-- Si la dirección es pública, cualquiera puede escribirte
-- ------------------------------------------------------
--
-- Eso no es un efecto secundario: es la consecuencia directa, y obliga a dos
-- cosas que NO son opcionales y van dentro de la propia función de escritura.
--
--   1. **Un tope por minuto y por remitente.** Sin él, uno solo puede llenar la
--      tabla y la pantalla de cualquiera.
--   2. **Una lista de bloqueados.** Si alguien te escribe y no quieres, tiene
--      que haber una forma de que deje de llegar. Se comprueba en el servidor,
--      no en el pato: bloquear en el cliente sólo esconde el mensaje, y aquí
--      el mensaje ni se guarda.
--
-- De lo que NO protege nada de esto —igual que en `records.sql`— es de que
-- alguien se invente identidades nuevas. Con secretos de 32 caracteres es
-- gratis hacerlo. Lo que se acota es el daño por identidad, no el número de
-- identidades.


create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------- Ajustes --

-- En funciones y no en constantes para poder cambiarlos sin tocar el resto, y
-- para que el pato pueda preguntarlos si algún día hace falta enseñarlos.

/** Cuántos mensajes se guardan de cada conversación. */
create or replace function public.tope_conversacion()
returns integer language sql immutable set search_path = '' as $$ select 200 $$;
revoke all on function public.tope_conversacion() from public;

/** Cuántos días se guardan. Lo que pase de aquí se borra solo (ver abajo). */
create or replace function public.dias_de_mensajes()
returns integer language sql immutable set search_path = '' as $$ select 90 $$;
revoke all on function public.dias_de_mensajes() from public;

/** Cuántos mensajes por minuto puede mandar un remitente, en total. */
create or replace function public.tope_por_minuto()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;
revoke all on function public.tope_por_minuto() from public;


-- --------------------------------------------------------------- La tabla --

create table if not exists public.mensajes (
  -- Las dos direcciones de la conversación, ordenadas y pegadas. Tener el hilo
  -- como UNA cosa y no como un par (de, para) hace que leer una conversación y
  -- recortarla sean una consulta por índice en vez de un `or` de dos ramas.
  hilo       text        not null,
  de         text        not null,
  para       text        not null,
  -- El identificador del mensaje, el mismo que ya viaja por el chat desde la
  -- 0.29. Con él, un pato que recibe el broadcast Y luego carga el histórico no
  -- ve el mensaje dos veces, y reenviar no duplica la fila.
  mid        text        not null,
  texto      text        not null,
  -- El nombre que llevaba el remitente al escribir.
  --
  -- Va aquí porque si no la lista de conversaciones serían hashes: una dirección
  -- no dice quién es nadie, y al otro no siempre lo tienes delante en la
  -- presencia para preguntárselo. No expone nada nuevo — `records` y `partidas`
  -- ya guardan el nombre en claro— y evita tener que llevar una agenda local en
  -- cada carcasa.
  nombre     text        not null default '',
  enviado_el timestamptz not null default now(),
  primary key (de, mid),

  constraint mensajes_de_ok    check (de ~ '^[0-9a-f]{64}$'),
  constraint mensajes_para_ok  check (para ~ '^[0-9a-f]{64}$'),
  constraint mensajes_hilo_ok  check (char_length(hilo) = 129),
  constraint mensajes_mid_ok   check (char_length(mid) between 1 and 40),
  constraint mensajes_texto_ok check (char_length(texto) between 1 and 280),
  constraint mensajes_nombre_ok check (char_length(nombre) <= 40),
  -- Escribirse a uno mismo no es una conversación; y sobre todo, rompería el
  -- hilo, que da por hecho dos extremos distintos.
  constraint mensajes_dos_ok   check (de <> para)
);

-- Por si la tabla se creó con una versión anterior de este fichero.
alter table public.mensajes add column if not exists nombre text not null default '';

create index if not exists mensajes_hilo_fecha
  on public.mensajes (hilo, enviado_el desc);
-- Para el tope por minuto, que consulta por remitente y fecha.
create index if not exists mensajes_de_fecha
  on public.mensajes (de, enviado_el desc);

-- Quién no quiere saber nada de quién.
create table if not exists public.bloqueos (
  dueno     text not null,   -- quien bloquea
  bloqueado text not null,   -- a quien no quiere leer
  desde     timestamptz not null default now(),
  primary key (dueno, bloqueado),
  constraint bloqueos_dueno_ok     check (dueno ~ '^[0-9a-f]{64}$'),
  constraint bloqueos_bloqueado_ok check (bloqueado ~ '^[0-9a-f]{64}$')
);


-- --------------------------------------------------------------- El acceso --

alter table public.mensajes enable row level security;
alter table public.bloqueos enable row level security;

-- Ni leer. Aquí no hay nada público: la única forma de sacar filas es
-- `leer_mensajes`, y exige el secreto.
revoke all on public.mensajes from anon, authenticated;
revoke all on public.bloqueos from anon, authenticated;


-- ------------------------------------------------------- Escribir y leer --

/** El hilo de dos direcciones, siempre igual las pongas como las pongas. */
create or replace function public.hilo_de(a text, b text)
returns text language sql immutable
-- `search_path` vacío: `least`, `greatest` y `||` salen de `pg_catalog`, que se
-- busca igualmente, así que no queda ningún nombre que secuestrar.
set search_path = ''
as $$
  select least(a, b) || ':' || greatest(a, b)
$$;

-- Sólo la llaman las funciones de aquí, que corren como el dueño: no tiene por
-- qué estar publicada como RPC.
revoke all on function public.hilo_de(text, text) from public;

drop function if exists public.enviar_mensaje(text, text, text, text);
drop function if exists public.enviar_mensaje(text, text, text, text, text);

create or replace function public.enviar_mensaje(
  p_secreto text,
  p_para    text,
  p_mid     text,
  p_texto   text,
  p_nombre  text
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_de    text;
  v_hilo  text;
  v_texto text := left(coalesce(p_texto, ''), 280);
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return 'secreto-corto';
  end if;
  if p_para is null or p_para !~ '^[0-9a-f]{64}$' then
    return 'destino-malo';
  end if;
  if p_mid is null or char_length(p_mid) = 0 or char_length(p_mid) > 40 then
    return 'mid-malo';
  end if;
  if char_length(trim(v_texto)) = 0 then
    return 'vacio';
  end if;

  v_de := encode(digest(p_secreto, 'sha256'), 'hex');
  if v_de = p_para then
    return 'a-ti-mismo';
  end if;

  -- Bloqueado: se dice que sí para no convertir esto en un detector de bloqueos.
  -- Quien bloquea no quiere que el otro lo sepa; que parezca entregado y no
  -- llegue es exactamente lo que se quiere.
  if exists (select 1 from public.bloqueos where dueno = p_para and bloqueado = v_de) then
    return 'enviado';
  end if;

  -- El tope por minuto. Va DENTRO de la función porque es la única puerta: en el
  -- pato sería un adorno, ya que cualquiera puede llamar a la RPC directamente.
  if (select count(*) from public.mensajes
       where de = v_de and enviado_el > now() - interval '1 minute')
     >= public.tope_por_minuto() then
    return 'demasiados';
  end if;

  v_hilo := public.hilo_de(v_de, p_para);

  insert into public.mensajes (hilo, de, para, mid, texto, nombre)
    values (v_hilo, v_de, p_para, left(p_mid, 40), v_texto, left(coalesce(p_nombre, ''), 40))
    on conflict (de, mid) do nothing;

  -- Ya estaba: un reenvío del pato. No se recorta ni se cuenta dos veces.
  if not found then
    return 'ya-estaba';
  end if;

  -- Retención, y sin `pg_cron`: se recorta al escribir, que es justo cuando se
  -- puede pasar del tope. Las dos dimensiones, porque cada una tapa un agujero
  -- de la otra: por cantidad, para que una conversación viva no crezca sin fin;
  -- y por edad, para no guardar indefinidamente lo de una que se apagó.
  delete from public.mensajes
   where hilo = v_hilo
     and (de, mid) not in (
       select de, mid from public.mensajes
        where hilo = v_hilo
        order by enviado_el desc, mid desc
        limit public.tope_conversacion()
     );

  delete from public.mensajes
   where hilo = v_hilo
     and enviado_el < now() - (public.dias_de_mensajes() || ' days')::interval;

  return 'enviado';
end;
$$;

revoke all on function public.enviar_mensaje(text, text, text, text, text) from public;
grant execute on function public.enviar_mensaje(text, text, text, text, text)
  to anon, authenticated;


/**
 * Una conversación, de la más reciente a la más antigua.
 *
 * Sólo salen filas del hilo que forman TU dirección y la del otro, y tu
 * dirección sale de tu secreto: no hay forma de pedir la conversación de dos
 * terceros. Sin secreto no devuelve nada, que es la respuesta correcta.
 */
drop function if exists public.leer_mensajes(text, text, integer);

create or replace function public.leer_mensajes(
  p_secreto text,
  p_con     text,
  p_tope    integer default 100
)
returns table (
  mid        text,
  mio        boolean,
  texto      text,
  enviado_el timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yo text;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return;
  end if;
  if p_con is null or p_con !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_yo := encode(digest(p_secreto, 'sha256'), 'hex');
  if v_yo = p_con then
    return;
  end if;

  return query
    select m.mid, m.de = v_yo, m.texto, m.enviado_el
      from public.mensajes m
     where m.hilo = public.hilo_de(v_yo, p_con)
     order by m.enviado_el desc
     limit least(greatest(coalesce(p_tope, 100), 1), public.tope_conversacion());
end;
$$;

revoke all on function public.leer_mensajes(text, text, integer) from public;
grant execute on function public.leer_mensajes(text, text, integer) to anon, authenticated;


/**
 * Con quién tienes conversación, y cuántos mensajes sin leer hay.
 *
 * Devuelve la otra dirección de cada hilo en el que estás, con lo último que se
 * dijo. El pato no puede saber los nombres —una dirección es un hash— así que
 * los pone él cruzando con quien tenga a la vista en la presencia.
 */
drop function if exists public.mis_conversaciones(text, integer);

create or replace function public.mis_conversaciones(
  p_secreto text,
  p_tope    integer default 30
)
returns table (
  con        text,
  nombre     text,
  ultimo     text,
  mio        boolean,
  enviado_el timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yo text;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return;
  end if;
  v_yo := encode(digest(p_secreto, 'sha256'), 'hex');

  -- Dos vueltas, y hacen falta las dos. `distinct on` obliga a ordenar PRIMERO
  -- por lo que distingue —la otra dirección— para quedarse con la fila más
  -- reciente de cada hilo; pero eso deja las conversaciones ordenadas por hash,
  -- que no es un orden, es un revoltijo. Así que se reordenan por fecha fuera, y
  -- el `limit` se aplica ahí: con más conversaciones que el tope, lo que se
  -- devuelve son las últimas y no treinta al azar.
  return query
    select t.con,
           -- El último nombre con el que firmó EL OTRO. Si nunca ha escrito
           -- —la conversación la empezaste tú— sale vacío y el pato pone lo que
           -- sepa por la presencia.
           coalesce((select m2.nombre
                       from public.mensajes m2
                      where m2.hilo = public.hilo_de(v_yo, t.con)
                        and m2.de = t.con
                        and m2.nombre <> ''
                      order by m2.enviado_el desc
                      limit 1), '') as nombre,
           t.ultimo, t.mio, t.enviado_el
      from (
        select distinct on (case when m.de = v_yo then m.para else m.de end)
               (case when m.de = v_yo then m.para else m.de end) as con,
               m.texto      as ultimo,
               (m.de = v_yo) as mio,
               m.enviado_el  as enviado_el
          from public.mensajes m
         where m.de = v_yo or m.para = v_yo
         order by (case when m.de = v_yo then m.para else m.de end), m.enviado_el desc
      ) t
     order by t.enviado_el desc
     limit least(greatest(coalesce(p_tope, 30), 1), 100);
end;
$$;

revoke all on function public.mis_conversaciones(text, integer) from public;
grant execute on function public.mis_conversaciones(text, integer) to anon, authenticated;


-- --------------------------------------------------------------- Bloqueos --

drop function if exists public.bloquear(text, text, boolean);

create or replace function public.bloquear(
  p_secreto text,
  p_a       text,
  p_bloquear boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yo text;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return 'secreto-corto';
  end if;
  if p_a is null or p_a !~ '^[0-9a-f]{64}$' then
    return 'destino-malo';
  end if;

  v_yo := encode(digest(p_secreto, 'sha256'), 'hex');
  if v_yo = p_a then
    return 'a-ti-mismo';
  end if;

  if p_bloquear then
    insert into public.bloqueos (dueno, bloqueado) values (v_yo, p_a)
      on conflict (dueno, bloqueado) do nothing;
    return 'bloqueado';
  end if;

  delete from public.bloqueos where dueno = v_yo and bloqueado = p_a;
  return 'desbloqueado';
end;
$$;

revoke all on function public.bloquear(text, text, boolean) from public;
grant execute on function public.bloquear(text, text, boolean) to anon, authenticated;


drop function if exists public.mis_bloqueos(text);

create or replace function public.mis_bloqueos(p_secreto text)
returns table (bloqueado text, desde timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yo text;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return;
  end if;
  v_yo := encode(digest(p_secreto, 'sha256'), 'hex');
  return query
    select b.bloqueado, b.desde from public.bloqueos b
     where b.dueno = v_yo order by b.desde desc limit 100;
end;
$$;

revoke all on function public.mis_bloqueos(text) from public;
grant execute on function public.mis_bloqueos(text) to anon, authenticated;


-- --------------------------------------------------------------- Borrarlo --

/**
 * Borra TODO lo tuyo: los mensajes que mandaste y los que te mandaron.
 *
 * Existe porque tiene que existir: si se guardan conversaciones, tiene que haber
 * una forma de deshacerlo que no dependa de pedírselo a nadie. Y borra el hilo
 * entero, no sólo tu mitad: media conversación guardada no le sirve a nadie y
 * seguiría siendo tuya a medias.
 */
drop function if exists public.borrar_mis_mensajes(text);

create or replace function public.borrar_mis_mensajes(p_secreto text)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yo text;
  v_n  integer;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return -1;
  end if;
  v_yo := encode(digest(p_secreto, 'sha256'), 'hex');

  delete from public.mensajes where de = v_yo or para = v_yo;
  get diagnostics v_n = row_count;
  delete from public.bloqueos where dueno = v_yo or bloqueado = v_yo;
  return v_n;
end;
$$;

revoke all on function public.borrar_mis_mensajes(text) from public;
grant execute on function public.borrar_mis_mensajes(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Lo que queda fuera, dicho para que no parezca un olvido
-- ---------------------------------------------------------------------------
--
--   * **No hay acuse de lectura.** Saber si el otro te ha leído es información
--     sobre el otro; el histórico de cada uno es suyo.
--   * **No hay borrado de un mensaje suelto.** Borrar el tuyo del lado del otro
--     exigiría poder escribir en su mitad del hilo, y eso es justo lo que el
--     diseño impide. O se borra todo lo tuyo, o nada.
--   * **La retención se aplica al escribir.** Una conversación en la que nadie
--     escribe nunca más no se limpia sola. Si eso llega a importar, la línea es:
--
--       delete from public.mensajes
--        where enviado_el < now() - interval '90 days';
--
--     y ahí sí valdría la pena `pg_cron`.
