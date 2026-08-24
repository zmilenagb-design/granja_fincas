import { z } from 'zod';

export const HealthEventTypeEnum = z.enum(['enfermedad', 'accidente', 'lesion', 'otro']);
export const RecoveryStatusEnum = z.enum([
  'en_tratamiento',
  'recuperado',
  'cronico',
  'fallecido',
]);

export const HealthEventSchema = z.object({
  id: z.string().uuid(),
  animal_id: z.string().uuid(),
  event_type: HealthEventTypeEnum,
  detected_at: z.string(),
  description: z.string(),
  diagnosis: z.string().nullable().optional(),
  recovery_status: RecoveryStatusEnum.default('en_tratamiento'),
  resolved_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_correction: z.boolean().optional(),
  corrects_id: z.string().uuid().nullable().optional(),
  registered_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type HealthEvent = z.infer<typeof HealthEventSchema>;

/** Línea de tiempo unificada (tabla animal_events, RF012) */
export const AnimalEventTypeEnum = z.enum([
  'ingreso',
  'actualizacion',
  'alimentacion',
  'vacunacion',
  'salud',
  'reproductivo',
  'parto',
  'produccion',
  'egreso',
  'correccion',
]);

export type AnimalEventType = z.infer<typeof AnimalEventTypeEnum>;

export const AnimalEventSchema = z.object({
  id: z.string().uuid(),
  animal_id: z.string().uuid(),
  event_type: AnimalEventTypeEnum,
  event_date: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  reference_id: z.string().uuid().nullable().optional(),
  reference_table: z.string().nullable().optional(),
  performed_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
});

export type AnimalEvent = z.infer<typeof AnimalEventSchema>;

export const HealthTreatmentSchema = z.object({
  id: z.string().uuid(),
  health_event_id: z.string().uuid(),
  supply_id: z.string().uuid().nullable().optional(),
  medication_name: z.string(),
  dose: z.string().nullable().optional(),
  dose_quantity: z.number().nullable().optional(),
  dose_unit: z.string().nullable().optional(),
  applied_at: z.string(),
  responsible: z.string(),
  notes: z.string().nullable().optional(),
  registered_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
});

export type HealthTreatment = z.infer<typeof HealthTreatmentSchema>;

export const HealthTreatmentInputSchema = z.object({
  medication_name: z.string().min(1, 'Indica el medicamento'),
  dose: z.string().optional(),
  applied_at: z.string().min(1),
  responsible: z.string().min(1, 'Indica responsable del tratamiento'),
  supply_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type HealthTreatmentInput = z.infer<typeof HealthTreatmentInputSchema>;

/** Alta de evento de salud (sin registered_by: lo asigna el repositorio) */
export const CreateHealthEventInputSchema = z.object({
  animal_id: z.string().uuid(),
  event_type: HealthEventTypeEnum,
  detected_at: z.string(),
  description: z.string().min(1),
  diagnosis: z.string().nullable().optional(),
  recovery_status: RecoveryStatusEnum.default('en_tratamiento'),
  resolved_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  treatments: z.array(HealthTreatmentInputSchema).optional(),
});

export type CreateHealthEventInput = z.infer<typeof CreateHealthEventInputSchema>;

/** @deprecated usar CreateHealthEventInput */
export const CreateHealthEventSchema = HealthEventSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  is_correction: true,
  corrects_id: true,
});

export type CreateHealthEventDTO = z.infer<typeof CreateHealthEventSchema>;

export type AnimalTimelineFilter = {
  eventTypes?: AnimalEventType[];
  fromDate?: string;
  toDate?: string;
};

// ====================================================================
// SISTEMA DE VACUNACIÓN (Fase 3, Punto 4)
// ====================================================================

/** Esquema/regla de vacunación por especie */
export const VaccineSchemeSchema = z.object({
  id: z.string().uuid(),
  species_id: z.string().uuid().nullable().optional(),
  vaccine_name: z.string(),
  disease_target: z.string(),
  apply_at_age_days: z.number().int().nullable().optional(),
  revaccinate_every_days: z.number().int().nullable().optional(),
  is_mandatory: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type VaccineScheme = z.infer<typeof VaccineSchemeSchema>;

export const CreateVaccineSchemeInputSchema = z.object({
  species_id: z.string().uuid().nullable().optional(),
  vaccine_name: z.string().min(2, 'Ingresa el nombre de la vacuna'),
  disease_target: z.string().min(2, 'Ingresa la enfermedad objetivo'),
  apply_at_age_days: z.number().int().positive().nullable().optional(),
  revaccinate_every_days: z.number().int().positive().nullable().optional(),
  is_mandatory: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export type CreateVaccineSchemeInput = z.infer<typeof CreateVaccineSchemeInputSchema>;

/** Registro histórico de una dosis aplicada a un animal */
export const VaccinationRecordSchema = z.object({
  id: z.string().uuid(),
  animal_id: z.string().uuid(),
  scheme_id: z.string().uuid().nullable().optional(),
  supply_id: z.string().uuid().nullable().optional(),
  vaccine_name: z.string(),
  quantity_used: z.number().positive(),
  unit: z.string(),
  applied_at: z.string(),
  next_dose_date: z.string().nullable().optional(),
  responsible: z.string(),
  notes: z.string().nullable().optional(),
  registered_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
});

export type VaccinationRecord = z.infer<typeof VaccinationRecordSchema>;

/** Input para registrar una vacunación (individual o masiva) */
export const CreateVaccinationInputSchema = z.object({
  animal_id: z.string().uuid(),
  scheme_id: z.string().uuid().nullable().optional(),
  supply_id: z.string().uuid().nullable().optional(),
  vaccine_name: z.string().min(2, 'Ingresa el nombre de la vacuna'),
  quantity_used: z.number().positive('La cantidad debe ser mayor a 0'),
  unit: z.string().min(1, 'Indica la unidad'),
  applied_at: z.string().optional(),
  next_dose_date: z.string().nullable().optional(),
  responsible: z.string().min(2, 'Indica el responsable de la aplicación'),
  notes: z.string().nullable().optional(),
});

export type CreateVaccinationInput = z.infer<typeof CreateVaccinationInputSchema>;

/** Alerta de vacunación calculada (animales atrasados o próximos a vencer) */
export interface VaccineAlert {
  animal_id: string;
  animal_code: string;
  animal_name: string | null;
  species_name: string;
  vaccine_name: string;
  next_dose_date: string;         // ISO date
  days_overdue: number;           // positivo = atrasado, negativo = faltan X días
  urgency: 'immediate' | 'soon' | 'ok';
}

