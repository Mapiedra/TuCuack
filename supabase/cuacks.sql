-- El monedero de TuCuack: los cuacks, en el servidor.
--
-- Se ejecuta en el editor SQL del panel de Supabase del proyecto. Es
-- idempotente: se puede volver a lanzar entero sin romper nada.
--
-- Lectura previa obligatoria: `supabase/records.sql`. Ahí está razonado por qué
-- el dueño de una fila es el HASH de su secreto y por qué la única puerta de
-- escritura es una función `security definer`. Aquí se da por sabido.
--
--
-- El problema que resuelve
-- ------------------------
--
-- Hasta ahora el saldo vivía en `pet-state.json`, en el disco de cada uno.
-- Eso tiene dos consecuencias, y sólo una era aceptable:
--
--   * **Se puede editar a mano.** Un fichero JSON con `"saldo": 12` es un
--     fichero JSON con `"saldo": 999999` en cuanto alguien lo abre. Mientras los
--     cuacks sólo compraran minijuegos daba bastante igual —el que se engaña es
--     él—, pero en cuanto haya premios, cupones o compras de verdad, deja de
--     dar igual.
--
--   * **No hay dónde mirarlos.** Para dar un premio hace falta poder decir
--     cuántos tiene alguien, y eso no se puede hacer si la cifra está repartida
--     por los discos de la gente.
--
--
-- Por qué NO basta con guardar el saldo aquí
-- ------------------------------------------
--
-- Esto es lo importante, y es lo que decide la forma de todo el fichero.
--
-- El pato se conecta con la clave PUBLICABLE, que viaja dentro de la app. O sea
-- que cualquiera puede llamar a estas funciones desde fuera del juego. Si
-- hubiera una función `ingresar_cuacks(secreto, cuantos)`, mover el saldo a la
-- base de datos no habría arreglado nada: en vez de editar un JSON, se haría una
-- llamada. Más incómodo, igual de falsificable.
--
-- Así que **aquí no se ingresan cuacks: aquí se apuntan partidas**. El pato dice
-- «he terminado tal partida de tal juego y la he ganado» y el importe lo calcula
-- ESTE fichero, con la misma fórmula que `core/game/cuacks.js` y con el nivel
-- que dice el catálogo de aquí abajo, no el que diga el cliente. Lo mismo con
-- las compras: el precio sale del catálogo, no del mensaje.
--
-- Lo que eso deja fuera:
--
--   * Regalarse un saldo: no hay por dónde.
--   * Cobrar dos veces la misma partida: cada una se apunta con su id y la
--     segunda vez no paga (misma idea que `guardar_partida` en partidas.sql).
--   * Cobrar mil partidas en un minuto: hay tope por hora.
--
-- Lo que NO impide, y conviene tenerlo escrito antes de montar premios encima:
-- que alguien llame a `apuntar_partida_cuacks` sin haber jugado. Sin un servidor
-- que juegue la partida eso no se puede comprobar, igual que el marcador no
-- puede comprobar una marca. Lo que sí se consigue es que ganar por las malas
-- cueste lo mismo que ganar jugando —una partida es una partida, y hay tope por
-- hora—, que es lo máximo que da de sí un juego sin servidor de juego.
--
--
-- Lo que había en el disco no se pierde
-- -------------------------------------
--
-- La primera vez, el monedero se crea CON LA CIFRA LOCAL: `estrenar_cuacks`
-- recibe el saldo, lo ganado y los juegos comprados que hubiera en el disco y
-- los usa para nacer. A partir de ahí manda el servidor y el fichero local pasa
-- a ser una copia para poder enseñar algo sin conexión.
--
-- Esa importación está topada (ver `tope_de_estreno`), porque es la única
-- entrada por la que el cliente declara una cifra. Se paga UNA vez: en cuanto la
-- fila existe, `estrenar_cuacks` no vuelve a mirar lo que le manden.
--
--
-- Sobre los avisos del panel
-- --------------------------
--
-- Sale «Public / Signed-In Users Can Execute SECURITY DEFINER Function», y es a
-- propósito, exactamente por lo mismo que en records.sql: esas funciones SON la
-- puerta, y tiene que poder llamarlas el pato, que se conecta como `anon`. Lo
-- que las hace seguras no es quién puede llamarlas, sino que sin el secreto no
-- se saca ni se toca nada de nadie.


