'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import {
  Bell, AlertTriangle, AlertCircle, Syringe,
  Heart, PackageX, Loader2, RefreshCw, Sprout,
  CheckCircle2, Clock, Filter, X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseHealthRepository } from '@/repositories/supabase/HealthRepository';
import { SupabaseInventoryRepository } from '@/repositories/supabase/InventoryRepository';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import type { VaccineAlert } from '@/types/domain/health.schema';
import type { ReproductiveEventWithRelations } from '@/types/domain/reproduction.schema';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface HealthAlertRow {
  id: string;
  animal_id: string;
  description: string;
  detected_at: string;
  animals?: { code: string };
}

interface StockAlert {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
  unit: string;
  expiry_date: string | null;
  category_name: string;
}

interface BirthAlert {
  id: string;
  female_code: string;
  female_name?: string | null;
  estimated_birth_date: string;
  daysUntil: number;
  gestation_status: string;
}

type AlertType = 'all' | 'vacunacion' | 'salud' | 'inventario' | 'reproduccion';
type SortOrder = 'urgency' | 'date';

const AUTO_REFRESH_SECONDS = 300; // 5 minutos

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const daysLabel = (days: number) => {
  if (days > 0) return `${days} día${days !== 1 ? 's' : ''} de atraso`;
  if (days === 0) return 'Vence hoy';
  return `Faltan ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
};

const birthDaysLabel = (days: number) => {
  if (days < 0) return `Atrasado ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Parto estimado hoy';
  return `En ${days} día${days !== 1 ? 's' : ''}`;
};

