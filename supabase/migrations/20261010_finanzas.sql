-- =====================================================================
-- Finanzas: presupuesto, metas con abonos, deuda y score de Jarvis
-- Solo AGREGA tablas y columnas. No borra nada. Se puede correr dos veces.
-- =====================================================================


-- 1. Categorías del presupuesto (lo que edita "Mi presupuesto")
--    La app las precarga con tu tabla la primera vez que abres Finanzas.
create table if not exists public.presupuesto_categorias (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo            text not null default 'gasto' check (tipo in ('gasto', 'ingreso')),
  grupo           text not null check (grupo in ('Vivir', 'Entretenimiento', 'Proyectos', 'Deuda', 'Ahorro', 'Ingresos')),
  nombre          text not null,
  icono           text not null default 'circle',
  monto_planeado  numeric(12, 2) not null default 0,
  orden           int not null default 0,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now()
);


-- 2. Configuración: ingreso de referencia y tus reglas
create table if not exists public.presupuesto_config (
  user_id                  uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ingreso_referencia       numeric(12, 2) not null default 0,
  ahorro_minimo_pct        numeric(5, 2) not null default 20,
  entretenimiento_max_pct  numeric(5, 2) not null default 15,
  actualizado_en           timestamptz not null default now()
);


-- 3. Metas financieras: soporte para deudas (Deuda TV) y valores por defecto
alter table public.metas_financieras add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.metas_financieras add column if not exists tipo text not null default 'meta';
alter table public.metas_financieras add column if not exists cuota_mensual numeric(12, 2);
alter table public.metas_financieras add column if not exists total_pagos int;
alter table public.metas_financieras add column if not exists creado_en timestamptz not null default now();
alter table public.metas_financieras alter column valor_actual set default 0;
alter table public.metas_financieras alter column completada set default false;

do $$ begin
  alter table public.metas_financieras add constraint metas_financieras_tipo_check check (tipo in ('meta', 'deuda'));
exception when duplicate_object then null;
end $$;


-- 4. Transacciones: a qué categoría pertenece y si es abono/pago de una meta
alter table public.transacciones add column if not exists categoria_id uuid references public.presupuesto_categorias(id) on delete set null;

-- meta_id usa el mismo tipo que metas_financieras.id (uuid o número)
do $$
declare tipo_id text;
begin
  select format_type(atttypid, atttypmod) into tipo_id
  from pg_attribute
  where attrelid = 'public.metas_financieras'::regclass and attname = 'id';

  execute format(
    'alter table public.transacciones add column if not exists meta_id %s references public.metas_financieras(id) on delete set null',
    tipo_id
  );
end $$;

create index if not exists transacciones_user_fecha_idx on public.transacciones (user_id, fecha);


-- 5. Análisis diario de Jarvis (score + comentario + datos que usó)
create table if not exists public.analisis_financiero (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  mes         text not null,            -- '2026-10'
  puntaje     int not null check (puntaje between 0 and 100),
  comentario  text not null,
  datos       jsonb,                    -- resumen que vio Jarvis, para recordarlo después
  creado_en   timestamptz not null default now(),
  unique (user_id, fecha)
);


-- 6. Seguridad: cada quien solo ve y modifica sus propios datos
do $$
declare t text;
begin
  foreach t in array array[
    'presupuesto_categorias', 'presupuesto_config', 'analisis_financiero',
    'metas_financieras', 'transacciones'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_propios'
    ) then
      execute format(
        'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_propios', t
      );
    end if;
  end loop;
end $$;
