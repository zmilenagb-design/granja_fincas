'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import ReproductionEventModal from '@/components/reproduccion/ReproductionEventModal';
import ReproductionStatusModal from '@/components/reproduccion/ReproductionStatusModal';
import { Sprout, CheckCircle2, XCircle, Clock, Plus, Pencil, Loader2, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import type {
  GestationStatus,
  ReproductiveEventWithRelations,
} from '@/types/domain/reproduction.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso.slice(0, 10); }
}

function resultingBreed(ev: ReproductiveEventWithRelations) {
  const fb = ev.female_animal?.breed?.name;
  const mb = ev.male_animal?.breed?.name;
  if (fb && mb) return `${fb} × ${mb}`;
  return fb || mb || '—';
}

function crossTitle(ev: ReproductiveEventWithRelations) {
  const f = ev.female_animal?.name?.trim() || ev.female_animal?.code || 'Hembra';
  const m = ev.male_animal
    ? ev.male_animal.name?.trim() || ev.male_animal.code
    : ev.male_external?.trim() || '—';
  return `${f} × ${m}`;
}

function getTypeStr(type: string) {
  if (type === 'monta_natural') return 'Monta natural';
  if (type === 'inseminacion_artificial') return 'Inseminación artificial';
  return type;
}

function effectivenessCell(status: GestationStatus) {
  if (status === 'parto_exitoso')
    return <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm"><CheckCircle2 size={16} /> Sí</div>;
  if (status === 'fallida')
    return <div className="flex items-center gap-1.5 text-red-500 font-bold text-sm"><XCircle size={16} /> No</div>;
  return <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm"><Clock size={16} /> En curso</div>;
}

