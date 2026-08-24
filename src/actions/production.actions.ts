'use server';

import { createClient } from '@/utils/supabase/server';
import { MilkProductionInput, EggProductionInput, MilkProductionRecord, EggProductionRecord } from '@/types/domain/production.schema';
import { revalidatePath } from 'next/cache';

// ─── Tipos de filtros ─────────────────────────────────────────────────────────

export interface MilkRecordFilters {
  search?: string;   // busca en código o apodo del animal
  shift?: string;    // 'all' | 'manana' | 'tarde' | 'noche'
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  limit?: number;
}

export interface EggRecordFilters {
  search?: string;   // busca en lot_name
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// ─── Existentes sin cambios ───────────────────────────────────────────────────

export async function createMilkRecord(data: MilkProductionInput) {
  const supabase = createClient();
  const { data: userData, error: authError } = await (await supabase).auth.getUser();
  if (authError || !userData?.user) return { error: 'No autorizado' };

  const { error } = await (await supabase).from('milk_production').insert([{
    animal_id: data.animal_id,
    production_date: data.date,
    shift: ['MAÑANA', 'MAQUINARIA'].includes(data.shift) ? 'manana' : data.shift.toLowerCase(),
    quantity_liters: data.quantity_liters,
    notes: data.notes || null,
    registered_by: userData.user.id,
  }]);

  if (error) return { error: `Error de BD: ${error?.message || JSON.stringify(error)}` };
  return { success: true };
}

export async function createEggRecord(data: EggProductionInput) {
  const supabase = createClient();
  const { data: userData, error: authError } = await (await supabase).auth.getUser();
  if (authError || !userData?.user) return { error: 'No autorizado' };

  const { error } = await (await supabase).from('egg_production').insert([{
    lot_name: data.batch_id,
    production_date: data.date,
    quantity_units: data.total_quantity,
    discarded_units: data.damaged_quantity || 0,
    notes: data.notes || null,
    registered_by: userData.user.id,
  }]);

  if (error) return { error: `Error de BD: ${error?.message || JSON.stringify(error)}` };
  return { success: true };
}

export async function getCows() {
  const supabase = createClient();
  const { data, error } = await (await supabase)
    .from('animals').select('id, code, notes').limit(100);

  const mappedData = data ? data.map((a: any) => ({
    id: a.id,
    name: a.notes || 'Animal (sin apodo)',
    tag_number: a.code,
  })) : [];

  return { data: mappedData, error: error?.message };
}

export async function getChickenBatches() {
  const supabase = createClient();
  let { data, error } = await (await supabase)
    .from('animal_batches').select('id, name, quantity')
    .eq('species', 'GALLINA').eq('status', 'ACTIVO').order('name', { ascending: true });

  if (!error && (!data || data.length === 0)) {
    await (await supabase).from('animal_batches').insert([
      { name: 'Lote Ponedoras A', species: 'GALLINA', quantity: 200, status: 'ACTIVO' },
      { name: 'Lote Libres B', species: 'GALLINA', quantity: 150, status: 'ACTIVO' },
    ]);
    const secondFetch = await (await supabase)
      .from('animal_batches').select('id, name, quantity')
      .eq('species', 'GALLINA').eq('status', 'ACTIVO').order('name', { ascending: true });
    data = secondFetch.data;
    error = secondFetch.error;
  }

  return { data, error: error?.message };
}

// ─── NUEVO: getMilkRecords con filtros ────────────────────────────────────────

export async function getMilkRecords(
  filters: MilkRecordFilters = {}
): Promise<{ data: MilkProductionRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { shift, dateFrom, dateTo, limit = 50 } = filters;

  let query = (await supabase)
    .from('milk_production')
    .select(`*, animal:animals(code, notes)`)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (shift && shift !== 'all') {
    query = query.eq('shift', shift);
  }
  if (dateFrom) {
    query = query.gte('production_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('production_date', dateTo);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: 'Error al obtener registros' };

  // Filtro de búsqueda por texto (código o apodo) en cliente
  let result = data as unknown as MilkProductionRecord[];
  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(r => {
      const animal = r.animal as any;
      return (
        animal?.code?.toLowerCase().includes(q) ||
        animal?.notes?.toLowerCase().includes(q)
      );
    });
  }

  return { data: result, error: null };
}

// ─── NUEVO: getEggRecords con filtros ─────────────────────────────────────────

export async function getEggRecords(
  filters: EggRecordFilters = {}
): Promise<{ data: EggProductionRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { dateFrom, dateTo, limit = 50 } = filters;

  let query = (await supabase)
    .from('egg_production')
    .select(`id, lot_name, production_date, quantity_units, discarded_units, notes`)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte('production_date', dateFrom);
  if (dateTo) query = query.lte('production_date', dateTo);

  const { data, error } = await query;
  if (error) return { data: null, error: 'Error al obtener registros' };

  let result = data as unknown as EggProductionRecord[];
  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(r => r.lot_name?.toLowerCase().includes(q));
  }

  return { data: result, error: null };
}