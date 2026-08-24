'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity, Loader2, Database, User, Search, ChevronDown,
  ChevronRight, Download, ChevronLeft, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { RoleGuard } from '@/components/RoleGuard';
import { createClient } from '@/utils/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  modified_by: string;
  created_at: string;
  profiles?: { full_name: string | null; role: string | null } | null;
}

const PAGE_SIZE = 20;

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  UPDATE: 'text-blue-600   bg-blue-50   border-blue-200',
  DELETE: 'text-red-600    bg-red-50    border-red-200',
};
const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó',
};

const ALL_MODULES = [
  'animals', 'supplies', 'milk_production', 'egg_production',
  'reproductive_events', 'vaccination_records', 'health_events',
  'vaccine_schemes', 'animal_batches',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function diffData(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): { key: string; old: unknown; new: unknown }[] {
  if (!oldData && !newData) return [];
  const keys = new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ]);
  const skip = new Set(['id', 'created_at', 'updated_at', 'registered_by', 'modified_by']);
  return [...keys]
    .filter(k => !skip.has(k))
    .filter(k => JSON.stringify((oldData ?? {})[k]) !== JSON.stringify((newData ?? {})[k]))
    .map(k => ({ key: k, old: (oldData ?? {})[k], new: (newData ?? {})[k] }));
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ─── Componente de diff de fila ───────────────────────────────────────────────

