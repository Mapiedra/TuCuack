-- Historial de partidas de TuCuack.
--
-- Se ejecuta en el editor SQL del panel de Supabase del proyecto. Es
-- idempotente: se puede volver a lanzar entero sin romper nada.
--
-- Lee antes `supabase/records.sql`. Aquí se copia su patrón entero —la clave
-- publicable viaja dentro de la app, así que las políticas de fila normales no
-- protegen nada, y la única puerta son funciones `security definer` donde el
-- dueño se DERIVA del secreto— y no se vuelve a explicar. Lo que sigue es sólo
-- lo que cambia.
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
-- Qué se guarda, y qué no
-- -----------------------
--
-- UNA FILA POR PARTIDA TERMINADA y por jugador: el juego, contra quién, cómo
-- acabó, la marca si el juego tiene, y cuándo. Nada más.
--
-- **No se guardan las jugadas.** Se estudió y ninguna de las razones para
-- hacerlo se sostiene: reanudar una partida se resuelve mucho mejor guardando el
-- ESTADO (la extensión ya lo hace al mudarse de pestaña); la repetición de una
-- partida de tres minutos no la va a ver nadie; el antitrampas ya lo cubre el
-- compromiso-y-revelación del protocolo, y un registro de jugadas no añade nada
-- sin un árbitro que juegue la partida; y las estadísticas, que es lo único que
-- se va a mirar, no necesitan las jugadas.
--
--
-- Una fila por jugador, y no una por partida
-- ------------------------------------------
--
-- Podría parecer más natural una sola fila con los dos jugadores. No lo es:
-- cada pato firma con SU secreto y no conoce el del otro, así que una fila
-- compartida exigiría que se pusieran de acuerdo sobre quién la escribe, y que
-- el segundo pudiera modificar la del primero. Eso es justo lo que el diseño de
-- `records.sql` impide a propósito.
--
-- Así que cada uno escribe la suya, con el nombre del rival dentro. Consecuencia
-- que hay que asumir: los dos lados pueden no coincidir si uno miente sobre el
-- resultado. Da igual, porque **cada uno sólo ve la suya**: no hay una verdad
-- compartida que defender, sino el cuaderno de cada cual.
--
--
-- Leer tampoco es público
-- -----------------------
--
-- El marcador es una tabla de máximas y se lee entera; esto es el historial de
-- alguien. Con quién juegas y cuándo no tiene por qué poder enumerarlo
-- cualquiera que instale la app, así que aquí NO hay política de lectura: leer
-- también pasa por una función que exige el secreto. Sin secreto no sale nada.
--
--
-- La tabla no crece para siempre
-- ------------------------------
--
-- Sin nada que lo impida, esto crece con cada partida hasta el fin de los
-- tiempos. En vez de montar una caducidad por fechas —que necesitaría `pg_cron`,
-- que hay que mantener y que en el plan gratis es una pieza más que puede
-- fallar— la propia función de escritura **recorta**: al guardar, deja las
-- TOPE_HISTORIAL más recientes de ese dueño y borra el resto.
--
-- Es más simple y además acota lo peor: como sólo se puede escribir en las filas
-- propias, nadie puede hacer crecer la tabla más allá de su cupo. Lo que sí es
-- ilimitado es cuántas identidades se pueden inventar, y de eso —igual que en
-- `records.sql`— no protege nada de aquí.


create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------- La tabla --

create table if not exists public.partidas (
  -- sha256 del secreto del dueño, en hexadecimal. Lo mismo que en `records`.
  dueno     text        not null,
  -- Identificador de la partida dentro de la sala. Va en la clave primaria para
  -- que guardar dos veces la misma partida —un reintento, una revancha que
  -- termina donde empezó— no deje filas repetidas.
  id        text        not null,
  juego     text        not null,
  -- El nombre que anunciaba el rival. No su identidad: eso no se guarda, porque
  -- no hace falta para nada de lo que se enseña y sería empezar a fichar gente.
  rival     text        not null,
  resultado text        not null,
  -- La marca de la partida, si el juego tiene. `null` cuando no.
  marca     integer,
  jugada_el timestamptz not null default now(),
  primary key (dueno, id),

  constraint partidas_dueno_ok     check (dueno ~ '^[0-9a-f]{64}$'),
  constraint partidas_id_ok        check (char_length(id) between 1 and 80),
  constraint partidas_juego_ok     check (char_length(juego) between 1 and 40),
  constraint partidas_rival_ok     check (char_length(rival) between 1 and 40),
  constraint partidas_resultado_ok check (resultado in ('victoria', 'derrota', 'empate')),
  constraint partidas_marca_ok     check (marca is null or (marca >= 0 and marca <= 10000000))
);

-- Para «mis últimas partidas», que es la única consulta que existe.
create index if not exists partidas_dueno_fecha
  on public.partidas (dueno, jugada_el desc);


