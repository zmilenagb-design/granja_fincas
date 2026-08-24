import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseProductionRepository {
  constructor(private supabase: SupabaseClient) {}

  async getRecentMilkProduction(limit = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('milk_production')
      .select('*, animals(name, code, species:species_id(display_name))')
      .order('production_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Error al obtener producción de leche: ${error.message}`);
    return data;
  }

  async getRecentEggProduction(limit = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('egg_production')
      .select('*, animals(name, code, species:species_id(display_name))')
      .order('production_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Error al obtener producción de huevos: ${error.message}`);
    return data;
  }
}
