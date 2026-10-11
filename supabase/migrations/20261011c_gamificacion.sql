-- =====================================================================
-- Gamificación: monedas separadas del XP, tienda por niveles, poderes,
-- logros con recompensa y XP por tareas completadas.
-- Solo AGREGA tablas y columnas. No borra nada. Se puede correr dos veces.
--
-- Saldo de monedas = floor(XP total / 20) + bonos - compras
-- (gastar monedas nunca toca tu XP ni tu nivel)
-- =====================================================================


-- 1. Compras en la tienda (premios reales y poderes de la app)
create table if not exists public.compras (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('real', 'app')),
  clave      text not null,               -- id del premio o del poder (protector, descanso, doble_xp…)
  nombre     text not null,
  costo      int not null check (costo >= 0),
  usado_en   timestamptz,                 -- para poderes que se gastan (protector de racha)
  creado_en  timestamptz not null default now()
);
create index if not exists compras_user_idx on public.compras (user_id, clave);


-- 2. Bonos: monedas y XP extra que se cobran una sola vez
--    (logros, objetivos semanales, bono mensual de finanzas)
create table if not exists public.bonos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave      text not null,               -- 'logro-racha_7', 'objetivo-2026-10-05-tareas_10', 'finanzas-2026-09'
  xp         int not null default 0,
  monedas    int not null default 0,
  creado_en  timestamptz not null default now(),
  unique (user_id, clave)
);


-- 3. Días especiales de hábitos: protegidos o de descanso (no rompen la racha)
create table if not exists public.dias_especiales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha      date not null,
  tipo       text not null check (tipo in ('protector', 'descanso')),
  creado_en  timestamptz not null default now(),
  unique (user_id, fecha)
);


-- 4. Ajustes del jugador: título personalizado y fondo del dashboard
create table if not exists public.ajustes_jugador (
  user_id               uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  titulo_personalizado  text,
  fondo_dashboard       text,
  actualizado_en        timestamptz not null default now()
);


-- 5. Recompensas: nivel de precio, emoji y si cuestan dinero de verdad
alter table public.recompensas add column if not exists nivel text not null default 'pequeno';
alter table public.recompensas add column if not exists emoji text not null default '🎁';
alter table public.recompensas add column if not exists costo_monedas int;
alter table public.recompensas add column if not exists monto_dinero numeric(12, 2);

do $$ begin
  alter table public.recompensas add constraint recompensas_nivel_check
    check (nivel in ('pequeno', 'mediano', 'grande', 'epico'));
exception when duplicate_object then null;
end $$;

-- Las recompensas viejas (en XP) pasan al nivel más cercano en monedas
update public.recompensas
set nivel = case
      when coalesce(costo_xp, 0) / 20 <= 10 then 'pequeno'
      when coalesce(costo_xp, 0) / 20 <= 30 then 'mediano'
      when coalesce(costo_xp, 0) / 20 <= 60 then 'grande'
      else 'epico'
    end,
    costo_monedas = case
      when coalesce(costo_xp, 0) / 20 <= 10 then 10
      when coalesce(costo_xp, 0) / 20 <= 30 then 30
      when coalesce(costo_xp, 0) / 20 <= 60 then 60
      else 150
    end
where costo_monedas is null;

alter table public.recompensas alter column costo_xp set default 0;


-- 6. Tareas: cuándo se completaron (para el XP y los objetivos semanales)
alter table public.tarjetas add column if not exists completada_en timestamptz;


-- 7. Seguridad: cada quien solo ve y toca lo suyo
do $$
declare t text;
begin
  foreach t in array array['compras', 'bonos', 'dias_especiales', 'ajustes_jugador']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('drop policy if exists %I on public.%I', t || '_borrar', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_ver', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_crear', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_editar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_borrar', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