create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------- Ajustes --
--
-- En funciones y no a pelo para poder cambiarlos sin tocar el resto, igual que
-- en mensajes.sql.

/** Lo que paga una partida antes de mirar cómo acabó: suelo + nivel × paso.
 *  Los mismos números que `SUELO` y `POR_NIVEL` en core/game/cuacks.js. */
create or replace function public.cuacks_suelo()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;
create or replace function public.cuacks_por_nivel()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;
revoke all on function public.cuacks_suelo() from public;
revoke all on function public.cuacks_por_nivel() from public;

/** Cuántas partidas por hora se pagan a un mismo monedero.
 *
 *  No es un tope de juego: es un tope de MÁQUINA. Jugando de verdad no se
 *  llega —cada partida gasta diez de energía de la mascota, así que de ochenta
 *  se juegan ocho y a dormir—, y en cambio corta en seco a quien llame a la
 *  función en bucle. */
create or replace function public.cuacks_partidas_por_hora()
returns integer language sql immutable set search_path = '' as $$ select 60 $$;
revoke all on function public.cuacks_partidas_por_hora() from public;

/** Cuánto se acepta importar del disco al estrenar el monedero.
 *
 *  Es la única cifra que declara el cliente en todo el fichero, así que lleva
 *  tope. Generoso a propósito: un pato que lleve meses jugando anda por unos
 *  pocos miles, y de lo que se trata es de cortar el «mi saldo local son diez
 *  millones», no de castigar a quien jugó mucho. */
create or replace function public.tope_de_estreno()
returns integer language sql immutable set search_path = '' as $$ select 50000 $$;
revoke all on function public.tope_de_estreno() from public;

/** El premio de la broma del «No tocar»: suelo + nivel × paso, una vez al día.
 *  Los mismos números que `BROMA_SUELO` y `BROMA_POR_NIVEL` en cuacks.js. */
create or replace function public.broma_suelo()
returns integer language sql immutable set search_path = '' as $$ select 120 $$;
create or replace function public.broma_por_nivel()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;
/** Hasta qué nivel cuenta para el premio de la broma.
 *
 *  El nivel lo declara el pato —vive en su disco, como vivía el saldo—, así que
 *  aquí se le pone techo: sin él, «soy nivel 9 000 000» sería un cheque. Con
 *  techo, lo peor que puede pasar es cobrar el premio de un nivel 200 una vez
 *  al día, que es ruido. */
create or replace function public.broma_nivel_tope()
returns integer language sql immutable set search_path = '' as $$ select 200 $$;
revoke all on function public.broma_suelo() from public;
revoke all on function public.broma_por_nivel() from public;
revoke all on function public.broma_nivel_tope() from public;

/** Cuánto se guarda de las partidas apuntadas. Pasado eso ya no hacen falta:
 *  su único trabajo es no pagar dos veces y contar las de la última hora. */
create or replace function public.dias_de_partidas_cuacks()
returns integer language sql immutable set search_path = '' as $$ select 7 $$;
revoke all on function public.dias_de_partidas_cuacks() from public;


-- --------------------------------------------------------- El catálogo --
--
-- La copia de `core/game/minijuegos/index.js` que vive aquí, y el motivo por el
-- que el servidor puede calcular en vez de creerse lo que le digan: el nivel y
-- el precio de cada juego salen de esta tabla.
--
-- Se siembra abajo, y ese bloque NO se escribe a mano: lo genera
-- `node tools/catalogo-a-sql.mjs` leyendo el catálogo de verdad. Cuando se
-- añada un juego o cambie un precio, hay que regenerarlo y volver a lanzar este
-- fichero, o el juego nuevo no se podrá comprar.

create table if not exists public.juegos_catalogo (
  id     text    primary key,
  nivel  integer not null,
  precio integer not null,
  constraint juegos_catalogo_id_ok     check (char_length(id) between 1 and 40),
  constraint juegos_catalogo_nivel_ok  check (nivel between 1 and 500),
  constraint juegos_catalogo_precio_ok check (precio between 0 and 1000000)
);