-- --------------------------------------------------------------- El acceso --

alter table public.partidas enable row level security;

-- Ni leer. A diferencia del marcador, aquí no hay nada público: la única forma
-- de sacar filas es `mis_partidas`, y exige el secreto.
revoke all on public.partidas from anon, authenticated;


-- ------------------------------------------------------------- Las puertas --

-- Cuántas partidas se le guardan a cada uno. Con veinte por pantalla, cien es
-- historial de sobra y son unos 15 KB por dueño.
create or replace function public.tope_historial_partidas()
returns integer language sql immutable
-- Aunque no devuelva más que un número: sin `search_path` fijo, el linter avisa
-- con razón. Vacío basta — aquí no se resuelve ningún nombre.
set search_path = ''
as $$ select 100 $$;

-- Y sin `execute` para nadie de fuera: sólo la llaman las funciones de este
-- fichero, que corren como el dueño. Por defecto se crea abierta a todos.
revoke all on function public.tope_historial_partidas() from public;

drop function if exists public.guardar_partida(text, text, text, text, text, integer);

create or replace function public.guardar_partida(
  p_secreto   text,
  p_id        text,
  p_juego     text,
  p_rival     text,
  p_resultado text,
  p_marca     integer
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text;
  v_tope  integer := public.tope_historial_partidas();
begin
  -- Un secreto corto se podría adivinar a fuerza de llamadas, y aquí no hay
  -- quien las cuente. Los que genera el pato son de 32.
  if p_secreto is null or char_length(p_secreto) < 24 then
    return 'secreto-corto';
  end if;
  if p_resultado not in ('victoria', 'derrota', 'empate') then
    return 'resultado-malo';
  end if;
  if p_id is null or char_length(p_id) = 0 or char_length(p_id) > 80 then
    return 'id-malo';
  end if;

  v_dueno := encode(digest(p_secreto, 'sha256'), 'hex');

  -- `do nothing` y no `do update`: una partida terminada no cambia. Si llega
  -- dos veces —un reintento del pato— la segunda no toca nada y se dice.
  insert into public.partidas (dueno, id, juego, rival, resultado, marca)
    values (v_dueno, left(p_id, 80), left(p_juego, 40), left(p_rival, 40), p_resultado, p_marca)
    on conflict (dueno, id) do nothing;

  if not found then
    return 'ya-estaba';
  end if;

  -- Y se recorta, que es lo que impide que esto crezca sin fin. Se hace aquí y
  -- no en una tarea programada a propósito: menos piezas, y el cupo se aplica
  -- exactamente cuando se puede pasar de él.
  delete from public.partidas
   where dueno = v_dueno
     and (dueno, id) not in (
       select dueno, id from public.partidas
        where dueno = v_dueno
        order by jugada_el desc, id desc
        limit v_tope
     );

  return 'guardada';
end;
$$;

revoke all on function public.guardar_partida(text, text, text, text, text, integer) from public;
grant execute on function public.guardar_partida(text, text, text, text, text, integer)
  to anon, authenticated;


-- Leer las propias. Sin secreto no devuelve nada: no es que dé error, es que no
-- hay filas que enseñar, que es la respuesta correcta a «enséñame lo de alguien
-- de quien no sé el secreto».
drop function if exists public.mis_partidas(text, integer);

create or replace function public.mis_partidas(
  p_secreto text,
  p_tope    integer default 40
)
returns table (
  id        text,
  juego     text,
  rival     text,
  resultado text,
  marca     integer,
  jugada_el timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dueno text;
begin
  if p_secreto is null or char_length(p_secreto) < 24 then
    return;
  end if;

  v_dueno := encode(digest(p_secreto, 'sha256'), 'hex');

  return query
    select p.id, p.juego, p.rival, p.resultado, p.marca, p.jugada_el
      from public.partidas p
     where p.dueno = v_dueno
     order by p.jugada_el desc
     limit least(greatest(coalesce(p_tope, 40), 1), public.tope_historial_partidas());
end;
$$;

revoke all on function public.mis_partidas(text, integer) from public;
grant execute on function public.mis_partidas(text, integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Borrar el historial de alguien
-- ---------------------------------------------------------------------------
--
-- No hay función para ello, y es deliberado: con la clave publicable no se
-- borra nada, igual que en `records`. Quien quiera irse del todo tiene una vía
-- que no depende de nadie —borrar sus ajustes, y con ellos el secreto, deja las
-- filas huérfanas y sin forma de volver a alcanzarlas— y para borrarlas de
-- verdad se viene aquí, que va con `service_role`:
--
--   delete from public.partidas where dueno = '<sha256 del secreto>';
--
-- Conviene decirlo en la interfaz antes que descubrirlo el día que alguien lo
-- pida.
