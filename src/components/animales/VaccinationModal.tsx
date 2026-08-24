'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Syringe, X, Loader2, ChevronDown, AlertTriangle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseHealthRepository } from '@/repositories/supabase/HealthRepository';
import { SupabaseInventoryRepository } from '@/repositories/supabase/InventoryRepository';
import type { VaccineScheme } from '@/types/domain/health.schema';
import type { AnimalWithRelations } from '@/types/domain/animal.schema';

interface Props {
  isOpen: boolean;
  animal: AnimalWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 16);

export default function VaccinationModal({ isOpen, animal, onClose, onSuccess }: Props) {
  const [schemes, setSchemes] = useState<VaccineScheme[]>([]);
  const [supplies, setSupplies] = useState<{ id: string; name: string; unit: string; current_stock: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [schemeId, setSchemeId] = useState('');
  const [supplyId, setSupplyId] = useState('');
  const [vaccineName, setVaccineName] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [unit, setUnit] = useState('');
  const [nextDoseDate, setNextDoseDate] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');

  const [healthRepo] = useState(() => new SupabaseHealthRepository(createClient()));
  const [inventoryRepo] = useState(() => new SupabaseInventoryRepository(createClient()));

  const loadData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const [schemesData, suppliesData] = await Promise.all([
        healthRepo.getVaccineSchemes(animal.species_id),
        inventoryRepo.listSupplies(),
      ]);
      setSchemes(schemesData);
      // Solo mostrar insumos con stock > 0 (no filtramos por categoría para flexibilidad)
      setSupplies(
        suppliesData
          .filter((s) => s.current_stock > 0)
          .map((s) => ({ id: s.id, name: s.name, unit: s.unit, current_stock: s.current_stock }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [isOpen, animal.species_id, healthRepo, inventoryRepo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Al cambiar el esquema, rellenar campos automáticamente
  const handleSchemeChange = (id: string) => {
    setSchemeId(id);
    const scheme = schemes.find((s) => s.id === id);
    if (scheme) {
      setVaccineName(scheme.vaccine_name);
      // Calcular próxima dosis si hay frecuencia
      if (scheme.revaccinate_every_days) {
        const next = new Date();
        next.setDate(next.getDate() + scheme.revaccinate_every_days);
        setNextDoseDate(next.toISOString().split('T')[0]);
      } else {
        setNextDoseDate('');
      }
    }
  };

  // Al cambiar el insumo, sincronizar la unidad
  const handleSupplyChange = (id: string) => {
    setSupplyId(id);
    const supply = supplies.find((s) => s.id === id);
    if (supply) setUnit(supply.unit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vaccineName.trim()) return setError('Ingresa el nombre de la vacuna.');
    const qty = parseFloat(quantityUsed);
    if (!qty || qty <= 0) return setError('Ingresa una cantidad válida mayor a 0.');
    if (!unit.trim()) return setError('Indica la unidad de medida.');
    if (!appliedAt) return setError('Indica la fecha de aplicación.');
    if (!responsible.trim()) return setError('Indica el responsable de la aplicación.');

    setSaving(true);
    try {
      await healthRepo.registerVaccination({
        animal_id: animal.id,
        scheme_id: schemeId || undefined,
        supply_id: supplyId || undefined,
        vaccine_name: vaccineName.trim(),
        quantity_used: qty,
        unit: unit.trim(),
        next_dose_date: nextDoseDate || undefined,
        responsible: responsible.trim(),
        notes: notes || undefined,
      });
      onSuccess();
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar la vacuna');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSchemeId('');
    setSupplyId('');
    setVaccineName('');
    setQuantityUsed('');
    setUnit('');
    setNextDoseDate('');
    setResponsible('');
    setNotes('');
    setError(null);
    onClose();
  };

  const selectedSupply = supplies.find((s) => s.id === supplyId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Syringe className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Registrar Vacuna</h2>
              <p className="text-xs font-bold text-gray-400">{animal.code}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Esquema */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                Esquema de Vacunación (opcional)
              </label>
              <div className="relative">
                <select
                  value={schemeId}
                  onChange={(e) => handleSchemeChange(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] pr-10"
                >
                  <option value="">— Seleccionar esquema —</option>
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.vaccine_name} · {s.disease_target}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
              </div>
              {schemes.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  No hay esquemas para esta especie. Puedes registrar la vacuna igualmente.
                </p>
              )}
            </div>

            {/* Nombre de vacuna */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                Nombre de la Vacuna *
              </label>
              <input
                type="text"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="Ej: Fiebre Aftosa, Newcastle..."
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                required
              />
            </div>

            {/* Insumo */}
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

            {/* Cantidad + Unidad */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                  Cantidad Usada *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantityUsed}
                    onChange={(e) => setQuantityUsed(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
                    required
                  />
                </div>
                {selectedSupply && (
                  <p className="text-xs text-gray-400 mt-1">
                    Disponible: {selectedSupply.current_stock} {selectedSupply.unit}
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

            <div className="grid grid-cols-1 gap-4">
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

            {/* Responsable */}
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

            {/* Notas */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
                Notas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)] resize-none"
              />
            </div>

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
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Syringe size={16} />}
                {saving ? 'Guardando...' : 'Registrar Vacuna'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
