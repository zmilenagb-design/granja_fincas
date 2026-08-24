'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import MilkProductionForm from '@/components/production/MilkProductionForm';
import { getMilkRecords, getCows, MilkRecordFilters } from '@/actions/production.actions';
import { Milk, ArrowLeft, History, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { MilkProductionRecord } from '@/types/domain/production.schema';

const SHIFT_OPTIONS = [
  { value: 'all', label: 'Todos los turnos' },
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
];

export default function MilkProductionPage() {
  const [cows, setCows] = useState<any[]>([]);
  const [records, setRecords] = useState<MilkProductionRecord[]>([]);
  const [isPending, startTransition] = useTransition();

  // ── Filtros ──
  const [search, setSearch] = useState('');
  const [shift, setShift] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cargar vacas una vez
  useEffect(() => {
    getCows().then(r => setCows(r.data ?? []));
  }, []);

  // Cargar historial cuando cambian filtros
  const loadRecords = useCallback(() => {
    const filters: MilkRecordFilters = {
      search: debouncedSearch || undefined,
      shift: shift !== 'all' ? shift : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    startTransition(async () => {
      const { data } = await getMilkRecords(filters);
      setRecords(data ?? []);
    });
  }, [debouncedSearch, shift, dateFrom, dateTo]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const totalLiters = records.reduce((sum, r) => sum + (r.quantity_liters ?? 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/produccion" className="bg-white p-2 rounded-xl text-gray-500 hover:text-[var(--brand)] shadow-sm border border-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
            <Milk className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Producción Lechera</h1>
            <p className="text-gray-500 text-sm font-medium">Bovinos y registro de litros</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Formulario */}
        <div className="lg:col-span-5">
          <MilkProductionForm cows={cows} onSuccess={loadRecords} />
        </div>

        {/* Historial con filtros */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-5">

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" /> Historial Reciente
            </h3>
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold">
              {records.length} registros
            </span>
          </div>

          {/* ── Panel de filtros ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-black/5">
            {/* Fila 1: búsqueda + turno */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Buscar vaca por código o apodo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-black/5 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              <select
                value={shift}
                onChange={e => setShift(e.target.value)}
                className="bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              >
                {SHIFT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Fila 2: fechas + KPI */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Desde</label>
                <input
                  type="date" value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Hasta</label>
                <input
                  type="date" value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="flex-1 bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              {/* KPI total */}
              <div className="flex flex-col items-end ml-auto">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total litros</span>
                <span className="text-xl font-black text-blue-600 leading-none mt-0.5">
                  {isPending ? '—' : totalLiters.toFixed(1)} L
                </span>
              </div>
            </div>

            {/* Limpiar filtros */}
            {(search || shift !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setShift('all'); setDateFrom(''); setDateTo(''); }}
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
                  <th className="px-5 py-4 rounded-tl-xl">Fecha / Turno</th>
                  <th className="px-5 py-4">Vaca</th>
                  <th className="px-5 py-4 text-right rounded-tr-xl">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isPending ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
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
                      <div className="text-xs text-gray-500 font-medium bg-gray-100 inline-block px-2 py-0.5 rounded mt-1 capitalize">
                        {record.shift}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800">
                      {(record.animal as any)?.notes || 'Animal (sin apodo)'}
                      <span className="block text-xs text-gray-400">
                        Código: {(record.animal as any)?.code}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                        {record.quantity_liters} L
                      </span>
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