alter table public.juegos_catalogo enable row level security;

-- Leerlo no da nada que el pato no traiga ya dentro, así que se deja abierto:
-- sirve para poder comprobar desde fuera que el catálogo de aquí y el de la app
-- dicen lo mismo (ver `npm run cuacks:check`). Escribir, sólo desde el panel.
revoke all on public.juegos_catalogo from anon, authenticated;
grant select on public.juegos_catalogo to anon, authenticated;
drop policy if exists juegos_catalogo_leer on public.juegos_catalogo;
create policy juegos_catalogo_leer on public.juegos_catalogo
  for select to anon, authenticated using (true);


-- ---------------------------------------------------------------- El libro --

create table if not exists public.cuacks (
  -- sha256 del secreto del dueño, igual que en records.sql.
  dueno            text        primary key,
  saldo            integer     not null default 0,
  -- Lo ganado en total, que es lo que se enseña como historial. Nunca baja.
  ganado           integer     not null default 0,
  -- Los juegos comprados, por id. En una lista y no en columnas del catálogo
  -- por lo de siempre: un juego que desaparezca un tiempo del catálogo no puede
  -- hacer que nadie pierda lo que pagó por él.
  comprados        text[]      not null default '{}',
  -- Último día que se cobró el peaje del «No tocar».
  dia_de_la_broma  date,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now(),

  constraint cuacks_dueno_ok  check (dueno ~ '^[0-9a-f]{64}$'),
  constraint cuacks_saldo_ok  check (saldo >= 0 and saldo <= 100000000),
  constraint cuacks_ganado_ok check (ganado >= 0 and ganado <= 100000000),
  constraint cuacks_comprados_ok check (array_length(comprados, 1) is null
                                        or array_length(comprados, 1) <= 200)
);

-- Las partidas ya pagadas.
--
-- Existe por dos cosas a la vez, y las dos importan: que reenviar una partida no
-- la cobre dos veces —el pato reintenta lo que no salió, ver la cola de
-- `main/cuacks.js`— y que se pueda contar cuántas van en la última hora.
create table if not exists public.cuacks_partidas (
  dueno      text        not null,
  -- El id de la partida, el mismo que ya usa el historial (partidas.sql). En
  -- una partida contra la máquina lo inventa el pato; contra otro pato es el de
  -- la sala, así que los dos apuntan la suya con el mismo id y cada uno cobra la
  -- suya: la clave lleva el dueño delante.
  partida_id text        not null,
  juego      text        not null,
  cuacks     integer     not null,
  cuando     timestamptz not null default now(),
  primary key (dueno, partida_id),

  constraint cuacks_partidas_dueno_ok check (dueno ~ '^[0-9a-f]{64}$'),
  constraint cuacks_partidas_id_ok    check (char_length(partida_id) between 1 and 80)
);

create index if not exists cuacks_partidas_recientes
  on public.cuacks_partidas (dueno, cuando desc);


-- --------------------------------------------------------------- El acceso --

alter table public.cuacks enable row level security;
alter table public.cuacks_partidas enable row level security;

-- Nada, ni leer. El saldo de alguien no es público —el marcador sí lo es, un
-- monedero no— y la única forma de verlo es con el secreto, por la función.
revoke all on public.cuacks from anon, authenticated;
revoke all on public.cuacks_partidas from anon, authenticated;


-- ------------------------------------------------------------- Lo compartido --

