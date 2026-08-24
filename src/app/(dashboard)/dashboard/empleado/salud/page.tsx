'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Heart, Loader2, Thermometer, FlaskConical, Stethoscope } from 'lucide-react';
import { SupabaseHealthRepository } from '@/repositories/supabase/HealthRepository';
import { createClient } from '@/utils/supabase/client';

export default function EmpleadoSaludPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const repo = new SupabaseHealthRepository(createClient());
        const data = await repo.getAllEvents(50);
        setAlerts(data);
      } catch (error) {
        console.error("Error cargando salud:", error);
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
      render: (item) => {
        const a = item.animals;
        return (
          <div className="flex flex-col">
            <span className="font-extrabold text-gray-900 text-sm">
              {a?.name || a?.species?.display_name || 'Animal'}
            </span>
            <span className="text-[10px] font-bold text-[var(--brand)] font-mono uppercase tracking-wider">{a?.code}</span>
          </div>
        );
      }
    },
    {
      key: 'event_type',
      header: 'Evento / Motivo',
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.event_type === 'enfermedad' ? <Thermometer size={14} className="text-red-500" /> : <FlaskConical size={14} className="text-blue-500" />}
          <span className="text-xs font-bold text-gray-700 capitalize">{item.event_type} - {item.diagnosis || 'Revisión'}</span>
        </div>
      )
    },
    {
      key: 'treatment',
      header: 'Tratamiento actual',
      render: (item) => (
        <span className="text-xs text-gray-600 font-medium italic">{item.treatment_applied || 'Observación'}</span>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={item.recovery_status === 'en_tratamiento' ? 'warning' : 'success'} dot className="text-[10px] uppercase font-bold">
          {item.recovery_status.replace('_', ' ')}
        </Badge>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader 
          title="Salud Animal"
          description="Monitoreo de animales en tratamiento y alertas médicas vigentes."
          icon={Heart}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-red-500 shadow-sm">
              <Thermometer size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-red-400">En Tratamiento</p>
              <h3 className="text-2xl font-black text-red-700 leading-none">{alerts.length}</h3>
            </div>
          </div>
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
              <Stethoscope size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-blue-400">Atenciones Hoy</p>
              <h3 className="text-2xl font-black text-blue-700 leading-none">0</h3>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--brand)] w-10 h-10" />
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
            <DataTable 
              columns={columns}
              data={alerts}
              keyExtractor={(item) => item.id}
              emptyMessage="No hay animales reportados con problemas de salud actualmente."
            />
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
