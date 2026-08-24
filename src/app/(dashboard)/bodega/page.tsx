'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { PackageSearch, Plus, AlertCircle, Loader2, Search } from 'lucide-react';
import { SupabaseInventoryRepository, SupplyListRow, SupplyCategoryRow } from '@/repositories/supabase/InventoryRepository';
import { createClient } from '@/utils/supabase/client';

export default function InsumosPage() {
  const [repo] = useState(() => new SupabaseInventoryRepository(createClient()));

  // Datos
  const [allSupplies, setAllSupplies] = useState<SupplyListRow[]>([]);
  const [filteredSupplies, setFilteredSupplies] = useState<SupplyListRow[]>([]);
  const [categories, setCategories] = useState<SupplyCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all'); // all | normal | bajo
  const [filterExpiry, setFilterExpiry] = useState<string>('all'); // all | vigente | proximo | vencido

  // Cargar datos
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [supplies, cats] = await Promise.all([
          repo.listSupplies(),
          repo.listSupplyCategories()
        ]);
        setAllSupplies(supplies);
        setCategories(cats);
        setFilteredSupplies(supplies);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [repo]);

  // Filtrar datos
  useEffect(() => {
    let result = [...allSupplies];

    // Búsqueda por texto
    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();
      result = result.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.code.toLowerCase().includes(search) ||
        s.category_name.toLowerCase().includes(search)
      );
    }

    // Filtro por categoría
    if (filterCategory !== 'all') {
      const cat = categories.find(c => c.id === filterCategory);
      if (cat) {
        result = result.filter(s => s.category_name === cat.name);
      }
    }

    // Filtro por stock
    if (filterStock !== 'all') {
      if (filterStock === 'bajo') {
        result = result.filter(s => s.current_stock <= s.min_stock);
      } else if (filterStock === 'normal') {
        result = result.filter(s => s.current_stock > s.min_stock);
      }
    }

    // Filtro por vencimiento
    if (filterExpiry !== 'all') {
      const today = new Date();
      result = result.filter(s => {
        if (!s.expiry_date) return false;
        const expiry = new Date(s.expiry_date);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (filterExpiry === 'vencido') return daysLeft < 0;
        if (filterExpiry === 'proximo') return daysLeft >= 0 && daysLeft <= 90;
        if (filterExpiry === 'vigente') return daysLeft > 90;
        return true;
      });
    }

    setFilteredSupplies(result);
  }, [searchText, filterCategory, filterStock, filterExpiry, allSupplies, categories]);

  const handleExport = () => {
    const csv = [
      ['Código', 'Nombre', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Unidad', 'Vencimiento'].join(','),
      ...filteredSupplies.map(s =>
        [s.code, s.name, s.category_name, s.current_stock, s.min_stock, s.unit, s.expiry_date || ''].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `insumos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const columns: Column<SupplyListRow>[] = [
    {
      key: 'name',
      header: 'Insumo',
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900">{s.name}</span>
          <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider">{s.code}</span>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'Categoría',
      render: (s) => (
        <span className="font-bold text-gray-500 uppercase text-[10px] tracking-widest">
          {s.category_name}
        </span>
      ),
    },
    {
      key: 'current_stock',
      header: 'Inventario Actual',
      render: (s) => {
        const isLow = s.current_stock <= s.min_stock;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-black text-lg ${isLow ? 'text-red-500' : 'text-gray-900'}`}>
              {s.current_stock.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-gray-400">{s.unit}</span>
            {isLow && <AlertCircle size={14} className="text-red-500 ml-1" />}
          </div>
        );
      },
    },
    {
      key: 'expiry_date',
      header: 'Vencimiento',
      render: (s) => {
        if (!s.expiry_date) return <Badge variant="neutral">—</Badge>;

        const expiry = new Date(s.expiry_date);
        const today = new Date();
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let variant: 'success' | 'warning' | 'danger' = 'success';
        if (daysLeft < 0) variant = 'danger';
        else if (daysLeft <= 90) variant = 'warning';

        return <Badge variant={variant} dot>{s.expiry_date}</Badge>;
      },
    },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div>;
  }

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader
          title="Gestión de Insumos"
          description="Controla el inventario de alimentos, medicamentos y suministros. Las altas quedan en bodega (M4) y el código se genera automáticamente."
          icon={PackageSearch}
          actions={
            <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm">
              <Plus size={18} />
              <span>Nuevo Insumo</span>
            </button>
          }
        />

        {/* PANEL DE FILTROS - Similar a Animales */}
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-black/5 space-y-4">
          {/* Fila 1: Búsqueda y Filtros Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre, código o categoría..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-xl font-medium text-gray-700 outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Filtro Categoría */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-green-500 transition-colors"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Filtro Stock */}
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-green-500 transition-colors"
            >
              <option value="all">Todo el stock</option>
              <option value="normal">Stock normal</option>
              <option value="bajo">Stock bajo</option>
            </select>

            {/* Filtro Vencimiento */}
            <select
              value={filterExpiry}
              onChange={(e) => setFilterExpiry(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-green-500 transition-colors"
            >
              <option value="all">Todo el vencimiento</option>
              <option value="vigente">Vigente (&gt;90 días)</option>
              <option value="proximo">Próximo (≤90 días)</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>

          {/* Fila 2: KPIs */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Total: <strong className="text-gray-900">{filteredSupplies.length}</strong> insumos
              </span>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Stock Bajo</span>
                <span className="text-xl font-black text-red-600 leading-none mt-1">
                  {filteredSupplies.filter(s => s.current_stock <= s.min_stock).length}
                </span>
              </div>
              <div className="w-[1px] h-8 bg-gray-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Próximos a Vencer</span>
                <span className="text-xl font-black text-orange-600 leading-none mt-1">
                  {filteredSupplies.filter(s => {
                    if (!s.expiry_date) return false;
                    const days = Math.ceil((new Date(s.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return days >= 0 && days <= 90;
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <DataTable
          columns={columns}
          data={filteredSupplies}
          keyExtractor={(s) => s.id}
          onExport={handleExport}
        />
      </div>
    </RoleGuard>
  );
}