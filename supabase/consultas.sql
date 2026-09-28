-- Mirar el monedero por dentro, sin tocarlo.
--
-- Se pegan en **SQL Editor** del panel de Supabase, de una en una. Ninguna
-- escribe nada: son todas `select`.
--
-- ---- Por qué esto no lo puede hacer el pato --------------------------------
--
-- El pato se conecta como `anon` y ahí la tabla `cuacks` no se puede ni leer
-- (ver el bloque de permisos de `cuacks.sql`). Eso es a propósito: un monedero
-- no es un marcador, y el saldo de alguien no tiene por qué verlo nadie más. El
-- editor del panel corre como dueño de la base de datos y se salta el RLS, así
-- que **éste es el único sitio desde donde se ve el conjunto**.
--
--
-- ---- Tres cosas que estas consultas NO pueden contestar --------------------
--
-- Conviene saberlas antes de sacar conclusiones de un número:
--
--   1. **Lo pendiente no está aquí.** La cola de partidas sin confirmar vive en
--      el disco de cada uno, no en el servidor (ver `Cartera` en
--      core/game/cuacks.js). Si alguien lleva una semana jugando sin conexión,
--      desde aquí se ve exactamente igual que si no hubiera jugado. Lo más
--      cerca que se puede estar es la consulta 5, que busca el síntoma.
--
--   2. **`cuacks_partidas` sólo guarda una semana**, y además se recorta al
--      escribir y por dueño: quien dejó de jugar conserva su cola de filas
--      viejas hasta que vuelva. O sea que esa tabla es «la última semana de
--      quien sigue jugando, más restos». Para totales de siempre, `cuacks.ganado`.
--
--   3. **Lo que se ganó jugando no se puede separar de lo que se importó.** Al
--      estrenar el monedero, `ganado` nace con la cifra que traía el disco, y no
--      se guarda aparte cuánto fue. Así que `sum(ganado)` es «todo lo que esta
--      gente ha ganado en su vida», no «desde que el monedero está en el
--      servidor». Si ese segundo número hiciera falta, es una columna más en
--      `estrenar_cuacks`; hoy no está.


-- ---------------------------------------------------------------------------
-- 1. ¿Está vivo esto?
-- ---------------------------------------------------------------------------
--
-- La de un vistazo. Si `movidos_24h` es 0 varios días seguidos y hay monederos,
-- algo se ha parado.

select
  count(*)                                                        as monederos,
  count(*) filter (where actualizado > now() - interval '24 hours') as movidos_24h,
  count(*) filter (where actualizado > now() - interval '7 days')   as movidos_7d,
  min(creado)::date                                               as el_primero,
  max(creado)::date                                               as el_ultimo,
  sum(saldo)                                                      as saldo_total,
  sum(ganado)                                                     as ganado_total,
  round(avg(saldo))                                               as saldo_medio
from public.cuacks;


-- ---------------------------------------------------------------------------
-- 2. ¿Se está pagando? Día a día
-- ---------------------------------------------------------------------------
--
-- Sólo llega hasta donde llega la retención (una semana). `duenos` es la cifra
-- que importa: 300 partidas de una persona no son lo mismo que de veinte.

select
  cuando::date               as dia,
  count(*)                   as partidas,
  count(distinct dueno)      as duenos,
  sum(cuacks)                as cuacks_pagados,
  round(avg(cuacks), 1)      as por_partida
from public.cuacks_partidas
group by 1
order by 1 desc;


-- ---------------------------------------------------------------------------
-- 3. A qué se juega
-- ---------------------------------------------------------------------------
--
-- Cruzado con el catálogo del servidor. Si sale un juego que no está en
-- `juegos_catalogo`, es imposible —esa partida no se habría pagado—; si FALTA
-- uno que sí está, es que nadie lo juega, que es otra información.

select
  p.juego,
  c.nivel,
  c.precio,
  count(*)        as partidas,
  sum(p.cuacks)   as cuacks
from public.cuacks_partidas p
left join public.juegos_catalogo c on c.id = p.juego
group by 1, 2, 3
order by partidas desc;


-- ---------------------------------------------------------------------------
-- 4. ¿La gente compra, o sólo acumula?
-- ---------------------------------------------------------------------------
--
-- **CUIDADO con leer esto como ventas.** `comprados` mezcla lo comprado con lo
-- regalado, y es a propósito: al estrenar el monedero se regalan todos los juegos
-- que el nivel de ese pato ya tenía abiertos, y a partir de ahí son suyos —una
-- vez tuyo, da igual cómo llegó—. No hay forma de separarlos desde aquí.
--
-- O sea que un juego con mucho `lo_tienen` y nivel bajo es, sobre todo, regalo.
-- Los que de verdad se están comprando son los de nivel ALTO: ésos no los tenía
-- abierto casi nadie el día que apareció la moneda.
--
-- El de nivel 1 no sale: vale 0 y no se compra nunca.

select
  j.id                                  as juego,
  j.nivel,
  j.precio,
  count(c.dueno)                        as lo_tienen,
  round(100.0 * count(c.dueno)
        / nullif((select count(*) from public.cuacks), 0), 1) as porcentaje
from public.juegos_catalogo j
left join public.cuacks c on j.id = any(c.comprados)
where j.precio > 0
group by 1, 2, 3
order by j.nivel;


