'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { PackageSearch, Plus, AlertCircle, Loader2, Search, ChevronDown, Activity } from 'lucide-react';
import {
  SupabaseInventoryRepository,
  SupplyListRow,
  SupplyCategoryRow,
  InventorySearchParams,
} from '@/repositories/supabase/InventoryRepository';
import { createClient } from '@/utils/supabase/client';

// ─── Tipos internos de filtros ────────────────────────────────────────────────

interface SupplyFilters {
  search: string;
  category: string;      // category_id | 'all'
  expiryStatus: string;  // 'all' | 'vigente' | 'proximo' | 'vencido'
  stockStatus: string;   // 'all' | 'normal' | 'bajo'
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function InsumosPage() {
  const [repo] = useState(() => new SupabaseInventoryRepository(createClient()));

  // ── Datos ──
  const [supplies, setSupplies] = useState<SupplyListRow[]>([]);
  const [categories, setCategories] = useState<SupplyCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Paginación ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // ── Ordenamiento ──
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ── Filtros ──
  const [filters, setFilters] = useState<SupplyFilters>({
    search: '',
    category: 'all',
    expiryStatus: 'all',
    stockStatus: 'all',
  });
  const [searchInput, setSearchInput] = useState('');

  // ── Debounce de búsqueda ──
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Escuchar búsqueda global del Header ──
  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      const term = (event as CustomEvent).detail.term as string;
      setSearchInput(term);
    };
    window.addEventListener('global-search', handleGlobalSearch);
    return () => window.removeEventListener('global-search', handleGlobalSearch);
  }, []);

  // ── Cargar categorías una sola vez ──
  useEffect(() => {
    repo.listSupplyCategories()
      .then(setCategories)
      .catch(console.error);
  }, [repo]);

  // ── Resetear página al cambiar filtros ──
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.category, filters.expiryStatus, filters.stockStatus]);

  // ── Cargar insumos ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const params: InventorySearchParams = {
        page: currentPage,
        limit: pageSize,
        sort: sortKey,
        order: sortDirection,
        search: filters.search || undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        expiryStatus: filters.expiryStatus !== 'all' ? filters.expiryStatus : undefined,
        stockStatus: filters.stockStatus !== 'all' ? filters.stockStatus : undefined,
      };

      const result = await repo.searchSupplies(params);
      setSupplies(result.data);
      setTotalRecords(result.total);
      setTotalPages(result.totalPages);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar datos');
      setSupplies([]);
    } finally {
      setLoading(false);
    }
  }, [repo, currentPage, pageSize, sortKey, sortDirection, filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Conteo de stock bajo (sobre los datos visibles) ──
  const lowStockCount = supplies.filter(s => s.current_stock <= s.min_stock).length;

  // ── Ordenamiento ──
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // ── Exportar ──
  const handleExport = (_format: 'csv' | 'excel') => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Stock', 'Unidad', 'Stock Mín.', 'Precio Unit.', 'Vencimiento'];
    const rows = supplies.map(s => [
      s.code, s.name, s.category_name,
      s.current_stock, s.unit, s.min_stock,
      s.unit_price ?? '—', s.expiry_date ?? '—',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `insumos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ── Modal de nuevo insumo ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);
  const [unit, setUnit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const resetForm = () => {
    setName(''); setBatchNumber(''); setCurrentStock(0);
    setMinStock(0); setUnit(''); setExpiryDate(''); setFormError(null);
  };

  const handleOpenModal = () => {
    resetForm();
    if (categories.length > 0) setCategoryId(categories[0].id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setSaving(true);
      if (!categoryId) throw new Error('Selecciona una categoría.');
      await repo.createSupply({
        name, category_id: categoryId, unit,
        current_stock: Number(currentStock),
        min_stock: Number(minStock),
        expiry_date: expiryDate.trim() || null,
        batch_number: batchNumber.trim() || null,
      });
      setIsModalOpen(false);
      resetForm();
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Columnas ──
  const columns: Column<SupplyListRow>[] = [
    {
      key: 'name',
      header: 'Insumo',
      sortable: true,
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900">{s.name}</span>
          <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider">{s.code}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      sortable: false,
      render: (s) => (
        <span className="font-bold text-gray-500 uppercase text-[10px] tracking-widest">
          {s.category_name}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Inventario actual',
      sortable: true,
      render: (s) => {
        const isLow = s.current_stock <= s.min_stock;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-black text-lg ${isLow ? 'text-red-500' : 'text-gray-900'}`}>
              {s.current_stock.toLocaleString('es-CO', { minimumFractionDigits: 3 })}
            </span>
            <span className="text-xs font-bold text-gray-400">{s.unit}</span>
            {isLow && <AlertCircle size={14} className="text-red-500 ml-1" />}
          </div>
        );
      },
    },
    {
      key: 'price',
      header: 'Precio unit.',
      sortable: false,
      render: (s) => (
        <span className="font-medium text-gray-600">
          {s.unit_price != null ? `$${s.unit_price.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'expiry',
      header: 'Vencimiento',
      sortable: true,
      render: (s) => {
        if (!s.expiry_date) return <Badge variant="neutral">—</Badge>;
        const diffDays = Math.ceil(
          (new Date(s.expiry_date).getTime() - Date.now()) / 86_400_000
        );
        const variant = diffDays < 0 ? 'danger' : diffDays <= 30 ? 'danger' : diffDays <= 90 ? 'warning' : 'success';
        return <Badge variant={variant} dot>{s.expiry_date}</Badge>;
      },
    },
  ];

  // ── Render ──
  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">

        <PageHeader
          title="Gestión de insumos"
          description="Controla el inventario de alimentos, medicamentos y suministros. Los altas quedan en bodega (M4) y el código se genera automáticamente."
          icon={PackageSearch}
          actions={
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Plus size={18} />
              <span>Nuevo insumo</span>
            </button>
          }
        />

        {loadError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {loadError}
          </div>
        )}

        {/* ── Panel de filtros (mismo patrón que AnimalesPage) ── */}
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-black/5 space-y-4">

          {/* Fila 1: búsqueda + categoría + vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-xl font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Categoría */}
            <select
              value={filters.category}
              onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Vencimiento */}
            <select
              value={filters.expiryStatus}
              onChange={(e) => setFilters(f => ({ ...f, expiryStatus: e.target.value }))}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todos los vencimientos</option>
              <option value="vigente">Vigente</option>
              <option value="proximo">Por vencer (90 días)</option>
              <option value="vencido">Vencido</option>
            </select>

            {/* Placeholder para mantener el grid de 4 columnas */}
            <div />
          </div>

          {/* Fila 2: stock + KPIs */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stock */}
              <select
                value={filters.stockStatus}
                onChange={(e) => setFilters(f => ({ ...f, stockStatus: e.target.value }))}
                className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors text-sm"
              >
                <option value="all">Todos los stocks</option>
                <option value="normal">Stock normal</option>
                <option value="bajo">Stock bajo</option>
              </select>
            </div>

            {/* KPIs */}
            <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Total</span>
                <span className="text-xl font-black text-gray-900 leading-none mt-1">
                  {loading ? '—' : totalRecords}
                </span>
              </div>
              <div className="w-[1px] h-8 bg-gray-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  Stock bajo <AlertCircle size={12} className="text-red-400 ml-1" />
                </span>
                <span className={`text-xl font-black leading-none mt-1 ${lowStockCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {loading ? '—' : lowStockCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <DataTable
          columns={columns}
          data={supplies}
          keyExtractor={(s) => s.id}
          emptyMessage="No se encontraron insumos."
          totalRecords={totalRecords}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onExport={handleExport}
          loading={loading}
        />

        {/* ── Modal nuevo insumo ── */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setFormError(null); }}
          title="Registrar insumo"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Nombre del insumo
              </label>
              <input
                type="text" required minLength={2} value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
                placeholder="Ej. Concentrado engorde"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Categoría
              </label>
              <select
                required value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[var(--brand)] outline-none"
                disabled={categories.length === 0}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-700 mt-1 font-medium">
                  No hay categorías. Ejecuta el SQL de supply_categories.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Lote / referencia (opcional)
              </label>
              <input
                type="text" value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
                placeholder="Ej. 51541"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Stock inicial
              </label>
              <input
                type="number" step="0.001" min={0} required value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Stock mínimo (alerta)
              </label>
              <input
                type="number" step="0.001" min={0} required value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
              />
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                Puede ser mayor que el stock inicial (solo dispara alerta visual).
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Unidad de medida
              </label>
              <input
                type="text" required value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
                placeholder="kg, sacos, dosis, litros…"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Fecha vencimiento
              </label>
              <input
                type="date" value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[var(--brand)] outline-none"
              />
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                Obligatoria si la categoría es medicamento.
              </p>
            </div>

            {formError && (
              <div className="md:col-span-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {formError}
              </div>
            )}

            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setFormError(null); }}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || categories.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors shadow-sm disabled:opacity-70"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Guardar insumo
              </button>
            </div>
          </form>
        </Modal>

      </div>
    </RoleGuard>
  );
}