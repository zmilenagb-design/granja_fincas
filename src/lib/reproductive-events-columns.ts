import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReproductiveEvent } from '@/types/domain/reproduction.schema';

const FEMALE_CANDIDATES = ['animal_id', 'female_animal_id', 'female_id', 'mother_id', 'id_hembra', 'hembra_id'] as const;
const MALE_CANDIDATES = ['father_id', 'male_animal_id', 'male_id', 'id_macho', 'macho_id'] as const;

export type ReproAnimalColumnNames = { 
  female: string; 
  male: string | null;
  status: string;
  estimated: string | null;
  registeredBy: string;
  maleExternal: string;
  eventType: string;
};

let cachedColumns: Promise<ReproAnimalColumnNames> | null = null;

async function probeColumn(client: SupabaseClient, column: string): Promise<boolean> {
  const { error } = await client.from('reproductive_events').select(column).limit(0);
  return !error;
}

/**
 * Detecta dinámicamente cómo se llaman las columnas de hembra/macho.
 */
export function getReproEventAnimalColumnNames(client: SupabaseClient): Promise<ReproAnimalColumnNames> {
  if (!cachedColumns) {
    cachedColumns = (async () => {
      // 1. Probar candidatos conocidos uno por uno
      let female: string | null = null;
      for (const c of FEMALE_CANDIDATES) {
        if (await probeColumn(client, c)) {
          female = c;
          break;
        }
      }

      let male: string | null = null;
      for (const c of MALE_CANDIDATES) {
        if (await probeColumn(client, c)) {
          male = c;
          break;
        }
      }

      // 2. Si falló la hembra, intentar inspeccionar una fila real (fallback agresivo)
      if (!female) {
        const { data, error } = await client.from('reproductive_events').select('*').limit(1).maybeSingle();
        if (!error && data) {
          const keys = Object.keys(data);
          female = keys.find(k => FEMALE_CANDIDATES.includes(k as any)) || 
                   keys.find(k => k.toLowerCase().includes('female') || k.toLowerCase().includes('hembra') || k.toLowerCase().includes('mother') || k.toLowerCase().includes('madre')) || 
                   null;
          
          if (female && !male) {
             male = keys.find(k => MALE_CANDIDATES.includes(k as any)) || 
                    keys.find(k => (k.toLowerCase().includes('male') || k.toLowerCase().includes('macho') || k.toLowerCase().includes('father') || k.toLowerCase().includes('padre')) && k !== female) || 
                    null;
          }
        }
      }

      // 3. Probar otros campos (status, estimated, registeredBy)
      let status: string = 'result';
      for (const c of ['result', 'gestation_status', 'status']) {
        if (await probeColumn(client, c)) { status = c; break; }
      }

      let estimated: string | null = null;
      for (const c of ['estimated_delivery_date', 'estimated_birth_date']) {
        if (await probeColumn(client, c)) { estimated = c; break; }
      }

      let registeredBy: string = 'responsible';
      for (const c of ['responsible', 'registered_by', 'user_id']) {
        if (await probeColumn(client, c)) { registeredBy = c; break; }
      }

      let maleExternal: string = 'father_external';
      for (const c of ['father_external', 'male_external']) {
        if (await probeColumn(client, c)) { maleExternal = c; break; }
      }

      let eventType: string = 'event_type';
      for (const c of ['event_type', 'service_type']) {
        if (await probeColumn(client, c)) { eventType = c; break; }
      }

      // 4. Si aún así no hay hembra, lanzar un error detallado para diagnóstico
      if (!female) {
        // Intento final para ver qué campos tiene la tabla si es posible
        const { data: colsData } = await client.from('reproductive_events').select('*').limit(1);
        const availableFields = colsData && colsData.length > 0 ? Object.keys(colsData[0]).join(', ') : 'Ninguno (tabla vacía o ilegible)';
        
        throw new Error(
          `No se encontró columna para ID de Hembra en 'reproductive_events'. Campos disponibles: [${availableFields}]. ` +
          `Buscamos: ${FEMALE_CANDIDATES.join(', ')}`
        );
      }

      return { female, male, status, estimated, registeredBy, maleExternal, eventType };
    })();
  }
  return cachedColumns;
}

/** Convierte una fila cruda de PostgREST al modelo interno. */
export function rowToReproductiveEvent(
  row: Record<string, unknown>,
  cols?: ReproAnimalColumnNames
): ReproductiveEvent {
  // Priorizar las columnas encontradas por el buscador dinámico, de lo contrario buscar candidatos genéricos
  const female = cols ? row[cols.female] : (row.animal_id ?? row.female_animal_id ?? row.female_id ?? row.mother_id);
  const male = cols && cols.male ? row[cols.male] : (row.father_id ?? row.male_animal_id ?? row.male_id ?? null);
  
  // Mapeo dinámico de otros campos
  const resultValue = (cols ? row[cols.status] : (row.result || row.gestation_status || 'pendiente')) as any;
  const estDeliveryDate = (cols?.estimated ? row[cols.estimated] : (row.estimated_delivery_date || row.estimated_birth_date)) as string | null | undefined;
  const resp = cols ? row[cols.registeredBy] : (row.responsible || row.registered_by || row.user_id);
  const maleExt = cols ? row[cols.maleExternal] : (row.father_external || row.male_external);
  const evType = cols ? row[cols.eventType] : (row.event_type || row.service_type);

  if (!female) {
    console.error('Error de integridad en reproductive_events:', row);
    throw new Error(`Registro reproductivo inválido: falta id de hembra (ID registro: ${row.id ?? '?'}).`);
  }

  return {
    id: String(row.id),
    animal_id: String(female),
    father_id: male ? String(male) : null,
    event_type: evType as any,
    event_date: String(row.event_date),
    father_external: (maleExt as string | null | undefined) ?? null,
    result: resultValue,
    estimated_delivery_date: estDeliveryDate ? String(estDeliveryDate) : null,
    notes: (row.notes as string | null | undefined) ?? null,
    responsible: String(resp || 'Desconocido'),
    registered_by: row.registered_by ? String(row.registered_by) : null,
    created_at: row.created_at as string | undefined,
    offspring_count: typeof row.offspring_count === 'number' ? row.offspring_count : 0,
  };
}