-- ---------------------------------------------------------------------------
-- 5. ¿Hay algo atascado?
-- ---------------------------------------------------------------------------
--
-- **La consulta que de verdad se viene a hacer.**
--
-- Un monedero que existe pero nunca ha ganado nada significa que el pato llegó
-- a sincronizar —o sea que el camino de LEER funciona— y después no ha apuntado
-- ni una partida. Que le pase a uno no dice nada: actualizó y no ha jugado. Que
-- le pase a casi todos, con `nunca_movidos` pegado a `monederos`, apunta a que
-- el camino de ESCRIBIR está roto y la gente está llenando su cola local sin
-- que llegue nada.
--
-- Ojo con la lectura, que es fácil equivocarse: si esto sale mal, el saldo que
-- la gente ve en su pantalla sigue subiendo con normalidad —la cola se enseña—,
-- así que nadie se queja. El fallo sería silencioso hasta que alguien
-- reinstalara.

-- La comparación decisiva son las dos primeras columnas: **si hay monederos y
-- `con_partidas_apuntadas` es 0, el camino de escribir está roto.** Lo demás es
-- para matizar.
--
-- `sin_ganar_nunca` sólo pilla a quien empezó de cero: quien vino de un disco con
-- saldo nació con `ganado` ya puesto, así que no sale aquí aunque no haya vuelto
-- a jugar. Por eso no basta con esa columna sola.

select
  (select count(*) from public.cuacks)                            as monederos,
  (select count(distinct dueno) from public.cuacks_partidas)      as con_partidas_apuntadas,
  (select count(distinct dueno) from public.cuacks_partidas
     where cuando > now() - interval '24 hours')                  as han_jugado_hoy,
  (select count(*) from public.cuacks where ganado = 0)           as sin_ganar_nunca,
  (select count(*) from public.cuacks
     where actualizado > now() - interval '7 days')               as movidos_esta_semana;


-- ---------------------------------------------------------------------------
-- 6. Lo que no debería pasar
-- ---------------------------------------------------------------------------
--
-- Cada fila de aquí es una pregunta que hay que contestar, no un dato.
--
--   * `ganado_menor_que_saldo` tiene que ser 0 SIEMPRE. Es imposible por
--     construcción —`ganado` sube con cada ingreso y nunca baja—, así que una
--     sola fila significa que algo escribió por un camino que no es el previsto.
--   * `estreno_al_tope` son los que importaron justo 50 000 al estrenar, que es
--     el tope. Puede ser un jugador de años... o un `pet-state.json` retocado.
--     Se distinguen mirando si además juegan.
--   * `broma_en_el_futuro` tampoco debería existir: la función topa la fecha.

select
  count(*) filter (where ganado < saldo)                  as ganado_menor_que_saldo,
  count(*) filter (where ganado = 50000 or saldo = 50000) as estreno_al_tope,
  count(*) filter (where dia_de_la_broma > current_date)  as broma_en_el_futuro,
  count(*) filter (where cardinality(comprados) > 20)     as con_mas_de_20_juegos,
  max(saldo)                                              as el_saldo_mas_alto,
  max(ganado)                                             as lo_mas_ganado
from public.cuacks;


-- ---------------------------------------------------------------------------
-- 7. ¿Alguien está dándole a la función en bucle?
-- ---------------------------------------------------------------------------
--
-- El tope son 60 partidas por hora y por monedero. Jugando de verdad no se
-- llega: cada partida gasta diez de energía de la mascota, así que de ochenta se
-- juegan ocho y a dormir. Cualquiera que ronde el tope no está jugando.
--
-- Vacío es la respuesta buena.

select
  date_trunc('hour', cuando) as hora,
  left(dueno, 8) || '…'      as quien,
  count(*)                   as partidas,
  sum(cuacks)                as cuacks
from public.cuacks_partidas
group by 1, 2
having count(*) >= 30
order by partidas desc, hora desc
limit 20;


-- ---------------------------------------------------------------------------
-- 8. Cómo está repartido el dinero
-- ---------------------------------------------------------------------------
--
-- Para cuando toque poner precio a un premio o a un cupón: hace falta saber
-- cuánta gente podría pagarlo. Con todos en el primer tramo, cualquier precio
-- que se ponga es inalcanzable.

select
  case
    when saldo = 0            then 'a. 0'
    when saldo < 100          then 'b. 1 – 99'
    when saldo < 500          then 'c. 100 – 499'
    when saldo < 1000         then 'd. 500 – 999'
    when saldo < 5000         then 'e. 1 000 – 4 999'
    else                           'f. 5 000 o más'
  end                    as tramo,
  count(*)               as monederos,
  sum(saldo)             as saldo_del_tramo
from public.cuacks
group by 1
order by 1;


-- ---------------------------------------------------------------------------
-- 9. Los últimos en aparecer
-- ---------------------------------------------------------------------------
--
-- Para ver si sigue llegando gente después de una publicación. El `dueno` va
-- recortado: es un hash y no lleva a ningún sitio, pero entero sólo estorba.

select
  left(dueno, 8) || '…'          as quien,
  creado::timestamp(0)           as nacio,
  actualizado::timestamp(0)      as ultimo_movimiento,
  saldo,
  ganado,
  cardinality(comprados)         as juegos
from public.cuacks
order by creado desc
limit 25;
