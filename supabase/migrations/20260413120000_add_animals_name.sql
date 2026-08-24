-- Nombre/apodo opcional (el cliente ya envía este campo; PostgREST falla si no existe en la tabla)
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.animals.name IS 'Nombre o apodo opcional del animal (CU-007, formulario de registro).';
