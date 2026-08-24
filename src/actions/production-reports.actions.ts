'use server';

import { createClient } from '@/utils/supabase/server';

export async function getProductionStats(days: number = 7) {
  const supabase = createClient();
  
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  // Fetch Milk Records
  const { data: milkData } = await (await supabase)
    .from('milk_production')
    .select('date, quantity_liters')
    .gte('date', fromDateStr)
    .order('date', { ascending: true });

  // Fetch Egg Records
  const { data: eggData } = await (await supabase)
    .from('egg_production')
    .select('date, total_quantity, damaged_quantity')
    .gte('date', fromDateStr)
    .order('date', { ascending: true });

  // Group Milk Data by Date
  const milkMap: Record<string, number> = {};
  let totalMilk = 0;
  if (milkData) {
    milkData.forEach(row => {
      milkMap[row.date] = (milkMap[row.date] || 0) + Number(row.quantity_liters);
      totalMilk += Number(row.quantity_liters);
    });
  }

  // Group Egg Data by Date
  const eggMap: Record<string, { total: number, damaged: number }> = {};
  let totalEggs = 0;
  let totalDamagedEggs = 0;
  if (eggData) {
    eggData.forEach(row => {
      if (!eggMap[row.date]) {
        eggMap[row.date] = { total: 0, damaged: 0 };
      }
      eggMap[row.date].total += Number(row.total_quantity);
      eggMap[row.date].damaged += Number(row.damaged_quantity || 0);
      
      totalEggs += Number(row.total_quantity);
      totalDamagedEggs += Number(row.damaged_quantity || 0);
    });
  }

  // Build Chronological Arrays (fill missing days with 0)
  const milkChronological = [];
  const eggChronological = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Formatting label to Day/Month
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    
    milkChronological.push({
      date: dateStr,
      label,
      litros: milkMap[dateStr] || 0
    });
    
    eggChronological.push({
      date: dateStr,
      label,
      buenos: (eggMap[dateStr]?.total || 0) - (eggMap[dateStr]?.damaged || 0),
      rotos: eggMap[dateStr]?.damaged || 0
    });
  }

  return {
    milkChart: milkChronological,
    eggChart: eggChronological,
    kpi: {
      totalMilk,
      avgMilk: totalMilk / days,
      totalEggs,
      totalDamagedEggs
    }
  };
}
