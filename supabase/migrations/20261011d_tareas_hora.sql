-- =====================================================================
-- Tareas con hora (para agendar con Jarvis: "mañana Comprar verduras 3pm")
-- Solo AGREGA una columna. No borra nada. Se puede correr dos veces.
-- =====================================================================

alter table public.tarjetas add column if not exists hora time;
