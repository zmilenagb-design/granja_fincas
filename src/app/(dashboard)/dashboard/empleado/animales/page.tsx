'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Beef, Filter, Activity, Loader2, ChevronRight } from 'lucide-react';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import { createClient } from '@/utils/supabase/client';
import { AnimalWithRelations } from '@/types/domain/animal.schema';

export default function EmpleadoAnimalesPage() {
  const router = useRouter();
  const [filterSpecies, setFilterSpecies] = useState<string>('Todas');
  const [animals, setAnimals] = useState<AnimalWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const [repo] = useState(() => new SupabaseAnimalRepository(createClient()));

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await repo.getAll();
      setAnimals(data);
    } catch (error) {
      console.error("Error cargando animales para empleado:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const speciesOptions = ['Todas', ...Array.from(new Set(animals.map(a => a.species?.name).filter(Boolean)))];

  const filteredAnimals = useMemo(() => {
    if (filterSpecies === 'Todas') return animals;
    return animals.filter(a => a.species?.name === filterSpecies);
  }, [filterSpecies, animals]);

  const columns: Column<AnimalWithRelations>[] = [
    {
      key: 'name',
      header: 'Animal',
      render: (a) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900 text-sm">{a.name || 'Sin nombre'}</span>
          <span className="text-[10px] font-bold text-[var(--brand)] font-mono uppercase tracking-wider">{a.code}</span>
        </div>
      )
    },
    {
      key: 'species',
      header: 'Especie',
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
            {a.species?.display_name || 'Desconocida'}
          </span>
        </div>
      )
    },
    {
      key: 'health',
      header: 'Salud',
      render: (a) => {
        let variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';
        let label = a.health_status.replace('_', ' ');
        if (a.health_status === 'sano') variant = 'success';
        if (a.health_status === 'enfermo') variant = 'danger';
        if (a.health_status === 'en_tratamiento') variant = 'warning';

        return <Badge variant={variant} dot className="text-[10px] uppercase font-bold">{label}</Badge>;
      }
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <button
          onClick={() => router.push(`/dashboard/animales/${a.id}`)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-[var(--brand)]"
        >
          <ChevronRight size={18} />
        </button>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader
          title="Animales a Cargo"
          description="Visualiza el listado de animales registrados en la finca. Puedes ver sus detalles de salud y estado reproductivo."
          icon={Beef}
        />

        {/* Panel de Filtros */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/60 backdrop-blur-md p-4 rounded-[2rem] shadow-sm border border-black/5">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-gray-400 border border-black/5 shadow-sm">
              <Filter size={20} />
            </div>
            <select
              value={filterSpecies}
              onChange={(e) => setFilterSpecies(e.target.value)}
              className="bg-white border border-black/5 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] transition-colors min-w-[200px] shadow-sm"
            >
              <option value="Todas">Todas las especies</option>
              {speciesOptions.filter(opt => opt !== 'Todas').map(opt => (
                <option key={opt as string} value={opt as string}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6 px-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Total en inventario</span>
              <span className="text-xl font-black text-gray-900 leading-none mt-1">{filteredAnimals.length}</span>
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
              data={filteredAnimals}
              keyExtractor={(a) => a.id}
              onRowClick={(a) => router.push(`/dashboard/animales/${a.id}`)}
              emptyMessage="No se han encontrado animales en el sistema."
            />
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
