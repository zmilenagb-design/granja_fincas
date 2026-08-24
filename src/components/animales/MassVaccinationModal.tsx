'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Syringe, X, Loader2, ChevronDown, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseHealthRepository } from '@/repositories/supabase/HealthRepository';
import { SupabaseInventoryRepository } from '@/repositories/supabase/InventoryRepository';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import type { VaccineScheme } from '@/types/domain/health.schema';
import type { AnimalWithRelations, Species } from '@/types/domain/animal.schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 16);

export default function MassVaccinationModal({ isOpen, onClose, onSuccess }: Props) {
  const [species, setSpecies] = useState<Species[]>([]);
  const [animals, setAnimals] = useState<AnimalWithRelations[]>([]);
  const [schemes, setSchemes] = useState<VaccineScheme[]>([]);
  const [supplies, setSupplies] = useState<{ id: string; name: string; unit: string; current_stock: number }[]>([]);

  const [selectedSpeciesId, setSelectedSpeciesId] = useState('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set());
  const [schemeId, setSchemeId] = useState('');
  const [supplyId, setSupplyId] = useState('');
  const [vaccineName, setVaccineName] = useState('');
  const [quantityPerAnimal, setQuantityPerAnimal] = useState('');
  const [unit, setUnit] = useState('');
  const [nextDoseDate, setNextDoseDate] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [healthRepo] = useState(() => new SupabaseHealthRepository(createClient()));
  const [inventoryRepo] = useState(() => new SupabaseInventoryRepository(createClient()));
  const [animalRepo] = useState(() => new SupabaseAnimalRepository(createClient()));

  const loadStaticData = useCallback(async () => {
    if (!isOpen) return;
    try {
      const [speciesData, suppliesData] = await Promise.all([
        animalRepo.getSpecies(),
        inventoryRepo.listSupplies(),
      ]);
      setSpecies(speciesData);
      setSupplies(
        suppliesData
          .filter((s) => s.current_stock > 0)
          .map((s) => ({ id: s.id, name: s.name, unit: s.unit, current_stock: s.current_stock }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    }
  }, [isOpen, animalRepo, inventoryRepo]);

  useEffect(() => {
    loadStaticData();
  }, [loadStaticData]);

  // Al cambiar especie: cargar animales y esquemas
  const handleSpeciesChange = async (speciesId: string) => {
    setSelectedSpeciesId(speciesId);
    setSelectedAnimalIds(new Set());
    setSchemeId('');
    setVaccineName('');
    setNextDoseDate('');
    if (!speciesId) { setAnimals([]); setSchemes([]); return; }

    setLoadingAnimals(true);
    try {
      const [allAnimals, schemesData] = await Promise.all([
        animalRepo.getAll(),
        healthRepo.getVaccineSchemes(speciesId),
      ]);
      setAnimals(allAnimals.filter((a) => a.species_id === speciesId && a.status === 'activo'));
      setSchemes(schemesData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar animales');
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSchemeChange = (id: string) => {
    setSchemeId(id);
    const scheme = schemes.find((s) => s.id === id);
    if (scheme) {
      setVaccineName(scheme.vaccine_name);
      if (scheme.revaccinate_every_days) {
        const next = new Date();
        next.setDate(next.getDate() + scheme.revaccinate_every_days);
        setNextDoseDate(next.toISOString().split('T')[0]);
      } else {
        setNextDoseDate('');
      }
    }
  };

  const handleSupplyChange = (id: string) => {
    setSupplyId(id);
    const supply = supplies.find((s) => s.id === id);
    if (supply) setUnit(supply.unit);
  };

  const toggleAnimal = (id: string) => {
    setSelectedAnimalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAnimalIds.size === animals.length) {
      setSelectedAnimalIds(new Set());
    } else {
      setSelectedAnimalIds(new Set(animals.map((a) => a.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedAnimalIds.size === 0) return setError('Selecciona al menos un animal.');
    if (!vaccineName.trim()) return setError('Ingresa el nombre de la vacuna.');
    const qty = parseFloat(quantityPerAnimal);
    if (!qty || qty <= 0) return setError('Ingresa una cantidad válida mayor a 0.');
    if (!unit.trim()) return setError('Indica la unidad de medida.');
    if (!responsible.trim()) return setError('Indica el responsable de la aplicación.');

    // Verificar stock total si hay insumo vinculado
    const supply = supplies.find((s) => s.id === supplyId);
    if (supply && supply.current_stock < qty * selectedAnimalIds.size) {
      return setError(
        `Stock insuficiente. Necesitas ${qty * selectedAnimalIds.size} ${supply.unit} pero solo hay ${supply.current_stock} ${supply.unit}.`
      );
    }

    setSaving(true);
    setSaveProgress(0);
    const animalList = Array.from(selectedAnimalIds);
    let done = 0;

    try {
      for (const animalId of animalList) {
        await healthRepo.registerVaccination({
          animal_id: animalId,
          scheme_id: schemeId || undefined,
          supply_id: supplyId || undefined,
          vaccine_name: vaccineName.trim(),
          quantity_used: qty,
          unit: unit.trim(),
          next_dose_date: nextDoseDate || undefined,
          responsible: responsible.trim(),
          notes: notes || undefined,
        });
        done++;
        setSaveProgress(Math.round((done / animalList.length) * 100));
      }
      onSuccess();
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar vacunación masiva');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedSpeciesId('');
    setSelectedAnimalIds(new Set());
    setSchemeId('');
    setSupplyId('');
    setVaccineName('');
    setQuantityPerAnimal('');
    setUnit('');
    setNextDoseDate('');
    setResponsible('');
    setNotes('');
    setError(null);
    setSaveProgress(0);
    onClose();
  };

  const selectedSupply = supplies.find((s) => s.id === supplyId);
  const qty = parseFloat(quantityPerAnimal) || 0;
  const totalQty = qty * selectedAnimalIds.size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Syringe className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Aplicar Vacuna</h2>
              <p className="text-xs font-bold text-gray-400">Aplica una vacuna a múltiples animales</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Especie */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
              Especie *
            </label>
            <div className="relative">
              <select
                value={selectedSpeciesId}
                onChange={(e) => handleSpeciesChange(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] pr-10"
                required
              >
                <option value="">— Seleccionar especie —</option>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Lista de animales */}
          {selectedSpeciesId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                  Seleccionar Animales *
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-bold text-[var(--brand)] hover:underline"
                >
                  {selectedAnimalIds.size === animals.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              {loadingAnimals ? (
                <div className="flex items-center justify-center py-8 bg-gray-50 rounded-xl">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
                </div>
              ) : animals.length === 0 ? (
                <p className="text-sm font-bold text-gray-400 py-4 text-center bg-gray-50 rounded-xl">
                  No hay animales activos para esta especie.
                </p>
              ) : (
                <div className="bg-gray-50 rounded-xl max-h-48 overflow-y-auto divide-y divide-black/5">
                  {animals.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAnimal(a.id)}
                        className="shrink-0 text-[var(--brand)]"
                      >
                        {selectedAnimalIds.has(a.id)
                          ? <CheckSquare size={18} />
                          : <Square size={18} className="text-gray-300" />
                        }
                      </button>
                      <span className="text-sm font-bold text-gray-700">{a.code}</span>
                      {a.notes?.match(/^Apodo:\s*(.+)/m)?.[1] && (
                        <span className="text-sm text-gray-400">
                          — {a.notes.match(/^Apodo:\s*(.+)/m)?.[1]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs font-bold text-gray-500 mt-1">
                {selectedAnimalIds.size} de {animals.length} seleccionados
              </p>
            </div>
          )}

          {/* Esquema */}
          {selectedSpeciesId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Esquema (opcional)
                </label>
                <div className="relative">
                  <select
                    value={schemeId}
                    onChange={(e) => handleSchemeChange(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] pr-10"
                  >
                    <option value="">— Sin esquema —</option>
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>{s.vaccine_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Nombre de la Vacuna *
                </label>
                <input
                  type="text"
                  value={vaccineName}
                  onChange={(e) => setVaccineName(e.target.value)}
                  placeholder="Ej: Fiebre Aftosa..."
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                  required
                />
              </div>
            </div>
          )}

          {/* Insumo + Cantidad */}
          {selectedSpeciesId && (
            <>
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Insumo Utilizado (opcional)
                </label>
                <div className="relative">
                  <select
                    value={supplyId}
                    onChange={(e) => handleSupplyChange(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] pr-10"
                  >
                    <option value="">— Sin insumo vinculado —</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · Stock: {s.current_stock} {s.unit}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                    Cantidad por Animal *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantityPerAnimal}
                    onChange={(e) => setQuantityPerAnimal(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                    required
                  />
                  {selectedAnimalIds.size > 0 && qty > 0 && (
                    <p className="text-xs font-bold mt-1 text-[var(--brand)]">
                      Total: {totalQty.toFixed(2)} {unit || selectedSupply?.unit || ''}
                      {selectedSupply && totalQty > selectedSupply.current_stock && (
                        <span className="text-red-500 ml-1">⚠ Stock insuficiente</span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                    Unidad *
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="ml, dosis, cc..."
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                    Próxima Dosis
                  </label>
                  <input
                    type="date"
                    value={nextDoseDate}
                    onChange={(e) => setNextDoseDate(e.target.value)}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Responsable de la Aplicación *
                </label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Nombre del veterinario o encargado..."
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observaciones..."
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] resize-none"
                />
              </div>
            </>
          )}

          {/* Progreso */}
          {saving && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                <span>Registrando vacunas...</span>
                <span>{saveProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-black/10 font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || selectedAnimalIds.size === 0}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving
                ? <Loader2 size={16} className="animate-spin" />
                : <Syringe size={16} />
              }
              {saving
                ? `Vacunando ${saveProgress}%...`
                : `Vacunar ${selectedAnimalIds.size > 0 ? selectedAnimalIds.size : ''} Animal${selectedAnimalIds.size !== 1 ? 'es' : ''}`
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
