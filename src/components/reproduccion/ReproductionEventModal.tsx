'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/utils/supabase/client';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import type { CreateReproductiveEventInput, ReproductiveEventTypeEnum } from '@/types/domain/reproduction.schema';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

interface ReproductiveAnimalMini {
  id: string;
  code: string;
  name?: string;
  species_id: string;
}

interface ReproductionEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function labelAnimal(a: ReproductiveAnimalMini) {
  const nick = a.name?.trim();
  return nick ? `${a.code} · ${nick}` : a.code;
}

export default function ReproductionEventModal({ isOpen, onClose, onSuccess }: ReproductionEventModalProps) {
  const [repo] = useState(() => new SupabaseReproductionRepository(createClient()));
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [females, setFemales] = useState<ReproductiveAnimalMini[]>([]);
  const [males, setMales] = useState<ReproductiveAnimalMini[]>([]);

  const [femaleId, setFemaleId] = useState('');
  const [eventType, setEventType] = useState<'servicio' | 'diagnostico' | 'parto' | 'secado' | 'aborto'>('servicio');
  const [eventDate, setEventDate] = useState('');
  const [maleId, setMaleId] = useState('');
  const [maleExternal, setMaleExternal] = useState('');
  const [notes, setNotes] = useState('');
  const [useExternalMale, setUseExternalMale] = useState(false);
  const [responsible, setResponsible] = useState('');

  const femaleSpeciesId = useMemo(() => {
    const f = females.find((x) => x.id === femaleId);
    return f?.species_id;
  }, [females, femaleId]);

  const malesFiltered = useMemo(() => {
    if (!femaleSpeciesId) return males;
    return males.filter((m) => m.species_id === femaleSpeciesId);
  }, [males, femaleSpeciesId]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setBoot(true);
        const [f, m] = await Promise.all([repo.listAnimalsBySex('hembra'), repo.listAnimalsBySex('macho')]);
        setFemales(f);
        setMales(m);
        const today = new Date().toISOString().slice(0, 10);
        setEventDate(today);
        setFemaleId(f[0]?.id ?? '');
        setEventType('servicio');
        setMaleId('');
        setMaleExternal('');
        setNotes('');
        setUseExternalMale(false);
        setResponsible('');
      } catch (e) {
        console.error(e);
        alert(`No se pudieron cargar los animales: ${(e as Error).message}`);
      } finally {
        setBoot(false);
      }
    })();
  }, [isOpen, repo]);

  useEffect(() => {
    if (!maleId) return;
    if (!malesFiltered.some((m) => m.id === maleId)) setMaleId('');
  }, [malesFiltered, maleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (!femaleId) throw new Error('Seleccione la hembra.');
      if (!eventDate) throw new Error('Indique la fecha del evento.');
      if (!responsible) throw new Error('Indique el responsable.');

      const payload: CreateReproductiveEventInput = {
        animal_id: femaleId,
        event_type: eventType,
        event_date: eventDate,
        responsible: responsible.trim(),
        notes: notes.trim() || null,
        offspring_count: 0,
        service_type: eventType === 'servicio' ? (useExternalMale ? 'monta_natural' : 'IA') : null,
      };

      if (eventType === 'servicio') {
        if (useExternalMale) {
          payload.father_id = null;
          payload.father_external = maleExternal.trim() || null;
          payload.service_type = 'monta_natural';
        } else {
          payload.father_external = null;
          payload.father_id = maleId.trim() || null;
          payload.service_type = 'IA';
        }
      }

      await repo.registerEvent(payload);
      onSuccess();
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo evento reproductivo" maxWidth="max-w-xl">
      {boot ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-[var(--brand)] w-10 h-10" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
              Responsable *
            </label>
            <input
              required
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nombre del encargado..."
              className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
              Hembra *
            </label>
            <select
              required
              value={femaleId}
              onChange={(e) => setFemaleId(e.target.value)}
              className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
            >
              <option value="">Seleccionar…</option>
              {females.map((a) => (
                <option key={a.id} value={a.id}>
                  {labelAnimal(a)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Tipo de evento *
              </label>
              <select
                value={eventType}
                onChange={(e) =>
                  setEventType(e.target.value as any)
                }
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
              >
                <option value="servicio">Servicio (Monta/IA)</option>
                <option value="diagnostico">Diagnóstico (Eco/Palpación)</option>
                <option value="parto">Parto / Nacimiento</option>
                <option value="secado">Secado</option>
                <option value="aborto">Aborto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                Fecha del evento *
              </label>
              <input
                type="date"
                required
                value={eventDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
              />
            </div>
          </div>

          {eventType === 'servicio' && (
            <div className="rounded-xl border border-black/5 p-4 bg-gray-50/50 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={useExternalMale}
                  onChange={(e) => {
                    setUseExternalMale(e.target.checked);
                    setMaleId('');
                    setMaleExternal('');
                  }}
                  className="rounded border-gray-300"
                />
                Padre externo / pajilla (texto libre)
              </label>

              {useExternalMale ? (
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                    Toro / lote / referencia
                  </label>
                  <input
                    type="text"
                    value={maleExternal}
                    onChange={(e) => setMaleExternal(e.target.value)}
                    placeholder="Ej. Semen AI-04, Toro comprado…"
                    className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                    Macho (inventario, misma especie que la hembra)
                  </label>
                  <select
                    value={maleId}
                    onChange={(e) => setMaleId(e.target.value)}
                    className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
                  >
                    <option value="">Sin macho registrado</option>
                    {malesFiltered.map((a) => (
                      <option key={a.id} value={a.id}>
                        {labelAnimal(a)}
                      </option>
                    ))}
                  </select>
                  {femaleSpeciesId && malesFiltered.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2 font-medium">
                      No hay machos activos de esta especie. Use padre externo o registre un macho.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] transition-colors shadow-sm disabled:opacity-70"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Guardar evento
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
