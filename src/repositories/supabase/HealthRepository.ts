import { IHealthRepository } from '../IHealthRepository';
import {
  HealthEvent,
  CreateHealthEventInput,
  AnimalEvent,
  AnimalTimelineFilter,
  VaccineScheme,
  CreateVaccineSchemeInput,
  VaccinationRecord,
  CreateVaccinationInput,
  VaccineAlert,
} from '@/types/domain/health.schema';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseHealthRepository implements IHealthRepository {
  constructor(private supabase: SupabaseClient) { }

  async getByAnimal(animalId: string): Promise<HealthEvent[]> {
    const { data, error } = await this.supabase
      .from('health_events')
      .select('*')
      .eq('animal_id', animalId)
      .order('detected_at', { ascending: false });

    if (error) throw new Error(`Error al obtener historial de salud: ${error.message}`);
    return data as HealthEvent[];
  }

  async getTimelineByAnimal(
    animalId: string,
    filter?: AnimalTimelineFilter
  ): Promise<AnimalEvent[]> {
    let q = this.supabase
      .from('animal_events')
      .select('*')
      .eq('animal_id', animalId)
      .order('event_date', { ascending: false });

    if (filter?.eventTypes?.length) {
      q = q.in('event_type', filter.eventTypes);
    }
    if (filter?.fromDate) {
      q = q.gte('event_date', `${filter.fromDate}T00:00:00.000Z`);
    }
    if (filter?.toDate) {
      q = q.lte('event_date', `${filter.toDate}T23:59:59.999Z`);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Error al cargar historial integral: ${error.message}`);
    return (data ?? []) as AnimalEvent[];
  }

  async addHealthEvent(input: CreateHealthEventInput): Promise<HealthEvent> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Debes iniciar sesión para registrar un evento de salud.');
    }

    const recovery = input.recovery_status ?? 'en_tratamiento';
    let resolvedAt = input.resolved_at?.trim() || null;
    if ((recovery === 'recuperado' || recovery === 'fallecido') && !resolvedAt) {
      resolvedAt = input.detected_at;
    }

    const row: Record<string, unknown> = {
      animal_id: input.animal_id,
      event_type: input.event_type,
      detected_at: input.detected_at,
      description: input.description.trim(),
      diagnosis: input.diagnosis?.trim() || null,
      recovery_status: recovery,
      resolved_at: resolvedAt,
      notes: input.notes?.trim() || null,
      registered_by: user.id,
    };

    const { data: created, error: insertErr } = await this.supabase
      .from('health_events')
      .insert(row)
      .select()
      .single();

    if (insertErr) throw new Error(`Error al registrar evento de salud: ${insertErr.message}`);

    const event = created as HealthEvent;
    const treatments = input.treatments?.filter(
      (t) => t.medication_name?.trim() && t.responsible?.trim()
    );

    if (treatments?.length) {
      const treatRows = treatments.map((t) => ({
        health_event_id: event.id,
        medication_name: t.medication_name.trim(),
        dose: t.dose?.trim() || null,
        applied_at: t.applied_at,
        responsible: t.responsible.trim(),
        supply_id: t.supply_id ?? null,
        notes: t.notes?.trim() || null,
        registered_by: user.id,
      }));

      const { error: treatErr } = await this.supabase
        .from('health_treatments')
        .insert(treatRows);

      if (treatErr) {
        throw new Error(`Evento guardado pero falló el tratamiento: ${treatErr.message}`);
      }
    }

    return event;
  }

  async getHealthAlerts(): Promise<unknown[]> {
    const { data, error } = await this.supabase
      .from('health_events')
      .select('*, animals(code)')
      .eq('recovery_status', 'en_tratamiento')
      .order('detected_at', { ascending: false });

    if (error) throw new Error(`Error al obtener alertas de salud: ${error.message}`);
    return data ?? [];
  }

  // ── VACUNACIÓN ─────────────────────────────────────────────────────────

  async getVaccineSchemes(speciesId?: string): Promise<VaccineScheme[]> {
    let q = this.supabase
      .from('vaccine_schemes')
      .select('*, species:species_id(id, name, display_name)')
      .eq('is_active', true)
      .order('vaccine_name');

    if (speciesId) {
      q = q.or(`species_id.eq.${speciesId},species_id.is.null`);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Error al cargar esquemas de vacunación: ${error.message}`);
    return (data ?? []) as VaccineScheme[];
  }

  async createVaccineScheme(input: CreateVaccineSchemeInput): Promise<VaccineScheme> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) throw new Error('Debes iniciar sesión.');

    const { data, error } = await this.supabase
      .from('vaccine_schemes')
      .insert({ ...input, species_id: input.species_id || null, created_by: user.id })
      .select()
      .single();

    if (error) throw new Error(`Error al crear esquema: ${error.message}`);
    return data as VaccineScheme;
  }

  async updateVaccineScheme(
    id: string,
    input: Partial<CreateVaccineSchemeInput>
  ): Promise<VaccineScheme> {
    const { data, error } = await this.supabase
      .from('vaccine_schemes')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar esquema: ${error.message}`);
    return data as VaccineScheme;
  }

  async deleteVaccineScheme(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('vaccine_schemes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Error al eliminar esquema: ${error.message}`);
  }

  async registerVaccination(input: CreateVaccinationInput): Promise<VaccinationRecord> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) throw new Error('Debes iniciar sesión para registrar una vacuna.');

    // 1. Verificar stock disponible
    if (input.supply_id) {
      const { data: supplyRow, error: supplyErr } = await this.supabase
        .from('supplies')
        .select('current_stock, unit')
        .eq('id', input.supply_id)
        .single();

      if (supplyErr || !supplyRow) throw new Error('Insumo no encontrado.');
      if (Number(supplyRow.current_stock) < input.quantity_used) {
        throw new Error(
          `Stock insuficiente. Disponible: ${supplyRow.current_stock} ${supplyRow.unit}`
        );
      }
    }

    // 2. Insertar registro de vacunación
    const { data: record, error: recErr } = await this.supabase
      .from('vaccination_records')
      .insert({
        animal_id: input.animal_id,
        scheme_id: input.scheme_id || null,
        supply_id: input.supply_id || null,
        vaccine_name: input.vaccine_name.trim(),
        quantity_used: input.quantity_used,
        unit: input.unit.trim(),
        applied_at: input.applied_at || new Date().toISOString(),
        next_dose_date: input.next_dose_date || null,
        responsible: input.responsible.trim(),
        notes: input.notes?.trim() || null,
        registered_by: user.id,
      })
      .select()
      .single();

    if (recErr) throw new Error(`Error al registrar vacuna: ${recErr.message}`);

    const actualAppliedAt = record.applied_at;

    // 3. Descontar stock del insumo (mediante función RPC)
    if (input.supply_id) {
      const { error: stockErr } = await this.supabase.rpc('decrement_supply_stock', {
        p_supply_id: input.supply_id,
        p_quantity: input.quantity_used,
      });
      if (stockErr) {
        console.error('Advertencia: vacuna registrada pero falló descuento de stock:', stockErr.message);
      }
    }

    // 4. Insertar evento en línea de tiempo del animal
    const nextDoseText = input.next_dose_date
      ? ` · Próxima dosis: ${new Date(input.next_dose_date).toLocaleDateString('es-CO')}`
      : '';
    await this.supabase.from('animal_events').insert({
      animal_id: input.animal_id,
      event_type: 'vacunacion',
      event_date: actualAppliedAt,
      title: `Vacunación: ${input.vaccine_name}`,
      description: `Dosis aplicada: ${input.quantity_used} ${input.unit}${nextDoseText}${input.notes ? ` · ${input.notes}` : ''}`,
      reference_id: (record as VaccinationRecord).id,
      reference_table: 'vaccination_records',
      performed_by: user.id,
    });

    // 5. Actualizar estado de vacunación del animal
    await this.supabase
      .from('animals')
      .update({ vaccination_status: 'al_dia' })
      .eq('id', input.animal_id);

    return record as VaccinationRecord;
  }

  async getVaccinationsByAnimal(animalId: string): Promise<VaccinationRecord[]> {
    const { data, error } = await this.supabase
      .from('vaccination_records')
      .select('*, scheme:scheme_id(vaccine_name, disease_target), supply:supply_id(name, unit)')
      .eq('animal_id', animalId)
      .order('applied_at', { ascending: false });

    if (error) throw new Error(`Error al cargar historial de vacunas: ${error.message}`);
    return (data ?? []) as VaccinationRecord[];
  }

  async getVaccinationAlerts(): Promise<VaccineAlert[]> {
    const today = new Date();
    const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in15DaysStr = in15Days.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('vaccination_records')
      .select(`
        id,
        vaccine_name,
        next_dose_date,
        animal:animal_id (
          id,
          code,
          notes,
          status,
          species:species_id ( display_name )
        )
      `)
      .not('next_dose_date', 'is', null)
      .lte('next_dose_date', in15DaysStr)
      .order('next_dose_date', { ascending: true });

    if (error) throw new Error(`Error al cargar alertas de vacunación: ${error.message}`);

    const rows = data ?? [];
    const alerts: VaccineAlert[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const animal = row.animal as unknown as Record<string, unknown> | null;
      if (!animal || (animal.status as string) !== 'activo') continue;

      const key = `${animal.id}-${row.vaccine_name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nextDate = row.next_dose_date as string;
      const diffMs = new Date(nextDate).getTime() - new Date(todayStr).getTime();
      const daysOverdue = -Math.round(diffMs / (1000 * 60 * 60 * 24));

      const species = animal.species as Record<string, unknown> | null;
      let animalName: string | null = null;
      const notesStr = animal.notes as string | null;
      if (notesStr) {
        const match = notesStr.match(/^Apodo:\s*(.+)/m);
        if (match) animalName = match[1].trim();
      }

      alerts.push({
        animal_id: animal.id as string,
        animal_code: animal.code as string,
        animal_name: animalName,
        species_name: (species?.display_name as string) ?? 'Especie desconocida',
        vaccine_name: row.vaccine_name as string,
        next_dose_date: nextDate,
        days_overdue: daysOverdue,
        urgency: daysOverdue > 0 ? 'immediate' : daysOverdue >= -7 ? 'soon' : 'ok',
      });
    }

    return alerts;
  }

  async getAllEvents(limit = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('health_events')
      .select('*, animals(*)')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Error al obtener historial de salud completo: ${error.message}`);
    return data;
  }
}
