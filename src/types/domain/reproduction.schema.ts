import { z } from 'zod';

// --- Enums ---
export const GestationStatusEnum = z.enum([
  'en_seguimiento',
  'confirmada',
  'fallida',
  'parto_exitoso',
]);

export const ServiceTypeEnum = z.enum(['IA', 'monta_natural']);
export type ServiceType = z.infer<typeof ServiceTypeEnum>;

export const ReproductiveEventTypeEnum = z.enum([
  'monta_natural',
  'inseminacion_artificial',
  'servicio',
  'diagnostico',
  'parto',
  'secado',
  'aborto'
]);

export const ReproductiveResultEnum = z.enum(['pendiente', 'positivo', 'negativo']);

export const ReproductiveEventSchema = z.object({
  id: z.string().uuid(),
  event_date: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  
  // Implementation B (dynamic mapped fields):
  female_animal_id: z.string().uuid().optional(),
  male_animal_id: z.string().uuid().nullable().optional(),
  gestation_status: GestationStatusEnum.optional(),
  estimated_birth_date: z.string().nullable().optional(),
  actual_birth_date: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  registered_by: z.string().uuid().optional(),
  event_type: ReproductiveEventTypeEnum,

  // Implementation A (raw fields):
  animal_id: z.string().uuid().optional(),
  service_type: ServiceTypeEnum.nullable().optional(),
  father_id: z.string().uuid().nullable().optional(),
  father_external: z.string().nullable().optional(),
  result: ReproductiveResultEnum.nullable().optional(),
  estimated_delivery_date: z.string().nullable().optional(),
  offspring_count: z.number().int().default(0),
  responsible: z.string().optional(),
});

export type ReproductiveEvent = z.infer<typeof ReproductiveEventSchema>;
export type GestationStatus = z.infer<typeof GestationStatusEnum>;

export type ReproductiveAnimalMini = {
  id: string;
  code: string;
  name?: string | null;
  species_id?: string;
  breed?: { name: string } | null;
};

// --- Combined With Relations DTO ---
export type ReproductiveEventWithRelations = ReproductiveEvent & {
  // Implementation B relations
  female_animal?: ReproductiveAnimalMini | null;
  male_animal?: ReproductiveAnimalMini | null;
  
  // Implementation A relations
  animal?: {
    code: string;
    notes: string | null;
    species: { display_name: string; gestation_days: number | null; is_productive_milk: boolean } | null;
    breed: { name: string } | null;
  } | null;
  father?: {
    code: string;
  } | null;
};

// --- Creation and Update DTOs ---

// Implementation B Create DTO
export const CreateReproductiveEventSchema = z
  .object({
    female_animal_id: z.string().uuid(),
    event_type: ReproductiveEventTypeEnum,
    event_date: z.string().min(1),
    male_animal_id: z.string().uuid().nullable().optional(),
    male_external: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((d) => !(d.male_animal_id && d.male_external?.trim()), {
    message: 'Indique solo macho registrado o solo padre externo, no ambos.',
  });

export type CreateReproductiveEventDTO = z.infer<typeof CreateReproductiveEventSchema>;

// Implementation A Create DTO (mapped from ReproductiveEventSchema)
export const CreateReproductiveEventInputSchema = ReproductiveEventSchema.omit({
  id: true,
  registered_by: true,
  created_at: true,
});

export type CreateReproductiveEventInput = z.infer<typeof CreateReproductiveEventInputSchema>;

// DTO for Service Form
export const ServiceRegistrationSchema = z.object({
  animal_id: z.string().uuid(),
  event_date: z.string().optional(),
  service_type: ServiceTypeEnum,
  father_id: z.string().uuid().optional(),
  father_external: z.string().optional(),
  responsible: z.string().min(2, 'Indica el responsable'),
  notes: z.string().optional(),
}).refine(data => data.father_id || data.father_external, {
  message: "Debes indicar el padre (macho interno o externo)",
  path: ["father_external"],
});

export type ServiceRegistrationInput = z.infer<typeof ServiceRegistrationSchema>;

// Implementation B Update DTO
export const UpdateReproductiveEventSchema = z.object({
  gestation_status: GestationStatusEnum,
  failure_reason: z.string().nullable().optional(),
  actual_birth_date: z.string().nullable().optional(),
  estimated_birth_date: z.string().nullable().optional(),
});

export type UpdateReproductiveEventDTO = z.infer<typeof UpdateReproductiveEventSchema>;
