-- =====================================================================
-- Arreglo: vuelve a crear las reglas de seguridad de Finanzas
-- (error "new row violates row-level security policy")
-- Solo toca las reglas de las tablas nuevas. No borra datos.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['presupuesto_categorias', 'presupuesto_config', 'analisis_financiero']
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'La tabla % no existe todavía, se salta', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Quita versiones anteriores de estas reglas, si existen
    execute format('drop policy if exists %I on public.%I', t || '_propios', t);
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('drop policy if exists %I on public.%I', t || '_borrar', t);

    -- Una regla por acción: cada usuario solo ve y toca sus propias filas
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_ver', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_crear', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_editar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_borrar', t);

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Muestra cómo quedaron las reglas (copia este resultado si algo sigue fallando)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('presupuesto_categorias', 'presupuesto_config', 'analisis_financiero', 'metas_financieras', 'transacciones')
order by tablename, policyname;