/** La dirección del dueño a partir de su secreto. La misma de records.sql. */
create or replace function public.cuacks_dueno(p_secreto text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case
    when p_secreto is null or char_length(p_secreto) < 24 then null
    else encode(digest(p_secreto, 'sha256'), 'hex')
  end
$$;
revoke all on function public.cuacks_dueno(text) from public;

/**
 * El monedero, tal y como lo espera el pato.
 *
 * Todas las funciones de abajo terminan devolviendo esto, con un `ok` y un
 * `motivo` delante: así el pato tiene UN solo sitio donde leer la respuesta y
 * el saldo que pinta es siempre el que acaba de decir el servidor, pase lo que
 * pase con la operación.
 */
create or replace function public.cuacks_estado(p_dueno text, p_ok boolean,
                                                p_motivo text, p_cuacks integer)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok', p_ok,
    'motivo', p_motivo,
    -- Cuántos ha movido ESTA operación. Cero cuando no ha movido ninguno.
    'cuacks', coalesce(p_cuacks, 0),
    'saldo', coalesce(c.saldo, 0),
    'ganado', coalesce(c.ganado, 0),
    'comprados', to_jsonb(coalesce(c.comprados, '{}'::text[])),
    'diaDeLaBroma', coalesce(to_char(c.dia_de_la_broma, 'YYYY-MM-DD'), ''),
    -- Si el monedero existe. Es lo que le dice al pato si tiene que estrenarlo.
    'existe', c.dueno is not null
  )
  from (select 1) uno
  left join public.cuacks c on c.dueno = p_dueno
$$;
revoke all on function public.cuacks_estado(text, boolean, text, integer) from public;


-- ------------------------------------------------------------- Consultarlo --

/**
 * El monedero propio. Sin secreto no devuelve nada, y eso es la respuesta
 * correcta, no un fallo.
 *
 * Si no existe, devuelve un monedero a cero con `existe: false`: es lo que le
 * dice al pato que tiene que estrenarlo con lo que tenga en el disco.
 */
