-- =====================================================================
-- Notificaciones al teléfono/PC y protección contra dobles entradas offline
-- Solo AGREGA tablas e índices. No borra nada. Se puede correr dos veces.
-- =====================================================================


-- 1. Dispositivos que reciben notificaciones (tu teléfono, tu PC…)
create table if not exists public.push_suscripciones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  dispositivo  text,
  creado_en    timestamptz not null default now()
);

alter table public.push_suscripciones enable row level security;
drop policy if exists push_suscripciones_ver on public.push_suscripciones;
drop policy if exists push_suscripciones_crear on public.push_suscripciones;
drop policy if exists push_suscripciones_editar on public.push_suscripciones;
drop policy if exists push_suscripciones_borrar on public.push_suscripciones;
create policy push_suscripciones_ver on public.push_suscripciones for select to authenticated using (user_id = auth.uid());
create policy push_suscripciones_crear on public.push_suscripciones for insert to authenticated with check (user_id = auth.uid());
create policy push_suscripciones_editar on public.push_suscripciones for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_suscripciones_borrar on public.push_suscripciones for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.push_suscripciones to authenticated;


-- 2. Avisos ya enviados (para no mandar el mismo dos veces)
--    Solo la función del servidor la usa: sin políticas, nadie más puede leerla.
create table if not exists public.notificaciones_enviadas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  clave      text not null,               -- 'resumen-2026-10-12' o 'tarea-<id>-2026-10-12T15:00'
  creado_en  timestamptz not null default now(),
  unique (user_id, clave)
);
alter table public.notificaciones_enviadas enable row level security;


-- 3. Un hábito solo se puede marcar una vez por día
--    (evita registros dobles si una acción offline se envía dos veces).
--    Si ya hubiera registros repetidos, no se crea y avisa, sin borrar nada.
do $$ begin
  create unique index if not exists habito_registros_unico_dia on public.habito_registros (habito_id, fecha);
exception when unique_violation then
  raise notice 'Hay hábitos marcados dos veces el mismo día; el índice único no se creó.';
end $$;
