-- Lo que Supabase ya trae puesto y un Postgres pelado no.
--
-- Se usa sólo para probar los ficheros de `supabase/` contra un Postgres de usar
-- y tirar (ver `npm run cuacks:sql`). En el proyecto de verdad esto ya está: el
-- esquema `extensions` donde vive pgcrypto y los roles `anon` y `authenticated`,
-- que son con los que se conecta el pato.
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;
grant usage on schema public to anon, authenticated;
grant usage on schema extensions to anon, authenticated;
