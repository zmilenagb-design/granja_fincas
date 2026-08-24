'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { 
  ArrowLeft, Activity, Scale, UserCheck, Heart, Calendar, 
  Loader2, ClipboardList, Utensils, PlusCircle, History, Syringe, Baby 
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import BarChart from '@/components/ui/BarChart';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import { SupabaseHealthRepository } from '@/repositories/supabase/HealthRepository';
import { SupabaseFeedingRepository } from '@/repositories/supabase/FeedingRepository';
import { createClient } from '@/utils/supabase/client';
import { AnimalWithRelations } from '@/types/domain/animal.schema';
import { animalDisplayName } from '@/lib/animal-display';
import type { AnimalEvent, AnimalEventType, AnimalTimelineFilter } from '@/types/domain/health.schema';
import { FeedingRecord } from '@/types/domain/feeding.schema';
import { ReproductiveEventWithRelations } from '@/types/domain/reproduction.schema';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import HealthEventModal from '@/components/animales/HealthEventModal';
import FeedingModal from '@/components/animales/FeedingModal';
import VaccinationModal from '@/components/animales/VaccinationModal';
import ServiceModal from '@/components/animales/ServiceModal';
import AnimalTimeline from '@/components/animales/AnimalTimeline';
import ReproductiveTab from '@/components/animales/ReproductiveTab';

type TabType = 'info' | 'health' | 'feeding' | 'repro';

