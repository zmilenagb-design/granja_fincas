'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { BarChart3, Loader2, Droplets, Egg } from 'lucide-react';
import { SupabaseProductionRepository } from '@/repositories/supabase/ProductionRepository';
import { createClient } from '@/utils/supabase/client';
import type { MilkProductionRecord, EggProductionRecord } from '@/types/domain/production.schema';

export default function EmpleadoProduccionPage() {
  const [milkRecords, setMilkRecords] = useState<MilkProductionRecord[]>([]);
  const [eggRecords, setEggRecords] = useState<EggProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const repo = new SupabaseProductionRepository(createClient());
        const [milk, eggs] = await Promise.all([
          repo.getRecentMilkProduction(50),
          repo.getRecentEggProduction(50)
        ]);
        setMilkRecords(milk);
        setEggRecords(eggs);
      } catch (error) {
        console.error("Error cargando producción:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const milkColumns: Column<MilkProductionRecord>[] = [
    {
      key: 'animal_id',
      header: 'Vaca',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900 text-sm">
            {item.animal?.code || 'Vaca'}
          </span>
          <span className="text-[10px] font-bold text-blue-500 font-mono">ID: {item.animal_id.slice(0, 8)}</span>
        </div>
      )
    },
    {
      key: 'quantity_liters',
      header: 'Litros',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Droplets size={14} className="text-blue-500" />
          <span className="text-sm font-black text-gray-900">{item.quantity_liters} L</span>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (item) => (
        <span className="text-xs font-bold text-gray-400 font-mono">{new Date(item.date).toLocaleDateString()}</span>
      )
    }
  ];

  const eggColumns: Column<EggProductionRecord>[] = [
    {
      key: 'batch_id',
      header: 'Lote',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900 text-sm">
            {item.batch_id || 'Lote'}
          </span>
          <span className="text-[10px] font-bold text-orange-500 font-mono">ID: {item.id.slice(0, 8)}</span>
        </div>
      )
    },
    {
      key: 'total_quantity',
      header: 'Cantidad',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Egg size={14} className="text-orange-500" />
          <span className="text-sm font-black text-gray-900">{item.total_quantity} uds</span>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (item) => (
        <span className="text-xs font-bold text-gray-400 font-mono">{new Date(item.date).toLocaleDateString()}</span>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-8 animate-fade-in pb-10">
        <PageHeader 
          title="Registro de Producción"
          description="Control de pesaje de leche y recolección de huevos diaria."
          icon={BarChart3}
        />

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--brand)] w-10 h-10" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Droplets size={18} />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Producción de Leche</h3>
                </div>
              </div>
              
              <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
                <DataTable 
                  columns={milkColumns}
                  data={milkRecords}
                  keyExtractor={(item) => item.id}
                  emptyMessage="Sin registros de leche hoy."
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                    <Egg size={18} />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Recolección de Huevos</h3>
                </div>
              </div>
              
              <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
                <DataTable 
                  columns={eggColumns}
                  data={eggRecords}
                  keyExtractor={(item) => item.id}
                  emptyMessage="Sin registros de huevos hoy."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
