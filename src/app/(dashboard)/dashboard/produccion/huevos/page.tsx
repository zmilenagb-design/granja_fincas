'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import EggProductionForm from '@/components/production/EggProductionForm';
import { getEggRecords, getChickenBatches, EggRecordFilters } from '@/actions/production.actions';
import { EggFried, ArrowLeft, History, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { EggProductionRecord } from '@/types/domain/production.schema';

export default function EggProductionPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [records, setRecords] = useState<EggProductionRecord[]>([]);
  const [isPending, startTransition] = useTransition();

  // ── Filtros ──
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cargar lotes una vez
  useEffect(() => {
    getChickenBatches().then(r => setBatches(r.data ?? []));
  }, []);

  // Cargar historial cuando cambian filtros
  const loadRecords = useCallback(() => {
    const filters: EggRecordFilters = {
      search: debouncedSearch || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    startTransition(async () => {
      const { data } = await getEggRecords(filters);
      setRecords(data ?? []);
    });
  }, [debouncedSearch, dateFrom, dateTo]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const totalUnits = records.reduce((s, r) => s + (r.quantity_units ?? 0), 0);
  const totalDiscarded = records.reduce((s, r) => s + (r.discarded_units ?? 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/produccion" className="bg-white p-2 rounded-xl text-gray-500 hover:text-[var(--brand)] shadow-sm border border-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
            <EggFried className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Producción Avícola</h1>
            <p className="text-gray-500 text-sm font-medium">Recolección de huevos por lotes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Formulario */}
        <div className="lg:col-span-5">
          <EggProductionForm batches={batches} onSuccess={loadRecords} />
        </div>

        {/* Historial con filtros */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-5">

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" /> Historial Reciente
            </h3>
            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-xs font-bold">
              {records.length} registros
            </span>
          </div>

          {/* ── Panel de filtros ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-black/5">
            {/* Fila 1: búsqueda por lote */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Buscar por nombre de lote..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-black/5 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Fila 2: fechas + KPIs */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Desde</label>
                <input
                  type="date" value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Hasta</label>
                <input
                  type="date" value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="flex-1 bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
            </div>

            {/* KPIs */}
            <div className="flex items-center gap-6 pt-1 border-t border-gray-200">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total huevos</span>
                <span className="text-xl font-black text-amber-600 leading-none mt-0.5">
                  {isPending ? '—' : totalUnits.toLocaleString()} Ud
                </span>
              </div>
              <div className="w-[1px] h-8 bg-gray-200" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descartados</span>
                <span className={`text-xl font-black leading-none mt-0.5 ${totalDiscarded > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {isPending ? '—' : totalDiscarded.toLocaleString()} Ud
                </span>
              </div>
            </div>

            {/* Limpiar */}
            {(search || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
              >
                × Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-4 rounded-tl-xl">Fecha</th>
                  <th className="px-5 py-4">Lote</th>
                  <th className="px-5 py-4 text-right rounded-tr-xl">Huevos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isPending ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-gray-500 font-medium">
                      No hay registros con estos filtros.
                    </td>
                  </tr>
                ) : records.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">
                        {new Date(record.production_date).toLocaleDateString('es-CO')}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800">
                      {record.lot_name || 'Lote Desconocido'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-extrabold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                          {record.quantity_units} Ud
                        </span>
                        {(record.discarded_units ?? 0) > 0 && (
                          <span className="text-xs text-red-500 font-bold">
                            -{record.discarded_units} rotos
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}