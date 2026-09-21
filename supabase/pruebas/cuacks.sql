-- Las cinco funciones del monedero, ejercitadas de verdad.
--
--   npm run cuacks:sql
--
-- Lo lanza `tools/probar-cuacks-sql.mjs` contra un Postgres de usar y tirar en
-- Docker, con `supabase/cuacks.sql` recién aplicado encima. Existe porque el SQL
-- es la últica pieza del monedero que no tiene otra red debajo: es donde se
-- decide cuánto paga una partida y quién puede tocar el saldo de quién, y hasta
-- que esto existió no había forma de comprobarlo sin escribir en el proyecto de
-- verdad —que es justo donde están los cuacks de la gente—.
--
-- El bloque del final es el que más importa: repite las preguntas **como `anon`**,
-- que es el rol con el que se conecta el pato con la clave publicable. Todo lo de
-- arriba corre como dueño de la base de datos, que no es nadie.
\set QUIET on
\pset pager off
\set ON_ERROR_STOP on

create or replace function pg_temp.comprobar(que text, bien boolean, extra text default '')
returns void language plpgsql as $$
begin
  raise notice '% %  %', case when bien then 'OK  ' else 'FALLO' end, que,
    case when extra = '' then '' else '· ' || extra end;
  if not bien then
    perform set_config('mis.fallos', (coalesce(current_setting('mis.fallos', true), '0')::int + 1)::text, false);
  end if;
end $$;

select set_config('mis.fallos', '0', false);

do $$
declare
  s  text := 'secreto-de-pruebas-de-32-caracteres';
  s2 text := 'otro-secreto-de-pruebas-distinto-32';
  r  jsonb;
  pago integer;
