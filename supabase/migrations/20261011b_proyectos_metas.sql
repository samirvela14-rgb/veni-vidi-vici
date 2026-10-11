-- =====================================================================
-- Proyectos con etapas de verdad + fecha en metas
-- Solo AGREGA tablas y columnas. No borra nada. Se puede correr dos veces.
-- =====================================================================


-- 1. Proyectos: descripción, fecha objetivo y color
alter table public.proyectos add column if not exists descripcion text;
alter table public.proyectos add column if not exists fecha_objetivo date;
alter table public.proyectos add column if not exists color text not null default 'violeta';
alter table public.proyectos alter column estado set default 'pendiente';
update public.proyectos set estado = 'pendiente' where estado is null;


-- 2. Etapas con nombre (antes solo había un contador)
--    proyecto_id usa el mismo tipo que proyectos.id (uuid o número)
do $$
declare tipo_id text;
begin
  select format_type(atttypid, atttypmod) into tipo_id
  from pg_attribute
  where attrelid = 'public.proyectos'::regclass and attname = 'id';

  execute format($sql$
    create table if not exists public.proyecto_etapas (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
      proyecto_id  %s not null references public.proyectos(id) on delete cascade,
      nombre       text not null,
      hecha        boolean not null default false,
      orden        int not null default 0,
      hecha_en     timestamptz,
      creado_en    timestamptz not null default now()
    )
  $sql$, tipo_id);
end $$;

create index if not exists proyecto_etapas_proyecto_idx on public.proyecto_etapas (proyecto_id, orden);


-- 3. Convierte el contador viejo en etapas: "Etapa 1", "Etapa 2"...
--    (las primeras quedan marcadas según lo que ya tenías hecho)
insert into public.proyecto_etapas (user_id, proyecto_id, nombre, hecha, orden, hecha_en)
select p.user_id, p.id, 'Etapa ' || n, n <= coalesce(p.etapas_hechas, 0), n,
       case when n <= coalesce(p.etapas_hechas, 0) then now() end
from public.proyectos p
cross join lateral generate_series(1, greatest(coalesce(p.etapas_total, 0), 0)) as n
where p.user_id is not null
  and not exists (select 1 from public.proyecto_etapas e where e.proyecto_id = p.id);


-- 4. Metas: fecha objetivo opcional (para "faltan X días")
alter table public.metas add column if not exists fecha_objetivo date;


-- 5. Seguridad de la tabla nueva: cada quien solo ve y toca lo suyo
alter table public.proyecto_etapas enable row level security;
drop policy if exists proyecto_etapas_ver on public.proyecto_etapas;
drop policy if exists proyecto_etapas_crear on public.proyecto_etapas;
drop policy if exists proyecto_etapas_editar on public.proyecto_etapas;
drop policy if exists proyecto_etapas_borrar on public.proyecto_etapas;
create policy proyecto_etapas_ver on public.proyecto_etapas for select to authenticated using (user_id = auth.uid());
create policy proyecto_etapas_crear on public.proyecto_etapas for insert to authenticated with check (user_id = auth.uid());
create policy proyecto_etapas_editar on public.proyecto_etapas for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy proyecto_etapas_borrar on public.proyecto_etapas for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.proyecto_etapas to authenticated;
