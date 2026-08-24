'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { UtensilsCrossed, Loader2, Calendar, Scale } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function EmpleadoAlimentacionPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        // Cargamos los últimos 50 registros registrados por el administrador
        const { data, error } = await supabase
          .from('feeding_records')
          .select('*, animals(name, code), supplies(name, unit)')
          .order('fed_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setRecords(data || []);
      } catch (error) {
        console.error("Error cargando alimentación:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const columns: Column<any>[] = [
    {
      key: 'animal',
      header: 'Animal',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900 text-sm">{item.animals?.name || 'Animal'}</span>
          <span className="text-[10px] font-bold text-[var(--brand)] font-mono">{item.animals?.code}</span>
        </div>
      )
    },
    {
      key: 'supply',
      header: 'Insumo / Dieta',
      render: (item) => (
        <span className="text-xs font-bold text-gray-700">{item.supplies?.name || 'Ración estándar'}</span>
      )
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Scale size={14} className="text-gray-400" />
          <span className="text-xs font-black text-gray-900">{item.quantity} {item.unit || item.supplies?.unit || 'kg'}</span>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Fecha y Hora',
      render: (item) => (
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar size={14} />
          <span className="text-[11px] font-bold font-mono tracking-tight">{new Date(item.fed_at).toLocaleString()}</span>
        </div>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader
          title="Registro de Alimentación"
          description="Historial reciente de dietas y raciones suministradas en la finca."
          icon={UtensilsCrossed}
        />

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--brand)] w-10 h-10" />
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
            <DataTable
              columns={columns}
              data={records}
              keyExtractor={(item) => item.id}
              emptyMessage="No se han registrado entregas de alimento recientemente."
            />
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