function extractNickname(notes: string | null | undefined) {
  if (!notes) return null;
  const m = notes.match(/Apodo:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AlertasPage() {
  const router = useRouter();

  const [vaccineAlerts, setVaccineAlerts] = useState<VaccineAlert[]>([]);
  const [healthAlerts, setHealthAlerts] = useState<HealthAlertRow[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [birthAlerts, setBirthAlerts] = useState<BirthAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filtros y orden
  const [activeType, setActiveType] = useState<AlertType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('urgency');

  // Dismissed (marcar como revisado — persiste en memoria de sesión)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Auto-refresh countdown
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const [healthRepo] = useState(() => new SupabaseHealthRepository(createClient()));
  const [inventoryRepo] = useState(() => new SupabaseInventoryRepository(createClient()));
  const [reproRepo] = useState(() => new SupabaseReproductionRepository(createClient()));

  // ── Cargar alertas ──
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vaccAlerts, hAlerts, supplies, reproEvents] = await Promise.all([
        healthRepo.getVaccinationAlerts(),
        healthRepo.getHealthAlerts(),
        inventoryRepo.listSupplies(),
        reproRepo.list(),
      ]);

      setVaccineAlerts(vaccAlerts);
      setHealthAlerts(hAlerts as HealthAlertRow[]);

      // Stock bajo o próximo a vencer (30 días)
      const today = new Date();
      const in30 = new Date(today.getTime() + 30 * 86_400_000);
      setStockAlerts(
        supplies.filter(s => {
          const low = s.current_stock < s.min_stock;
          const expiring = s.expiry_date ? new Date(s.expiry_date) <= in30 : false;
          return low || expiring;
        })
      );

      // Partos próximos (≤ 30 días) o atrasados, solo gestaciones activas
      const births: BirthAlert[] = [];
      for (const ev of reproEvents as ReproductiveEventWithRelations[]) {
        const estDate = ev.estimated_birth_date ?? ev.estimated_delivery_date;
        if (!estDate) continue;
        if (!['en_seguimiento', 'confirmada'].includes(ev.gestation_status ?? '')) continue;
        const daysUntil = Math.round(
          (new Date(estDate).getTime() - today.getTime()) / 86_400_000
        );
        if (daysUntil > 30) continue; // Solo los próximos/atrasados
        const nickname = extractNickname(ev.female_animal?.name ?? ev.animal?.notes);
        births.push({
          id: ev.id,
          female_code: ev.female_animal?.code ?? ev.animal?.code ?? '—',
          female_name: nickname,
          estimated_birth_date: estDate,
          daysUntil,
          gestation_status: ev.gestation_status ?? '',
        });
      }
      setBirthAlerts(births.sort((a, b) => a.daysUntil - b.daysUntil));

      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_SECONDS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar alertas');
    } finally {
      setLoading(false);
    }
  }, [healthRepo, inventoryRepo, reproRepo]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // ── Auto-refresh countdown ──
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          loadAlerts();
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [loadAlerts]);

  const dismiss = (key: string) =>
    setDismissed(prev => new Set([...prev, key]));

  // ── KPIs ──
  const criticalVacc = vaccineAlerts.filter(a => a.urgency === 'immediate').length;
  const totalAlerts = vaccineAlerts.length + healthAlerts.length + stockAlerts.length + birthAlerts.length;

  // ── Filtrado por tipo ──
  const showVacc = activeType === 'all' || activeType === 'vacunacion';
  const showHealth = activeType === 'all' || activeType === 'salud';
  const showStock = activeType === 'all' || activeType === 'inventario';
  const showBirth = activeType === 'all' || activeType === 'reproduccion';

  // ── Ordenar vacunas por urgencia o fecha ──
  const sortedVacc = [...vaccineAlerts].sort((a, b) => {
    if (sortOrder === 'urgency') {
      const urg = { immediate: 0, soon: 1, ok: 2 };
      return (urg[a.urgency] ?? 9) - (urg[b.urgency] ?? 9);
    }
    return b.days_overdue - a.days_overdue;
  });

  const countdownMins = Math.floor(countdown / 60);
  const countdownSecs = countdown % 60;

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">

        <PageHeader
          title="Centro de Alertas"
          description="Monitorea en tiempo real las vacunas atrasadas, animales en tratamiento y problemas de inventario."
          icon={Bell}
          actions={
            <div className="flex items-center gap-3">
              {/* Countdown */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-white border border-black/5 px-3 py-2 rounded-xl shadow-sm">
                <Clock size={13} />
                <span>
                  Actualiza en {countdownMins}:{String(countdownSecs).padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={loadAlerts}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/5 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition-all disabled:opacity-60"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          }
        />

        {lastUpdated && (
          <p className="text-xs text-gray-400 font-medium -mt-2">
            Última actualización: {lastUpdated.toLocaleTimeString('es-CO')}
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard icon={Syringe} label="Vacunaciones" count={vaccineAlerts.length} sub={criticalVacc > 0 ? `${criticalVacc} críticas` : 'Todo al día'} color="green" active={activeType === 'vacunacion'} onClick={() => setActiveType(p => p === 'vacunacion' ? 'all' : 'vacunacion')} />
              <SummaryCard icon={Heart} label="En Tratamiento" count={healthAlerts.length} sub="Animales enfermos activos" color="red" active={activeType === 'salud'} onClick={() => setActiveType(p => p === 'salud' ? 'all' : 'salud')} />
              <SummaryCard icon={PackageX} label="Inventario" count={stockAlerts.length} sub="Bajo stock o próximo a vencer" color="orange" active={activeType === 'inventario'} onClick={() => setActiveType(p => p === 'inventario' ? 'all' : 'inventario')} />
              <SummaryCard icon={Sprout} label="Partos próximos" count={birthAlerts.length} sub="Gestaciones activas ≤ 30 días" color="purple" active={activeType === 'reproduccion'} onClick={() => setActiveType(p => p === 'reproduccion' ? 'all' : 'reproduccion')} />
            </div>

            {/* ── Barra de controles ── */}
            <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-black/5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-gray-400" />
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Filtrar</span>
                {(['all', 'vacunacion', 'salud', 'inventario', 'reproduccion'] as AlertType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveType(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${activeType === t
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {{ all: 'Todas', vacunacion: 'Vacunación', salud: 'Salud', inventario: 'Inventario', reproduccion: 'Reproducción' }[t]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Ordenar</span>
                <button
                  onClick={() => setSortOrder(s => s === 'urgency' ? 'date' : 'urgency')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {sortOrder === 'urgency' ? '↓ Por urgencia' : '↓ Por fecha'}
                </button>
              </div>
            </div>

            {totalAlerts === 0 && (
              <div className="py-20 text-center bg-white rounded-[2rem] border border-black/5 shadow-sm">
                <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
                <p className="font-bold text-gray-400">¡Sin alertas activas! Todo bajo control.</p>
              </div>
            )}

            {/* ── Vacunación ── */}
            {showVacc && sortedVacc.length > 0 && (
              <AlertSection
                title="Vacunación"
                icon={<Syringe className="h-5 w-5 text-green-600" />}
                count={sortedVacc.filter(a => !dismissed.has(`vacc-${a.animal_id}-${a.vaccine_name}`)).length}
                badgeVariant="danger"
              >
                {sortedVacc
                  .filter(a => !dismissed.has(`vacc-${a.animal_id}-${a.vaccine_name}`))
                  .map((a, i) => (
                    <AlertRow
                      key={`${a.animal_id}-${a.vaccine_name}-${i}`}
                      urgency={a.urgency === 'immediate' ? 'critical' : 'warning'}
                      title={a.animal_name ? `${a.animal_name} (${a.animal_code})` : a.animal_code}
                      highlight={a.vaccine_name}
                      sub={`${a.species_name} · Próxima: ${formatDate(a.next_dose_date)} · ${daysLabel(a.days_overdue)}`}
                      badge={<Badge variant={a.urgency === 'immediate' ? 'danger' : 'warning'}>{a.urgency === 'immediate' ? 'URGENTE' : 'PRÓXIMA'}</Badge>}
                      onClick={() => router.push(`/dashboard/animales/${a.animal_id}`)}
                      onDismiss={() => dismiss(`vacc-${a.animal_id}-${a.vaccine_name}`)}
                    />
                  ))}
              </AlertSection>
            )}

            {/* ── Salud ── */}
            {showHealth && healthAlerts.filter(h => !dismissed.has(`health-${h.id}`)).length > 0 && (
              <AlertSection
                title="Animales en Tratamiento"
                icon={<Heart className="h-5 w-5 text-red-500" />}
                count={healthAlerts.filter(h => !dismissed.has(`health-${h.id}`)).length}
                badgeVariant="danger"
              >
                {healthAlerts
                  .filter(h => !dismissed.has(`health-${h.id}`))
                  .map(h => (
                    <AlertRow
                      key={h.id}
                      urgency="critical"
                      title={h.animals?.code ?? 'Animal desconocido'}
                      sub={`${h.description} · Detectado: ${formatDate(h.detected_at)}`}
                      badge={<Badge variant="danger">EN TRATAMIENTO</Badge>}
                      onClick={() => h.animal_id && router.push(`/dashboard/animales/${h.animal_id}`)}
                      onDismiss={() => dismiss(`health-${h.id}`)}
                    />
                  ))}
              </AlertSection>
            )}

            {/* ── Inventario ── */}
            {showStock && stockAlerts.filter(s => !dismissed.has(`stock-${s.id}`)).length > 0 && (
              <AlertSection
                title="Inventario"
                icon={<PackageX className="h-5 w-5 text-orange-500" />}
                count={stockAlerts.filter(s => !dismissed.has(`stock-${s.id}`)).length}
                badgeVariant="warning"
              >
                {stockAlerts
                  .filter(s => !dismissed.has(`stock-${s.id}`))
                  .sort((a, b) => sortOrder === 'urgency'
                    ? (a.current_stock / Math.max(a.min_stock, 1)) - (b.current_stock / Math.max(b.min_stock, 1))
                    : 0
                  )
                  .map(s => {
                    const stockLow = s.current_stock < s.min_stock;
                    const daysToExpiry = s.expiry_date
                      ? Math.round((new Date(s.expiry_date).getTime() - Date.now()) / 86_400_000)
                      : null;
                    const isCritical = stockLow && s.current_stock < s.min_stock * 0.5;
                    return (
                      <AlertRow
                        key={s.id}
                        urgency={isCritical ? 'critical' : 'warning'}
                        title={s.name}
                        sub={`${s.category_name}${stockLow ? ` · Stock: ${s.current_stock}/${s.min_stock} ${s.unit}` : ''}${daysToExpiry !== null && daysToExpiry <= 30 ? ` · Vence en ${daysToExpiry} días` : ''}`}
                        badge={
                          <div className="flex gap-2">
                            {stockLow && <Badge variant={isCritical ? 'danger' : 'warning'}>STOCK BAJO</Badge>}
                            {daysToExpiry !== null && daysToExpiry <= 30 && (
                              <Badge variant={daysToExpiry <= 7 ? 'danger' : 'warning'}>VENCE PRONTO</Badge>
                            )}
                          </div>
                        }
                        onClick={() => router.push('/dashboard/insumos')}
                        onDismiss={() => dismiss(`stock-${s.id}`)}
                      />
                    );
                  })}
              </AlertSection>
            )}

            {/* ── Partos próximos ── */}
            {showBirth && birthAlerts.filter(b => !dismissed.has(`birth-${b.id}`)).length > 0 && (
              <AlertSection
                title="Partos Próximos"
                icon={<Sprout className="h-5 w-5 text-purple-500" />}
                count={birthAlerts.filter(b => !dismissed.has(`birth-${b.id}`)).length}
                badgeVariant="warning"
              >
                {birthAlerts
                  .filter(b => !dismissed.has(`birth-${b.id}`))
                  .map(b => {
                    const overdue = b.daysUntil < 0;
                    return (
                      <AlertRow
                        key={b.id}
                        urgency={overdue ? 'critical' : b.daysUntil <= 7 ? 'warning' : 'info'}
                        title={b.female_name ? `${b.female_name} (${b.female_code})` : b.female_code}
                        sub={`Parto estimado: ${formatDate(b.estimated_birth_date)} · ${birthDaysLabel(b.daysUntil)}`}
                        badge={
                          <Badge variant={overdue ? 'danger' : b.daysUntil <= 7 ? 'warning' : 'info'}>
                            {overdue ? 'ATRASADO' : b.daysUntil <= 7 ? 'MUY PRONTO' : 'PRÓXIMO'}
                          </Badge>
                        }
                        onClick={() => router.push('/dashboard/reproduccion')}
                        onDismiss={() => dismiss(`birth-${b.id}`)}
                      />
                    );
                  })}
              </AlertSection>
            )}

          </div>
        )}
      </div>
    </RoleGuard>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function AlertRow({
  urgency, title, highlight, sub, badge, onClick, onDismiss,
}: {
  urgency: 'critical' | 'warning' | 'info';
  title: string;
  highlight?: string;
  sub: string;
  badge: React.ReactNode;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const iconMap = {
    critical: <AlertTriangle size={18} className="text-red-500" />,
    warning: <AlertCircle size={18} className="text-amber-500" />,
    info: <AlertCircle size={18} className="text-blue-400" />,
  };
  const bgMap = {
    critical: 'bg-red-50',
    warning: 'bg-amber-50',
    info: 'bg-blue-50',
  };

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
      <div
        className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
      >
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${bgMap[urgency]}`}>
          {iconMap[urgency]}
        </div>
        <div className="min-w-0">
          <p className="font-black text-gray-900 truncate">
            {title}
            {highlight && (
              <> <span className="font-medium text-gray-400">·</span>{' '}
                <span className="text-[var(--brand)]">{highlight}</span>
              </>
            )}
          </p>
          <p className="text-xs font-bold text-gray-400 truncate">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <button
          title="Marcar como revisado"
          onClick={onDismiss}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, count, sub, color, active, onClick,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  sub: string;
  color: 'green' | 'red' | 'orange' | 'purple';
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    green: 'bg-green-50  text-green-600',
    red: 'bg-red-50    text-red-500',
    orange: 'bg-orange-50 text-orange-500',
    purple: 'bg-purple-50 text-purple-500',
  };
  const rings = {
    green: 'ring-green-300',
    red: 'ring-red-300',
    orange: 'ring-orange-300',
    purple: 'ring-purple-300',
  };
  return (
    <button
      onClick={onClick}
      className={`bg-white p-5 rounded-[2rem] shadow-sm border border-black/5 flex items-center gap-4 text-left w-full transition-all hover:shadow-md ${active ? `ring-2 ${rings[color]}` : ''}`}
    >
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-none mt-0.5">{count}</p>
        <p className="text-xs font-bold text-gray-400 mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function AlertSection({
  title, icon, count, badgeVariant, children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  badgeVariant: 'danger' | 'warning';
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="font-extrabold text-gray-900">{title}</h3>
        </div>
        <Badge variant={badgeVariant} dot>{count} alerta{count !== 1 ? 's' : ''}</Badge>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}