'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/utils/supabase/client';
import { SupabaseReproductionRepository } from '@/repositories/supabase/ReproductionRepository';
import type {
  ReproductiveEventWithRelations,
  ReproductiveResultEnum,
} from '@/types/domain/reproduction.schema';
import { Loader2 } from 'lucide-react';

interface ReproductionStatusModalProps {
  isOpen: boolean;
  event: ReproductiveEventWithRelations | null;
  onClose: () => void;
  onSuccess: () => void;
}

function crossTitle(ev: ReproductiveEventWithRelations) {
  const f = ev.animal?.code || 'Hembra';
  const m = ev.father ? ev.father.code : ev.father_external || '—';
  return `${f} × ${m}`;
}

export default function ReproductionStatusModal({
  isOpen,
  event,
  onClose,
  onSuccess,
}: ReproductionStatusModalProps) {
  const [repo] = useState(() => new SupabaseReproductionRepository(createClient()));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>('pendiente');
  const [estimatedBirthDate, setEstimatedBirthDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!event) return;
    setResult(event.result || 'pendiente');
    setEstimatedBirthDate(event.estimated_delivery_date?.slice(0, 10) ?? '');
    setNotes(event.notes ?? '');
  }, [event]);

  if (!event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const payload: any = {
        result: result,
        estimated_delivery_date: estimatedBirthDate.trim() || null,
        notes: notes.trim() || null,
      };

      await repo.updateEvent(event.id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Actualizar Resultado" maxWidth="max-w-lg">
      <div className="mb-5 rounded-xl bg-gray-50 border border-black/5 px-4 py-3">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Evento</p>
        <p className="font-black text-gray-900">{crossTitle(event)}</p>
        <p className="text-xs text-gray-500 mt-1">
          Fecha: {event.event_date} · Tipo: {event.event_type}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
            Resultado *
          </label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:border-[var(--brand)]"
          >
            <option value="pendiente">Pendiente</option>
            <option value="positivo">Positivo (Confirmado)</option>
            <option value="negativo">Negativo (Fallido)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
            Parto estimado (opcional)
          </label>
          <input
            type="date"
            value={estimatedBirthDate}
            onChange={(e) => setEstimatedBirthDate(e.target.value)}
            className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-[var(--brand)]"
          />
        </div>

        <div>
           <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-1">
             Notas / Observaciones
           </label>
           <textarea
             value={notes}
             onChange={(e) => setNotes(e.target.value)}
             rows={3}
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
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  );
}
