'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, X, Loader2, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import type { AnimalWithRelations } from '@/types/domain/animal.schema';

interface Props {
  isOpen: boolean;
  animal: AnimalWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 16);

export default function ServiceModal({ isOpen, animal, onClose, onSuccess }: Props) {
  const [males, setMales] = useState<AnimalWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [serviceType, setServiceType] = useState<'IA' | 'monta_natural'>('IA');
  const [fatherId, setFatherId] = useState('');
  const [fatherExternal, setFatherExternal] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');

  const [reproRepo] = useState(() => new SupabaseReproductionRepository(createClient()));
  const [animalRepo] = useState(() => new SupabaseAnimalRepository(createClient()));

  const loadMales = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const data = await animalRepo.getMalesBySpecies(animal.species_id);
      setMales(data);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isOpen, animal.species_id, animalRepo]);

  useEffect(() => {
    loadMales();
  }, [loadMales]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones basicas
    if (!responsible.trim()) return setError('Indica el responsable del servicio.');
    if (!fatherId && !fatherExternal.trim()) {
      return setError('Debes seleccionar un macho interno o indicar uno externo/pajilla.');
    }

    setSaving(true);
    try {
      await reproRepo.registerEvent({
        animal_id: animal.id,
        event_type: 'servicio',
        service_type: serviceType,
        father_id: fatherId || null,
        father_external: fatherExternal.trim() || null,
        responsible: responsible.trim(),
        notes: notes.trim() || null,
        result: 'pendiente',
        offspring_count: 0
      });
      onSuccess();
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar servicio');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setServiceType('IA');
    setFatherId('');
    setFatherExternal('');
    setResponsible('');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <Heart className="h-5 w-5 text-pink-600 fill-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Registrar Servicio</h2>
              <p className="text-xs font-bold text-gray-400">Inicio de ciclo reproductivo para {animal.code}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tipo de Servicio */}
          <div className="flex p-1 bg-gray-50 rounded-2xl border border-black/5 gap-1">
             <button
               type="button"
               onClick={() => setServiceType('IA')}
               className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${serviceType === 'IA' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}
             >
               Inseminación Artificial
             </button>
             <button
               type="button"
               onClick={() => setServiceType('monta_natural')}
               className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${serviceType === 'monta_natural' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}
             >
               Monta Natural
             </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsable */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                Responsable *
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Veterinario..."
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500"
                required
              />
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-black/5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identificación del Padre</h4>
            
            {/* Macho Interno */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Macho de la Granja</label>
              <div className="relative">
                <select
                  value={fatherId}
                  onChange={(e) => {
                    setFatherId(e.target.value);
                    if (e.target.value) setFatherExternal('');
                  }}
                  className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500 pr-10"
                >
                  <option value="">— Seleccionar macho interno —</option>
                  {males.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} {m.breed?.name ? `· ${m.breed.name}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-300">
               <div className="h-px bg-current flex-1"></div>
               <span className="text-[10px] font-black uppercase">O BIEN</span>
               <div className="h-px bg-current flex-1"></div>
            </div>

            {/* Macho Externo */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Macho Externo / Código de Pajilla</label>
              <input
                type="text"
                value={fatherExternal}
                onChange={(e) => {
                  setFatherExternal(e.target.value);
                  if (e.target.value) setFatherId('');
                }}
                placeholder="Nombre del toro o ID de pajilla..."
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
              Notas adicionales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones sobre el celo o el proceso..."
              className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500 resize-none h-20"
            />
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl flex items-start gap-3">
             <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
             <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
                Al registrar el servicio, el sistema actualizará el ciclo del animal. 
                Recuerda programar el diagnóstico reproductivo para confirmar la preñez.
             </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3.5 rounded-xl border border-black/10 font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl bg-pink-600 text-white font-bold text-sm hover:bg-pink-700 transition-colors shadow-lg shadow-pink-100 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
              {saving ? 'Registrando...' : 'Registrar Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