export default function AnimalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params as { id: string };

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [animal, setAnimal] = useState<AnimalWithRelations | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<AnimalEvent[]>([]);
  const [feedingHistory, setFeedingHistory] = useState<FeedingRecord[]>([]);
  const [reproHistory, setReproHistory] = useState<ReproductiveEventWithRelations[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [timelineCategory, setTimelineCategory] = useState<TimelineCategory>('all');
  const [timelineFrom, setTimelineFrom] = useState('');
  const [timelineTo, setTimelineTo] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');
  
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isFeedingModalOpen, setIsFeedingModalOpen] = useState(false);
  const [isVaccinationModalOpen, setIsVaccinationModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const [repo] = useState(() => new SupabaseAnimalRepository(createClient()));
  const [healthRepo] = useState(() => new SupabaseHealthRepository(createClient()));
  const [feedingRepo] = useState(() => new SupabaseFeedingRepository(createClient()));
  const [reproRepo] = useState(() => new SupabaseReproductionRepository(createClient()));

  const fetchAnimal = async () => {
    try {
      setLoading(true);
      const data = await repo.getById(id);
      setAnimal(data);
    } catch (error) {
      console.error("Error al cargar el animal:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingHistory(true);
      const base = categoryToServerFilter(timelineCategory);
      const filter: AnimalTimelineFilter = {
        ...base,
        fromDate: timelineFrom.trim() || undefined,
        toDate: timelineTo.trim() || undefined,
      };
      const data = await healthRepo.getTimelineByAnimal(id, filter);
      setTimelineEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [id, healthRepo, timelineCategory, timelineFrom, timelineTo]);

  const filteredTimeline = useMemo(() => {
    const q = timelineSearch.trim().toLowerCase();
    if (!q) return timelineEvents;
    return timelineEvents.filter((ev) => {
      const blob = `${ev.title} ${ev.description ?? ''} ${JSON.stringify(ev.metadata ?? {})}`.toLowerCase();
      return blob.includes(q);
    });
  }, [timelineEvents, timelineSearch]);

  const fetchFeedingHistory = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingHistory(true);
      const data = await feedingRepo.getByAnimal(id);
      setFeedingHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [id, feedingRepo]);

  const fetchReproHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await reproRepo.listByAnimal(id);
      setReproHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (id) fetchAnimal();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'health') fetchHealthHistory();
    if (activeTab === 'feeding') fetchFeedingHistory();
    if (activeTab === 'repro') fetchReproHistory();
  }, [activeTab, id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
        <p className="text-gray-500 font-bold">Cargando perfil del animal...</p>
      </div>
    );
  }

  if (!animal) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-2xl font-black text-gray-800">Animal no encontrado</h2>
      <button onClick={() => router.back()} className="text-[var(--brand)] font-bold underline">Volver al listado</button>
    </div>
  );

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-8 animate-fade-in pb-10">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/5 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-50 border border-black/5 text-gray-500 hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-none">{animal.name || animal.species?.display_name || 'Animal'}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="neutral">{animal.code}</Badge>
                <span className="text-sm font-bold text-gray-400">•</span>
                <span className="text-sm font-bold text-gray-500">
                  {animal.species?.display_name} - {animal.breed?.name || 'Mestiza'} ({animal.sex})
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => setIsFeedingModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
            >
              <Utensils size={18} className="text-orange-500" />
              <span>Nueva Carga Alimenticia</span>
            </button>
            <button 
              onClick={() => setIsVaccinationModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
            >
              <Syringe size={18} className="text-green-600" />
              <span>Registrar Vacuna</span>
            </button>
            <button 
               onClick={() => setIsHealthModalOpen(true)}
               className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-xl font-bold hover:bg-[var(--brand-hover)] shadow-sm transition-all"
            >
              <PlusCircle size={18} />
              <span>Evento de Salud</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-black/5 gap-8 overflow-x-auto scrollbar-hide">
          {[
            { id: 'info', label: 'Información General', icon: ClipboardList },
            { id: 'health', label: 'Historial de Salud', icon: Heart },
            { id: 'feeding', label: 'Alimentación', icon: Utensils },
            ...(animal?.sex === 'hembra' ? [{ id: 'repro', label: 'Reproducción', icon: History }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-all font-bold whitespace-nowrap px-2 ${
                activeTab === tab.id 
                  ? 'border-[var(--brand)] text-[var(--brand)]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatItem icon={Scale} label="Peso Actual" value={`${animal.current_weight_kg || 0} kg`} color="brand" />
              <StatItem icon={UserCheck} label="Encargado" value="Sin asignar" color="purple" />
              <StatItem 
                icon={Heart} label="Estado Salud" 
                value={<Badge variant={animal.health_status === 'sano' ? 'success' : 'warning'}>{animal.health_status.replace('_', ' ')}</Badge>} 
                color="red" 
              />
              <StatItem icon={Calendar} label="F. Nacimiento" value={animal.birth_date || 'Desconocida'} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-black/5">
                <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
                   <Activity size={24} className="text-[var(--brand)]" /> Producción Reciente
                </h3>
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                  <Activity size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-bold text-gray-400">Sin datos de producción (M5)</p>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-black/5 flex flex-col gap-6">
                <h3 className="text-xl font-black text-gray-900">Detalles de Registro</h3>
                <InfoRow label="ID de Sistema" value={animal.id} font="mono" />
                <InfoRow label="Vacunación" value={<Badge variant={animal.vaccination_status === 'al_dia' ? 'success' : 'danger'}>{animal.vaccination_status.toUpperCase()}</Badge>} />
                <InfoRow label="Estatus Comercial" value={<Badge variant={animal.status === 'activo' ? 'neutral' : 'danger'}>{animal.status.toUpperCase()}</Badge>} />
                {animal.notes && <InfoRow label="Notas" value={animal.notes} layout="column" />}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5">
              <h3 className="text-xl font-black text-gray-900 mb-1">Historial clínico unificado</h3>
              <p className="text-sm font-medium text-gray-500 mb-6">
                Salud, vacunación, alimentación y otros eventos (RF012). Filtra por tipo y fechas (RF013).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                    Tipo de evento
                  </label>
                  <select
                    value={timelineCategory}
                    onChange={(e) => setTimelineCategory(e.target.value as TimelineCategory)}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                  >
                    <option value="all">Todos</option>
                    <option value="salud">Salud</option>
                    <option value="vacunacion">Vacunación</option>
                    <option value="alimentacion">Alimentación</option>
                    <option value="otros">Otros (ingreso, reproducción…)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={timelineFrom}
                    onChange={(e) => setTimelineFrom(e.target.value)}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={timelineTo}
                    onChange={(e) => setTimelineTo(e.target.value)}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                    Buscar en texto
                  </label>
                  <input
                    type="search"
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    placeholder="Título, descripción, diagnóstico…"
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>
            </div>
            <div className="bg-white p-1 rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
              <AnimalTimeline events={filteredTimeline} loading={loadingHistory} />
            </div>
          </div>
        )}

        {activeTab === 'feeding' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-white p-1 rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
                <div className="p-6 border-b border-black/5 flex items-center justify-between">
                  <h3 className="text-xl font-black text-gray-900">Consumo de Alimento</h3>
                  <div className="flex items-center gap-2 text-sm text-[var(--brand)] font-bold">
                    <History size={16} /> Historial Reciente
                  </div>
                </div>
                {loadingHistory ? (
                   <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-[var(--brand)]" /></div>
                ) : feedingHistory.length === 0 ? (
                  <div className="p-20 text-center text-gray-400 font-bold">Sin registros de alimentación vinculados.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                        <th className="px-6 py-4">Insumo Utilizado</th>
                        <th className="px-6 py-4">Cantidad</th>
                        <th className="px-6 py-4 text-right">Fecha / Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {feedingHistory.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-5 font-bold text-gray-900">{rec.supply?.name ?? 'Insumo'}</td>
                          <td className="px-6 py-5">
                            <span className="font-black text-[var(--brand)]">{rec.quantity}</span>
                            <span className="text-xs font-bold text-gray-400 uppercase ml-1">{rec.unit}</span>
                          </td>
                          <td className="px-6 py-5 text-right font-medium text-gray-500">
                            {new Date(rec.fed_at || '').toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
             </div>
          </div>
        )}

        {activeTab === 'repro' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white p-1 rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">Historial Reproductivo</h3>
                <Badge variant={animal.reproductive_status === 'sin_gestion_activa' ? 'neutral' : 'warning'}>
                  Estado: {animal.reproductive_status.replace('_', ' ')}
                </Badge>
              </div>
              {loadingHistory ? (
                <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-[var(--brand)]" /></div>
              ) : reproHistory.length === 0 ? (
                <div className="p-20 text-center text-gray-400 font-bold">No se han registrado eventos reproductivos para este animal.</div>
              ) : (
                <div className="divide-y divide-black/5">
                  {reproHistory.map(ev => (
                    <div key={ev.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <History size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 text-lg uppercase">
                              {ev.event_type.replace('_', ' ')}
                            </span>
                            <Badge variant={
                              ev.gestation_status === 'parto_exitoso' ? 'success' :
                              ev.gestation_status === 'fallida' ? 'danger' : 'warning'
                            }>
                              {ev.gestation_status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-gray-600 font-medium">
                            {ev.notes || 'Sin notas adicionales.'}
                          </p>
                          {ev.male_animal && (
                            <p className="text-sm text-gray-400 mt-1">
                              Macho: <b>{ev.male_animal.code} {ev.male_animal.name ? `(${ev.male_animal.name})` : ''}</b>
                            </p>
                          )}
                          {ev.male_external && (
                            <p className="text-sm text-gray-400 mt-1">
                              Externo: <b>{ev.male_external}</b>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{ev.event_date.slice(0, 10)}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Fecha del evento</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <HealthEventModal 
          isOpen={isHealthModalOpen} animalId={id} 
          onClose={() => setIsHealthModalOpen(false)} 
          onSuccess={() => { fetchAnimal(); if(activeTab === 'health') fetchHealthHistory(); }} 
        />
        <FeedingModal
          isOpen={isFeedingModalOpen}
          animalId={id}
          onClose={() => setIsFeedingModalOpen(false)}
          onSuccess={() => {
            void fetchAnimal();
            if (activeTab === 'feeding') void fetchFeedingHistory();
            if (activeTab === 'health') void fetchTimeline();
          }}
        />
        {animal && (
          <VaccinationModal
            isOpen={isVaccinationModalOpen}
            animal={animal}
            onClose={() => setIsVaccinationModalOpen(false)}
            onSuccess={() => {
              void fetchAnimal();
              if (activeTab === 'health') void fetchTimeline();
            }}
          />
        )}

        {animal && (
          <ServiceModal
            isOpen={isServiceModalOpen}
            animal={animal}
            onClose={() => setIsServiceModalOpen(false)}
            onSuccess={() => {
              void fetchAnimal();
              if (activeTab === 'health') void fetchTimeline();
            }}
          />
        )}

      </div>
    </RoleGuard>
  );
}

function StatItem({ icon: Icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  const colorMap: Record<string, string> = {
    brand: 'bg-[#E4EFE4]/60 text-[var(--brand)]',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-500',
    orange: 'bg-orange-50 text-orange-500'
  };
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex flex-col gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">{label}</span>
        <span className="text-xl font-black text-gray-900 mt-1">{value}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, font = 'sans', layout = 'row' }: { label: string, value: any, font?: 'sans' | 'mono', layout?: 'row' | 'column' }) {
  return (
    <div className={`flex ${layout === 'row' ? 'items-center justify-between pb-4 border-b border-gray-50' : 'flex-col gap-1'}`}>
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-bold text-gray-700 ${font === 'mono' ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