function RowDetail({ log }: { log: AuditLog }) {
  const diff = diffData(log.old_data, log.new_data);

  if (log.action === 'INSERT') {
    const entries = Object.entries(log.new_data ?? {})
      .filter(([k]) => !['id', 'created_at', 'updated_at', 'registered_by', 'modified_by'].includes(k));
    return (
      <div className="px-8 py-4 bg-emerald-50/40 border-t border-emerald-100">
        <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest mb-3">Registro creado</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {entries.map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl px-3 py-2 border border-emerald-100">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{k}</p>
              <p className="text-sm font-bold text-gray-700 truncate">{renderVal(v)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (log.action === 'DELETE') {
    const entries = Object.entries(log.old_data ?? {})
      .filter(([k]) => !['id', 'created_at', 'updated_at', 'registered_by', 'modified_by'].includes(k));
    return (
      <div className="px-8 py-4 bg-red-50/40 border-t border-red-100">
        <p className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest mb-3">Registro eliminado</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {entries.map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl px-3 py-2 border border-red-100">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{k}</p>
              <p className="text-sm font-bold text-red-400 line-through truncate">{renderVal(v)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (diff.length === 0) {
    return (
      <div className="px-8 py-4 bg-blue-50/30 border-t border-blue-100 text-sm font-bold text-gray-400">
        Sin cambios detectables en los campos relevantes.
      </div>
    );
  }

  return (
    <div className="px-8 py-4 bg-blue-50/30 border-t border-blue-100">
      <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-3">Campos modificados</p>
      <div className="space-y-2">
        {diff.map(({ key, old: o, new: n }) => (
          <div key={key} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-blue-100">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest w-36 shrink-0">{key}</span>
            <span className="text-sm font-bold text-red-400 line-through max-w-[200px] truncate">{renderVal(o)}</span>
            <span className="text-gray-300">→</span>
            <span className="text-sm font-bold text-emerald-600 max-w-[200px] truncate">{renderVal(n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros
  const [search, setSearch] = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setCurrentPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cargar todos los logs (hasta 500 — suficiente para filtrar cliente)
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const client = createClient();
    const { data, error } = await client
      .from('audit_logs')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) setAllLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Filtrado cliente ──
  const filtered = allLogs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterModule !== 'all' && log.table_name !== filterModule) return false;
    if (dateFrom && log.created_at < dateFrom) return false;
    if (dateTo && log.created_at > dateTo + 'T23:59:59') return false;
    if (debSearch.trim()) {
      const q = debSearch.toLowerCase();
      const name = log.profiles?.full_name?.toLowerCase() ?? '';
      const id = log.record_id?.toLowerCase() ?? '';
      if (!name.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  // ── Paginación ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [filterAction, filterModule, dateFrom, dateTo, debSearch]);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ── Exportar CSV ──
  const exportCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Rol', 'Acción', 'Módulo', 'ID Registro'];
    const rows = filtered.map(l => [
      formatDate(l.created_at),
      l.profiles?.full_name ?? 'Desconocido',
      l.profiles?.role ?? 'Sistema',
      ACTION_LABELS[l.action] ?? l.action,
      l.table_name,
      l.record_id,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const hasFilters = filterAction !== 'all' || filterModule !== 'all' || dateFrom || dateTo || search;

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR']}>
      <div className="flex flex-col gap-6 animate-fade-in pb-12">
        <PageHeader
          title="Auditoría y Trazabilidad"
          description="Monitoreo global del sistema. Historial de acciones y alteraciones a la base de datos."
          icon={Activity}
          actions={
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/5 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition-all disabled:opacity-50"
            >
              <Download size={15} /> Exportar CSV
            </button>
          }
        />

        {/* ── Panel de filtros ── */}
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-black/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por usuario o ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-black/5 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Acción */}
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todas las acciones</option>
              <option value="INSERT">Creó</option>
              <option value="UPDATE">Modificó</option>
              <option value="DELETE">Eliminó</option>
            </select>

            {/* Módulo */}
            <select
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todos los módulos</option>
              {ALL_MODULES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <div />
          </div>

          {/* Fechas + KPI + limpiar */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors" />
            </div>

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFilterAction('all'); setFilterModule('all'); setDateFrom(''); setDateTo(''); }}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
              >
                × Limpiar filtros
              </button>
            )}

            <div className="ml-auto flex items-center gap-6 px-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Registros</span>
                <span className="text-xl font-black text-gray-900 leading-none mt-0.5">{filtered.length}</span>
              </div>
              <div className="w-[1px] h-8 bg-gray-100" />
              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <Database className="w-4 h-4" /> En vivo (PostgreSQL Triggers)
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="font-medium text-sm">Recuperando registros de Base de Datos...</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex items-center justify-center p-20 text-gray-400 font-medium">
                No hay registros con estos filtros.
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-400 font-extrabold text-[10px] uppercase tracking-widest border-b border-gray-100">
                    <th className="p-5 pl-6 w-8" />
                    <th className="p-5">Fecha y Hora</th>
                    <th className="p-5">Usuario / Rol</th>
                    <th className="p-5">Acción</th>
                    <th className="p-5">Módulo Afectado</th>
                    <th className="p-5 pr-6 text-right">ID de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(log => (
                    <React.Fragment key={log.id}>
                      <tr
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-50"
                        onClick={() => toggle(log.id)}
                      >
                        <td className="pl-6 py-4">
                          {expanded.has(log.id)
                            ? <ChevronDown size={15} className="text-gray-400" />
                            : <ChevronRight size={15} className="text-gray-300" />
                          }
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-bold text-gray-700">{formatDate(log.created_at)}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{log.profiles?.full_name ?? 'Desconocido'}</p>
                              <p className="text-xs text-gray-500 font-medium">{log.profiles?.role ?? 'Sistema'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border inline-block ${ACTION_STYLES[log.action] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
                            {log.table_name}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right text-xs font-mono text-gray-400 max-w-[180px] truncate">
                          {log.record_id}
                        </td>
                      </tr>
                      {expanded.has(log.id) && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <RowDetail log={log} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Paginación ── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400">
                Página {currentPage} de {totalPages} · {filtered.length} registros
              </p>
              <div className="flex items-center gap-1">
                <PagBtn onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft size={14} /></PagBtn>
                <PagBtn onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}><ChevronLeft size={14} /></PagBtn>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const page = start + i;
                  return (
                    <PagBtn key={page} onClick={() => setCurrentPage(page)} active={currentPage === page}>
                      {page}
                    </PagBtn>
                  );
                })}
                <PagBtn onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}><ChevronRight size={14} /></PagBtn>
                <PagBtn onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={14} /></PagBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function PagBtn({ onClick, disabled, active, children }: {
  onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-colors
        ${active ? 'bg-[var(--brand)] text-white' : ''}
        ${!active ? 'hover:bg-gray-100 text-gray-600' : ''}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}