'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import { PackageSearch, Loader2, Search, X } from 'lucide-react';
import { SupabaseInventoryRepository, SupplyListRow } from '@/repositories/supabase/InventoryRepository';
import { createClient } from '@/utils/supabase/client';

export default function InsumosPage() {
  const [repo] = useState(() => new SupabaseInventoryRepository(createClient()));
  const [allSupplies, setAllSupplies] = useState<SupplyListRow[]>([]);
  const [filteredSupplies, setFilteredSupplies] = useState<SupplyListRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // Cargar datos
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const supplies = await repo.listSupplies();
        console.log('✅ Cargados:', supplies.length, 'insumos');
        setAllSupplies(supplies);
        setFilteredSupplies(supplies);
      } catch (error) {
        console.error('❌ Error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [repo]);

  // Filtrar cuando cambia la búsqueda
  useEffect(() => {
    console.log('🔍 Buscando:', searchText);

    if (!searchText.trim()) {
      setFilteredSupplies(allSupplies);
      console.log('📋 Mostrando todos');
      return;
    }

    const search = searchText.toLowerCase().trim();
    const filtered = allSupplies.filter(s => {
      const match =
        s.name.toLowerCase().includes(search) ||
        s.code.toLowerCase().includes(search) ||
        s.category_name.toLowerCase().includes(search);

      if (match) {
        console.log('  ✓', s.name);
      }

      return match;
    });

    console.log('✅ Resultados:', filtered.length);
    setFilteredSupplies(filtered);
  }, [searchText, allSupplies]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 p-6">
        <PageHeader
          title="Gestión de Insumos"
          description="Controla el inventario de alimentos, medicamentos y suministros."
          icon={PackageSearch}
        />

        {/* 🔍 PANEL DE BÚSQUEDA - DEBE APARECER AQUÍ */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600" size={24} />
              <input
                type="text"
                placeholder="🔍 Buscar insumo: maiz, sal, arepa..."
                value={searchText}
                onChange={(e) => {
                  console.log('✏️ Escribiendo:', e.target.value);
                  setSearchText(e.target.value);
                }}
                className="w-full pl-12 pr-12 py-4 bg-white border-2 border-green-300 rounded-xl text-lg font-medium outline-none focus:border-green-500 focus:ring-4 focus:ring-green-200 transition-all"
              />
              {searchText && (
                <button
                  onClick={() => {
                    console.log('🗑️ Limpiando');
                    setSearchText('');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="text-right">
              <div className="text-3xl font-black text-green-600">
                {filteredSupplies.length}
              </div>
              <div className="text-xs text-gray-600 font-bold uppercase">
                encontrados
              </div>
            </div>
          </div>

          {searchText && (
            <div className="mt-4 px-4 py-3 bg-white border-2 border-green-200 rounded-xl">
              <span className="text-green-800 font-bold">
                🔍 Filtrando por: "{searchText}"
              </span>
              <span className="text-green-600 ml-2 font-bold">
                ({filteredSupplies.length} resultado{filteredSupplies.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>

        {/* TABLA */}
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Insumo',
              render: (s: SupplyListRow) => (
                <div>
                  <div className="font-bold text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.code}</div>
                </div>
              ),
            },
            {
              key: 'category_name',
              header: 'Categoría',
              render: (s: SupplyListRow) => (
                <span className="text-xs uppercase font-bold text-gray-500">
                  {s.category_name}
                </span>
              ),
            },
            {
              key: 'current_stock',
              header: 'Inventario Actual',
              render: (s: SupplyListRow) => (
                <span className={s.current_stock <= s.min_stock ? 'text-red-600 font-bold text-lg' : 'font-bold text-lg'}>
                  {s.current_stock.toLocaleString()} <span className="text-sm text-gray-400">{s.unit}</span>
                </span>
              ),
            },
            {
              key: 'expiry_date',
              header: 'Vencimiento',
              render: (s: SupplyListRow) => s.expiry_date || '—',
            },
          ]}
          data={filteredSupplies}
          keyExtractor={(s: SupplyListRow) => s.id}
        />
      </div>
    </RoleGuard>
  );
}