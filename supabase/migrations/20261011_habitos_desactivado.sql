-- =====================================================================
-- Hábitos: columna que falta para el heatmap, las rachas y eliminar hábitos
-- Solo AGREGA una columna. No borra nada. Se puede correr dos veces.
-- =====================================================================

alter table public.habitos add column if not exists desactivado_en timestamptz;

-- Si ya había hábitos marcados como inactivos, les pone fecha de hoy
update public.habitos
set desactivado_en = now()
where activo = false and desactivado_en is null;