begin
  -- ---- El secreto corto no abre nada ------------------------------------
  r := public.mis_cuacks('corto');
  perform pg_temp.comprobar('un secreto corto no devuelve monedero',
    (r->>'motivo') = 'secreto-corto' and (r->>'ok')::boolean = false);

  -- ---- Antes de estrenar -------------------------------------------------
  r := public.mis_cuacks(s);
  perform pg_temp.comprobar('un monedero que no existe se dice, no se inventa',
    (r->>'existe')::boolean = false and (r->>'saldo')::int = 0);

  -- ---- Estrenar con la cifra local --------------------------------------
  r := public.estrenar_cuacks(s, 300, 400, array['minigolf','no-existe'], '2026-01-05');
  perform pg_temp.comprobar('el monedero nace con la cifra del disco',
    (r->>'motivo') = 'estrenado' and (r->>'saldo')::int = 300 and (r->>'ganado')::int = 400,
    format('saldo %s · ganado %s', r->>'saldo', r->>'ganado'));
  perform pg_temp.comprobar('y sólo con los juegos que existen de verdad',
    (r->'comprados') = '["minigolf"]'::jsonb, r->>'comprados');

  -- ---- Estrenar dos veces no es una puerta ------------------------------
  r := public.estrenar_cuacks(s, 999999, 999999, array['pool','angry'], '2026-01-05');
  perform pg_temp.comprobar('estrenar otra vez NO pisa lo que ya había',
    (r->>'motivo') = 'ya-estaba' and (r->>'saldo')::int = 300,
    format('saldo %s', r->>'saldo'));

  -- ---- El tope de importación -------------------------------------------
  r := public.estrenar_cuacks(s2, 10000000, 10000000, '{}', '');
  perform pg_temp.comprobar('un saldo local disparatado se topa al estrenar',
    (r->>'saldo')::int = public.tope_de_estreno(), format('%s', r->>'saldo'));

  -- ---- Pagar una partida -------------------------------------------------
  -- flappy es nivel 14: (5 + 14*3) * 1 = 47 por ganar.
  r := public.apuntar_partida_cuacks(s, 'partida-1', 'flappy', 'victoria', false);
  pago := (r->>'cuacks')::int;
  perform pg_temp.comprobar('una victoria de flappy paga lo que dice la fórmula',
    pago = 47 and (r->>'motivo') = 'pagada', format('%s cuacks', pago));
  perform pg_temp.comprobar('y el saldo sube exactamente eso',
    (r->>'saldo')::int = 300 + pago, format('%s', r->>'saldo'));

  -- ---- La misma partida otra vez ----------------------------------------
  r := public.apuntar_partida_cuacks(s, 'partida-1', 'flappy', 'victoria', false);
  perform pg_temp.comprobar('repetir la misma partida NO paga dos veces',
    (r->>'motivo') = 'ya-estaba' and (r->>'cuacks')::int = 0
    and (r->>'saldo')::int = 300 + pago,
    format('saldo %s', r->>'saldo'));

  -- ---- En red paga el doble ---------------------------------------------
  r := public.apuntar_partida_cuacks(s, 'partida-2', 'flappy', 'victoria', true);
  perform pg_temp.comprobar('en red paga el doble', (r->>'cuacks')::int = pago * 2,
    format('%s', r->>'cuacks'));

  -- ---- Perder paga poco, pero paga --------------------------------------
  r := public.apuntar_partida_cuacks(s, 'partida-3', 'flappy', 'derrota', false);
  perform pg_temp.comprobar('perder paga, y paga round(47*0.3)=14',
    (r->>'cuacks')::int = 14, format('%s', r->>'cuacks'));

  -- ---- Un resultado inventado se paga como derrota -----------------------
  r := public.apuntar_partida_cuacks(s, 'partida-4', 'flappy', 'lo-que-sea', false);
  perform pg_temp.comprobar('un resultado que no existe se paga como derrota',
    (r->>'cuacks')::int = 14, format('%s', r->>'cuacks'));

  -- ---- Un juego que el catálogo no conoce -------------------------------
  r := public.apuntar_partida_cuacks(s, 'partida-5', 'juego-inventado', 'victoria', false);
  perform pg_temp.comprobar('un juego desconocido no paga y lo dice',
    (r->>'motivo') = 'juego-desconocido' and (r->>'cuacks')::int = 0);

  -- ---- Comprar -----------------------------------------------------------
  -- Saldo ahora: 300 + 47 + 94 + 14 + 14 = 469. memoria cuesta 175.
  r := public.comprar_juego(s, 'memoria');
  perform pg_temp.comprobar('comprar descuenta el precio DEL CATÁLOGO',
    (r->>'motivo') = 'comprado' and (r->>'saldo')::int = 469 - 175,
    format('saldo %s', r->>'saldo'));
  perform pg_temp.comprobar('y el juego queda entre los comprados',
    (r->'comprados') @> '["memoria"]'::jsonb, r->>'comprados');

  r := public.comprar_juego(s, 'memoria');
  perform pg_temp.comprobar('comprar lo que ya tienes no vuelve a cobrar',
    (r->>'motivo') = 'ya-lo-tienes' and (r->>'saldo')::int = 294);

  r := public.comprar_juego(s, 'artilleria');   -- 3050, no llega
  perform pg_temp.comprobar('sin saldo no se compra', (r->>'motivo') = 'no-llega');

  r := public.comprar_juego(s, 'piedrapapeltijera');   -- precio 0
  perform pg_temp.comprobar('el juego de la puerta no hace falta comprarlo',
    (r->>'motivo') = 'ya-lo-tienes');

  r := public.comprar_juego('secreto-de-alguien-que-no-tiene-monedero', 'memoria');
  perform pg_temp.comprobar('sin monedero no se compra, y no se crea al vuelo',
    (r->>'motivo') = 'sin-monedero');

  -- ---- La broma ----------------------------------------------------------
  r := public.cobrar_broma(s, 5);
  perform pg_temp.comprobar('la broma paga 120 + nivel*10',
    (r->>'cuacks')::int = 170 and (r->>'motivo') = 'cobrada', format('%s', r->>'cuacks'));

  r := public.cobrar_broma(s, 5);
  perform pg_temp.comprobar('y no se cobra dos veces el mismo día',
    (r->>'motivo') = 'ya-cobrada' and (r->>'cuacks')::int = 0);

  r := public.cobrar_broma(s2, 9999999);
  perform pg_temp.comprobar('un nivel disparatado se topa',
    (r->>'cuacks')::int = 120 + public.broma_nivel_tope() * 10, format('%s', r->>'cuacks'));

  -- ---- El tope por hora --------------------------------------------------
  for i in 1..public.cuacks_partidas_por_hora() loop
    perform public.apuntar_partida_cuacks(s2, 'tope-' || i, 'flappy', 'derrota', false);
  end loop;
  r := public.apuntar_partida_cuacks(s2, 'tope-una-mas', 'flappy', 'victoria', false);
  perform pg_temp.comprobar('pasado el tope por hora deja de pagar',
    (r->>'motivo') = 'demasiadas' and (r->>'cuacks')::int = 0);

  -- ---- Nadie ve el monedero de nadie -------------------------------------
  r := public.mis_cuacks(s2);
  perform pg_temp.comprobar('cada secreto ve SU monedero y sólo el suyo',
    (r->>'saldo')::int <> 294, format('el de s2 tiene %s, el de s tiene 294', r->>'saldo'));

  -- ---- Borrarlo ----------------------------------------------------------
  r := public.borrar_mis_cuacks(s2);
  perform pg_temp.comprobar('borrar el propio monedero lo deja a cero',
    (r->>'motivo') = 'borrado' and (r->>'existe')::boolean = false);
  perform pg_temp.comprobar('y se lleva sus partidas por delante',
    (select count(*) from public.cuacks_partidas
      where dueno = public.cuacks_dueno(s2)) = 0);
  -- 294 de la compra más los 170 de la broma que se cobró por el camino.
  perform pg_temp.comprobar('sin tocar el de al lado',
    (public.mis_cuacks(s)->>'saldo')::int = 464,
    format('%s', public.mis_cuacks(s)->>'saldo'));
