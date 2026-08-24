'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, X, Loader2, ChevronDown, AlertTriangle, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import type { AnimalWithRelations } from '@/types/domain/animal.schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 16);

export default function GlobalReproductionModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [females, setFemales] = useState<AnimalWithRelations[]>([]);
  const [males, setMales] = useState<AnimalWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected Animal
  const [selectedFemale, setSelectedFemale] = useState<AnimalWithRelations | null>(null);

  // Form state
  const [serviceType, setServiceType] = useState<'IA' | 'monta_natural'>('IA');
  const [fatherId, setFatherId] = useState('');
  const [fatherExternal, setFatherExternal] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');

  const [reproRepo] = useState(() => new SupabaseReproductionRepository(createClient()));
  const [animalRepo] = useState(() => new SupabaseAnimalRepository(createClient()));

  const loadFemales = useCallback(async () => {
    if (!isOpen || step !== 1) return;
    setLoading(true);
    try {
      const all = await animalRepo.getAll();
      setFemales(all.filter(a => a.sex === 'hembra' && a.status === 'activo'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isOpen, step, animalRepo]);

  const loadMales = useCallback(async (speciesId: string) => {
    try {
      const data = await animalRepo.getMalesBySpecies(speciesId);
      setMales(data);
    } catch (e) {
      console.error(e);
    }
  }, [animalRepo]);

  useEffect(() => {
    loadFemales();
  }, [loadFemales]);

  const handleSelectFemale = (f: AnimalWithRelations) => {
    setSelectedFemale(f);
    loadMales(f.species_id);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFemale) return;
    setError(null);

    if (!responsible.trim()) return setError('Indica el responsable.');
    if (!fatherId && !fatherExternal.trim()) return setError('Indica el padre.');

    setSaving(true);
    try {
      await reproRepo.registerEvent({
        animal_id: selectedFemale.id,
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
    } catch (e: any) {
      setError(e.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedFemale(null);
    setServiceType('IA');
    setFatherId('');
    setFatherExternal('');
    setResponsible('');
    setNotes('');
    setError(null);
    onClose();
  };

  const filteredFemales = females.filter(f => 
    f.code.toLowerCase().includes(search.toLowerCase()) || 
    (f.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
              <Heart size={20} className="fill-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">
                {step === 1 ? 'Seleccionar Hembra' : 'Registrar Servicio'}
              </h2>
              {step === 2 && selectedFemale && (
                <p className="text-xs font-bold text-gray-400">Animal: {selectedFemale.code}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por código o nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-gray-700 outline-none focus:border-pink-500"
                />
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-pink-600" /></div>
              ) : filteredFemales.length === 0 ? (
                <div className="py-10 text-center text-gray-400 font-bold">No se encontraron hembras activas.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredFemales.map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFemale(f)}
                      className="flex items-center justify-between p-4 rounded-2xl border border-black/5 hover:bg-pink-50/50 hover:border-pink-200 transition-all text-left"
                    >
                      <div>
                        <span className="text-sm font-black text-gray-900">{f.code}</span>
                        {f.name && <span className="ml-2 text-xs font-bold text-gray-400">({f.name})</span>}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {f.species?.display_name} · {f.reproductive_status.replace('_', ' ')}
                        </p>
                      </div>
                      <ChevronDown className="-rotate-90 text-gray-300" size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex p-1 bg-gray-50 rounded-2xl border border-black/5 gap-1">
                <button
                  type="button"
                  onClick={() => setServiceType('IA')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${serviceType === 'IA' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}
                >
                  IA
                </button>
                <button
                  type="button"
                  onClick={() => setServiceType('monta_natural')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${serviceType === 'monta_natural' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}
                >
                  Monta Natural
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Responsable *</label>
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
                <div className="relative">
                  <select
                    value={fatherId}
                    onChange={(e) => { setFatherId(e.target.value); if (e.target.value) setFatherExternal(''); }}
                    className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500 pr-10"
                  >
                    <option value="">— Macho de la granja —</option>
                    {males.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.breed?.name || 'Mestizo'}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-3.5 text-gray-400" size={16} />
                </div>
                <input
                  type="text"
                  value={fatherExternal}
                  onChange={(e) => { setFatherExternal(e.target.value); if (e.target.value) setFatherId(''); }}
                  placeholder="ID de pajilla o Macho externo..."
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-pink-500 resize-none h-20"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-sm font-bold">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl border border-black/10 font-bold text-sm text-gray-400 hover:bg-gray-50 transition-all">Volver</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-3.5 rounded-xl bg-pink-600 text-white font-bold text-sm hover:bg-pink-700 shadow-lg shadow-pink-100 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Heart size={18} />}
                  {saving ? 'Registrando...' : 'Registrar Servicio'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
