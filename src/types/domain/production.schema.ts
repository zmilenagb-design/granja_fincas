import { z } from 'zod';

// Form schema for Milk Production
export const MilkProductionSchema = z.object({
  animal_id: z.string().uuid("Debe seleccionar un animal válido (vaca)"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Debe ser una fecha válida" }),
  shift: z.enum(['MAQUINARIA', 'MAÑANA', 'TARDE', 'NOCHE']),
  quantity_liters: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  notes: z.string().optional(),
});

export type MilkProductionInput = z.infer<typeof MilkProductionSchema>;

// Data schema as received from DB
export interface MilkProductionRecord {
  id: string;
  animal_id: string;
  date: string;
  shift: string;
  quantity_liters: number;
  quality_notes: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  animal?: {
    code: string;
    notes: string | null;
  }
}

// Form schema for Egg Production
export const EggProductionSchema = z.object({
  batch_id: z.string().min(1, "Debe ingresar el nombre del lote"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Debe ser una fecha válida" }),
  total_quantity: z.coerce.number().int("La cantidad debe ser un entero").positive("La cantidad debe ser mayor a 0"),
  damaged_quantity: z.coerce.number().int("La cantidad debe ser un entero").min(0, "Mínimo 0"),
  notes: z.string().optional(),
}).refine(data => data.damaged_quantity <= data.total_quantity, {
  message: "La cantidad dañada no puede superar la total",
  path: ["damaged_quantity"]
});

export type EggProductionInput = z.infer<typeof EggProductionSchema>;

// Data schema as received from DB
export interface EggProductionRecord {
  id: string;
  animal_id: string | null;
  batch_id: string | null;
  date: string;
  total_quantity: number;
  damaged_quantity: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