create or replace function public.mis_cuacks(p_secreto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text := public.cuacks_dueno(p_secreto);
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;
  return public.cuacks_estado(v_dueno, true, 'ok', 0);
end;
$$;
revoke all on function public.mis_cuacks(text) from public;
grant execute on function public.mis_cuacks(text) to anon, authenticated;


-- --------------------------------------------------------------- Estrenarlo --

/**
 * Crea el monedero con lo que el pato tuviera en el disco.
 *
 * Sólo la primera vez. Si la fila ya existe, esto NO la toca y devuelve la que
 * hay: a partir del estreno manda el servidor, y un segundo estreno sería
 * justamente la puerta que este fichero existe para cerrar.
 *
 * Las cifras vienen topadas (ver `tope_de_estreno`) y los ids de juegos se
 * cruzan con el catálogo: un «he comprado» de algo que no existe se cae solo.
 */
create or replace function public.estrenar_cuacks(
  p_secreto    text,
  p_saldo      integer,
  p_ganado     integer,
  p_comprados  text[],
  p_dia_broma  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno     text := public.cuacks_dueno(p_secreto);
  v_tope      integer := public.tope_de_estreno();
  v_saldo     integer;
  v_ganado    integer;
  v_comprados text[];
  v_dia       date;
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;

  -- Ya existe: ni se mira lo que traiga.
  if exists (select 1 from public.cuacks where dueno = v_dueno) then
    return public.cuacks_estado(v_dueno, true, 'ya-estaba', 0);
  end if;

  v_saldo  := least(greatest(coalesce(p_saldo, 0), 0), v_tope);
  -- Lo ganado nunca puede ser menos que el saldo: sería un historial que no
  -- explica el dinero que hay.
  v_ganado := greatest(v_saldo, least(greatest(coalesce(p_ganado, 0), 0), v_tope));

  -- Sólo juegos que existen, sin repetidos y con tope de cuántos.
  select coalesce(array_agg(distinct j.id), '{}'::text[])
    into v_comprados
    from unnest(coalesce(p_comprados, '{}'::text[])) as c(id)
    join public.juegos_catalogo j on j.id = c.id;
  if array_length(v_comprados, 1) > 200 then
    v_comprados := v_comprados[1:200];
  end if;

  begin
    v_dia := nullif(p_dia_broma, '')::date;
  exception when others then
    v_dia := null;   -- una fecha ilegible es como no traer ninguna
  end;
  -- Una fecha del futuro dejaría la broma sin cobrar para siempre.
  if v_dia > current_date then v_dia := current_date; end if;

  insert into public.cuacks (dueno, saldo, ganado, comprados, dia_de_la_broma)
    values (v_dueno, v_saldo, v_ganado, v_comprados, v_dia)
    -- Dos patos del mismo dueño estrenando a la vez: gana el primero, el
    -- segundo se encuentra la fila hecha y sigue su camino.
    on conflict (dueno) do nothing;

  return public.cuacks_estado(v_dueno, true, 'estrenado', 0);
end;
$$;
revoke all on function public.estrenar_cuacks(text, integer, integer, text[], text) from public;
grant execute on function public.estrenar_cuacks(text, integer, integer, text[], text)
  to anon, authenticated;


-- ---------------------------------------------------------------- Ganarlos --

/**
 * Apunta una partida terminada y paga lo que toque.
 *
 * El importe se calcula AQUÍ, con el nivel que dice el catálogo. Es toda la
 * diferencia entre este fichero y guardar el saldo en la nube: el pato no
 * declara cuánto ha ganado, declara qué ha jugado.
 *
 * La fórmula es la de `pagoDePartida` en core/game/cuacks.js, y las dos tienen
 * que decir lo mismo: el pato enseña el premio en cuanto termina la partida y el
 * servidor lo confirma medio segundo después. Si discreparan, el número
 * cambiaría delante de las narices del jugador. Hay una comprobación que lo
 * vigila: `npm run cuacks:check`.
 *
 * @param p_partida  id de la partida. Es lo que hace que reenviarla no pague dos
 *                   veces, y el pato SIEMPRE reenvía lo que no salió a la
 *                   primera (jugar sin red apunta en una cola local).
 */
create or replace function public.apuntar_partida_cuacks(
  p_secreto   text,
  p_partida   text,
  p_juego     text,
  p_resultado text,
  p_en_red    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno  text := public.cuacks_dueno(p_secreto);
  v_nivel  integer;
  v_mult   numeric;
  v_pago   integer;
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;
  if p_partida is null or char_length(p_partida) = 0 or char_length(p_partida) > 80 then
    return public.cuacks_estado(v_dueno, false, 'partida-mala', 0);
  end if;

  select nivel into v_nivel from public.juegos_catalogo where id = p_juego;
  if not found then
    -- Un juego que este servidor no conoce. Pasa de verdad y no es culpa de
    -- nadie: alguien con una versión más nueva que el catálogo sembrado. Se dice
    -- claro para que se pueda arreglar sembrando, en vez de pagar a ciegas.
    return public.cuacks_estado(v_dueno, false, 'juego-desconocido', 0);
  end if;

  v_mult := case p_resultado
    when 'victoria' then 1
    when 'empate'   then 0.6
    -- Cualquier otra cosa se paga como derrota. Perder paga poco pero paga: si
    -- no pagara nada, los juegos de marca —donde «ganar» es batir tu récord— no
    -- darían nunca nada y nadie los tocaría.
    else 0.3
  end;

  -- Contra otra mascota paga el doble: contra la máquina se juega cuando uno
  -- quiere, y contra alguien hay que cuadrar dos agendas.
  v_pago := greatest(1, round(
    (public.cuacks_suelo() + v_nivel * public.cuacks_por_nivel())
    * v_mult
    * (case when coalesce(p_en_red, false) then 2 else 1 end)
  )::integer);

  -- El tope por hora. Va DENTRO de la función porque es la única puerta: en el
  -- pato sería un adorno.
  if (select count(*) from public.cuacks_partidas
       where dueno = v_dueno and cuando > now() - interval '1 hour')
     >= public.cuacks_partidas_por_hora() then
    return public.cuacks_estado(v_dueno, false, 'demasiadas', 0);
  end if;

  insert into public.cuacks_partidas (dueno, partida_id, juego, cuacks)
    values (v_dueno, left(p_partida, 80), left(p_juego, 40), v_pago)
    on conflict (dueno, partida_id) do nothing;

  if not found then
    -- Ya estaba apuntada: un reenvío. Ni se paga ni es un error — el pato tiene
    -- que poder reintentar sin miedo, que es lo que hace su cola.
    return public.cuacks_estado(v_dueno, true, 'ya-estaba', 0);
  end if;

  -- El monedero puede no existir todavía: se crea al vuelo. Llegar aquí sin
  -- estrenar significa que el estreno falló por red, y quedarse sin cobrar la
  -- partida por eso sería castigar al jugador por un fallo que no es suyo.
  insert into public.cuacks (dueno, saldo, ganado)
    values (v_dueno, v_pago, v_pago)
    on conflict (dueno) do update
      set saldo = cuacks.saldo + v_pago,
          ganado = cuacks.ganado + v_pago,
          actualizado = now();

  -- Retención, y sin `pg_cron`: se recorta al escribir, que es cuando crece.
  delete from public.cuacks_partidas
   where dueno = v_dueno
     and cuando < now() - (public.dias_de_partidas_cuacks() || ' days')::interval;

  return public.cuacks_estado(v_dueno, true, 'pagada', v_pago);
end;
$$;
revoke all on function public.apuntar_partida_cuacks(text, text, text, text, boolean) from public;
grant execute on function public.apuntar_partida_cuacks(text, text, text, text, boolean)
  to anon, authenticated;


/**
 * Cobra el peaje de la broma del «No tocar». Una vez al día.
 *
 * Una al día y no una por partida porque la broma se puede repetir: fallar
 * devuelve a la primera pregunta, pero pasarla dos veces seguidas es cuestión de
 * paciencia, y entonces sería una máquina de hacer cuacks.
 *
 * El nivel lo declara el pato porque vive en su disco; por eso lleva techo (ver
 * `broma_nivel_tope`).
 */
create or replace function public.cobrar_broma(p_secreto text, p_nivel integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text := public.cuacks_dueno(p_secreto);
  v_nivel integer := least(greatest(coalesce(p_nivel, 0), 0), public.broma_nivel_tope());
  v_pago  integer;
  v_dia   date;
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;

  select dia_de_la_broma into v_dia from public.cuacks where dueno = v_dueno;
  if found and v_dia = current_date then
    return public.cuacks_estado(v_dueno, false, 'ya-cobrada', 0);
  end if;

  v_pago := public.broma_suelo() + v_nivel * public.broma_por_nivel();

  insert into public.cuacks (dueno, saldo, ganado, dia_de_la_broma)
    values (v_dueno, v_pago, v_pago, current_date)
    on conflict (dueno) do update
      set saldo = cuacks.saldo + v_pago,
          ganado = cuacks.ganado + v_pago,
          dia_de_la_broma = current_date,
          actualizado = now()
      -- La condición otra vez, y no sobra: entre el `select` de arriba y esto
      -- cabe otro pato del mismo dueño cobrando lo mismo. Sin esto, dos patos a
      -- la vez cobran dos veces.
      where cuacks.dia_de_la_broma is distinct from current_date;

  if not found then
    return public.cuacks_estado(v_dueno, false, 'ya-cobrada', 0);
  end if;

  return public.cuacks_estado(v_dueno, true, 'cobrada', v_pago);
end;
$$;
revoke all on function public.cobrar_broma(text, integer) from public;
grant execute on function public.cobrar_broma(text, integer) to anon, authenticated;


-- -------------------------------------------------------------- Gastarlos --

/**
 * Compra un juego.
 *
 * El precio sale del catálogo de este servidor, no del mensaje: es la otra mitad
 * de que el pato no pueda declarar cifras. Comprobar el saldo aquí tampoco
 * sobra aunque el panel ya lo haya mirado — quien pinta un botón y quien cobra
 * no son el mismo, y de los dos el que no puede equivocarse es el que cobra.
 */
create or replace function public.comprar_juego(p_secreto text, p_juego text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno  text := public.cuacks_dueno(p_secreto);
  v_precio integer;
  v_fila   public.cuacks%rowtype;
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;

  select precio into v_precio from public.juegos_catalogo where id = p_juego;
  if not found then
    return public.cuacks_estado(v_dueno, false, 'juego-desconocido', 0);
  end if;

  select * into v_fila from public.cuacks where dueno = v_dueno for update;
  if not found then
    -- Sin monedero no hay compra. Y no se crea aquí al vuelo, a diferencia de
    -- las partidas: comprar con un monedero recién nacido a cero no puede salir
    -- bien, y el pato tiene que estrenarlo con lo suyo antes de gastar.
    return public.cuacks_estado(v_dueno, false, 'sin-monedero', 0);
  end if;

  -- Los que no cuestan nada —el juego de nivel 1, que es la puerta— no hace
  -- falta comprarlos, y decir «ya lo tienes» es la respuesta correcta.
  if v_precio = 0 or p_juego = any(v_fila.comprados) then
    return public.cuacks_estado(v_dueno, true, 'ya-lo-tienes', 0);
  end if;

  if v_fila.saldo < v_precio then
    return public.cuacks_estado(v_dueno, false, 'no-llega', 0);
  end if;

  update public.cuacks
    set saldo = saldo - v_precio,
        comprados = array_append(comprados, left(p_juego, 40)),
        actualizado = now()
    where dueno = v_dueno;

  return public.cuacks_estado(v_dueno, true, 'comprado', -v_precio);
end;
$$;
revoke all on function public.comprar_juego(text, text) from public;
grant execute on function public.comprar_juego(text, text) to anon, authenticated;


-- ---------------------------------------------------------------- Borrarlo --

/**
 * Tirar el propio monedero. Sólo el propio, y hace falta el secreto.
 *
 * Existe por lo mismo que `borrar_mis_mensajes`: lo que una persona guarda de sí
 * misma tiene que poder quitarlo. Y ojo con lo que significa, porque no hay
 * vuelta atrás y el pato lo tiene que decir con todas las letras: se pierden los
 * cuacks Y los juegos comprados.
 */
create or replace function public.borrar_mis_cuacks(p_secreto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text := public.cuacks_dueno(p_secreto);
begin
  if v_dueno is null then
    return public.cuacks_estado(null, false, 'secreto-corto', 0);
  end if;
  delete from public.cuacks_partidas where dueno = v_dueno;
  delete from public.cuacks where dueno = v_dueno;
  return public.cuacks_estado(v_dueno, true, 'borrado', 0);
end;
$$;
revoke all on function public.borrar_mis_cuacks(text) from public;
grant execute on function public.borrar_mis_cuacks(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- El catálogo sembrado
-- ---------------------------------------------------------------------------
--
-- GENERADO. No se edita a mano: `node tools/catalogo-a-sql.mjs` lo vuelve a
-- sacar del catálogo de verdad (core/game/minijuegos/index.js) y lo pega aquí.
--
-- Se borra lo que ya no está en el catálogo, pero NUNCA se toca `cuacks.comprados`:
-- un juego que se retire un tiempo no puede hacer que nadie pierda lo que pagó.
--
-- >>> CATALOGO <<<
insert into public.juegos_catalogo (id, nivel, precio) values
  ('piedrapapeltijera', 1, 0),
  ('mascotadice', 2, 100),
  ('parimpar', 3, 125),
  ('memoria', 4, 175),
  ('tresenraya', 6, 275),
  ('obstaculos', 8, 350),
  ('punteria', 9, 400),
  ('paleta', 12, 550),
  ('flappy', 14, 625),
  ('agujero', 16, 725),
  ('minigolf', 20, 900),
  ('pong', 24, 1075),
  ('ladrillos', 28, 1250),
  ('lava', 33, 1475),
  ('invasores', 38, 1700),
  ('ahorcado', 43, 1925),
  ('flota', 49, 2200),
  ('pool', 55, 2475),
  ('angry', 61, 2750),
  ('artilleria', 68, 3050)
on conflict (id) do update
  set nivel = excluded.nivel, precio = excluded.precio;

delete from public.juegos_catalogo where id not in (
  'piedrapapeltijera', 'mascotadice', 'parimpar', 'memoria', 'tresenraya', 'obstaculos',
  'punteria', 'paleta', 'flappy', 'agujero', 'minigolf', 'pong', 'ladrillos',
  'lava', 'invasores', 'ahorcado', 'flota', 'pool', 'angry', 'artilleria'
);
-- >>> FIN CATALOGO <<<