end $$;


-- ---- Y ahora lo que importa: qué puede hacer el pato de verdad ------------
--
-- El pato se conecta como `anon` con la clave publicable, que va dentro de la
-- app. O sea que esto es lo que puede hacer CUALQUIERA que la mire. Todo lo de
-- arriba se ha probado como dueño de la base de datos, que no es nadie.

set role anon;

do $$
declare
  falla boolean;
begin
  -- Leer el monedero de todo el mundo.
  begin
    perform 1 from public.cuacks limit 1;
    falla := false;
  exception when insufficient_privilege then falla := true;
  end;
  perform pg_temp.comprobar('como `anon`, la tabla de monederos no se puede leer', falla);

  -- Escribir en el de otro.
  begin
    update public.cuacks set saldo = 999999;
    falla := false;
  exception when insufficient_privilege then falla := true;
  end;
  perform pg_temp.comprobar('ni escribir en ella', falla);

  -- Ver quién ha jugado a qué.
  begin
    perform 1 from public.cuacks_partidas limit 1;
    falla := false;
  exception when insufficient_privilege then falla := true;
  end;
  perform pg_temp.comprobar('ni ver las partidas de nadie', falla);

  -- Cambiar lo que cuestan los juegos.
  begin
    update public.juegos_catalogo set precio = 0;
    falla := false;
  exception when insufficient_privilege then falla := true;
  end;
  perform pg_temp.comprobar('ni poner los juegos a cero', falla);

  -- El catálogo sí se puede leer: no da nada que el pato no traiga ya dentro.
  perform pg_temp.comprobar('el catálogo sí se lee',
    (select count(*) from public.juegos_catalogo) = 20);

  -- Y las cinco puertas, sí.
  perform pg_temp.comprobar('las funciones del monedero sí se pueden llamar',
    (public.mis_cuacks('secreto-de-pruebas-de-32-caracteres')->>'saldo')::int = 464);
end $$;

reset role;
\set QUIET off