function getStatusBadge(status: GestationStatus) {
  switch (status) {
    case 'parto_exitoso': return <Badge variant="success" dot>Parto exitoso</Badge>;
    case 'confirmada': return <Badge variant="info" dot>Confirmada</Badge>;
    case 'en_seguimiento': return <Badge variant="warning" dot>En seguimiento</Badge>;
    case 'fallida': return <Badge variant="danger" dot>Fallida</Badge>;
    default: return <Badge variant="neutral">{status}</Badge>;
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ReproduccionPage() {
  const [repo] = useState(() => new SupabaseReproductionRepository(createClient()));
  const [rows, setRows] = useState<ReproductiveEventWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusEvent, setStatusEvent] = useState<ReproductiveEventWithRelations | null>(null);

  // ── Filtros ──
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todas');
  const [filterType, setFilterType] = useState('all');

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Escuchar búsqueda global del Header
  useEffect(() => {
    const handler = (e: Event) => setSearchInput((e as CustomEvent).detail.term);
    window.addEventListener('global-search', handler);
    return () => window.removeEventListener('global-search', handler);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await repo.list());
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  // ── Filtrado cliente ──
  const filtered = useMemo(() => {
    let result = rows;

    if (filterStatus !== 'todas') {
      result = result.filter(r => r.gestation_status === filterStatus);
    }

    if (filterType !== 'all') {
      result = result.filter(r => r.event_type === filterType);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(r => {
        const title = crossTitle(r).toLowerCase();
        const femCode = r.female_animal?.code?.toLowerCase() ?? '';
        const malCode = r.male_animal?.code?.toLowerCase() ?? '';
        const ext = r.male_external?.toLowerCase() ?? '';
        return title.includes(q) || femCode.includes(q) || malCode.includes(q) || ext.includes(q);
      });
    }

    return result;
  }, [rows, filterStatus, filterType, debouncedSearch]);

  // ── KPIs (sobre todos los datos, no sobre el filtrado) ──
  const completedCount = rows.filter(r => r.gestation_status === 'parto_exitoso').length;
  const inProgressCount = rows.filter(r => ['en_seguimiento', 'confirmada'].includes(r.gestation_status)).length;
  const failureCount = rows.filter(r => r.gestation_status === 'fallida').length;

  const hasActiveFilters = searchInput || filterStatus !== 'todas' || filterType !== 'all';

  const columns: Column<ReproductiveEventWithRelations>[] = [
    {
      key: 'cross',
      header: 'Identificación del cruce',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-gray-900">{crossTitle(r)}</span>
          <span className="text-xs font-bold text-gray-400">
            Hembra: {r.female_animal?.code ?? '—'}
            {r.male_animal ? ` · Macho: ${r.male_animal.code}` : r.male_external ? ` · Externo: ${r.male_external}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'breed',
      header: 'Raza / cruce',
      render: (r) => <span className="font-bold text-gray-600">{resultingBreed(r)}</span>,
    },
    {
      key: 'type',
      header: 'Tipo de evento',
      render: (r) => <span className="text-sm font-medium text-gray-500">{getTypeStr(r.event_type)}</span>,
    },
    {
      key: 'date',
      header: 'Fecha evento',
      render: (r) => <span className="font-medium text-gray-700">{formatDate(r.event_date)}</span>,
    },
    {
      key: 'est',
      header: 'Parto estimado',
      render: (r) => <span className="font-medium text-gray-600">{formatDate(r.estimated_birth_date)}</span>,
    },
    {
      key: 'status',
      header: 'Estado de gestación',
      render: (r) => getStatusBadge(r.gestation_status),
    },
    {
      key: 'effectiveness',
      header: 'Resultado',
      render: (r) => effectivenessCell(r.gestation_status),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setStatusEvent(r); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-[var(--brand)] hover:bg-gray-50 transition-colors"
        >
          <Pencil size={14} /> Estado
        </button>
      ),
    },
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">

        <PageHeader
          title="Gestión de reproducción"
          description="Registra cruces e inseminaciones, actualiza el estado de gestación y consulta el historial desde tu base de datos."
          icon={Sprout}
          actions={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Plus size={18} />
              <span>Nuevo evento</span>
            </button>
          }
        />

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest mb-1">Partos exitosos</p>
              <h3 className="text-3xl font-black text-gray-900">{completedCount}</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest mb-1">Gestaciones activas</p>
              <h3 className="text-3xl font-black text-gray-900">{inProgressCount}</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <Clock size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest mb-1">Cruces fallidos</p>
              <h3 className="text-3xl font-black text-gray-900">{failureCount}</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-inner">
              <XCircle size={24} />
            </div>
          </div>
        </div>

        {/* ── Panel de filtros ── */}
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-black/5 space-y-4">

          {/* Fila 1: búsqueda + estado + tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por hembra, macho o código..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-xl font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Estado de gestación */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="todas">Todos los estados</option>
              <option value="en_seguimiento">En seguimiento</option>
              <option value="confirmada">Confirmada</option>
              <option value="fallida">Fallida</option>
              <option value="parto_exitoso">Parto exitoso</option>
            </select>

            {/* Tipo de evento */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todos los tipos</option>
              <option value="monta_natural">Monta natural</option>
              <option value="inseminacion_artificial">Inseminación artificial</option>
            </select>

            <div />
          </div>

          {/* Fila 2: KPI inline + limpiar */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-3">
            <div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchInput(''); setFilterStatus('todas'); setFilterType('all'); }}
                  className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                >
                  × Limpiar filtros
                </button>
              )}
            </div>
            <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Total eventos</span>
                <span className="text-xl font-black text-gray-900 leading-none mt-1">
                  {loading ? '—' : filtered.length}
                </span>
              </div>
              <div className="w-[1px] h-8 bg-gray-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Gestaciones activas</span>
                <span className={`text-xl font-black leading-none mt-1 ${inProgressCount > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                  {loading ? '—' : inProgressCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--brand)] w-10 h-10" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            keyExtractor={(r) => r.id}
            emptyMessage="No hay eventos reproductivos con estos filtros."
          />
        )}

        <ReproductionEventModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={load}
        />

        <ReproductionStatusModal
          isOpen={!!statusEvent}
          event={statusEvent}
          onClose={() => setStatusEvent(null)}
          onSuccess={load}
        />
      </div>
    </RoleGuard>
  );
}