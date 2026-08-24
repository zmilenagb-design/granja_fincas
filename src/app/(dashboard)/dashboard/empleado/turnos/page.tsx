'use client';

import React, { useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import { Clock, LogIn, LogOut, Timer, CalendarCheck } from 'lucide-react';

export default function EmpleadoTurnosPage() {
  const [inTurn, setInTurn] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);

  const handleAction = () => {
    if (!inTurn) {
      setInTurn(true);
      setStartTime(new Date().toLocaleTimeString());
    } else {
      setInTurn(false);
      setStartTime(null);
    }
  };

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader 
          title="Gestión de Turnos"
          description="Registra tu hora de entrada y salida para el control de asistencia y liquidación."
          icon={Clock}
        />

        <div className="flex flex-col items-center justify-center pt-10 px-4">
          <div className="w-full max-w-md bg-white rounded-[3rem] shadow-xl border border-black/5 overflow-hidden transition-all transform hover:shadow-2xl">
            <div className={`p-10 text-center transition-colors ${inTurn ? 'bg-[#E4EFE4]/50' : 'bg-orange-50/50'}`}>
              <div className={`mx-auto h-24 w-24 rounded-3xl flex items-center justify-center shadow-lg transform transition-transform duration-500 ${inTurn ? 'bg-white text-[var(--brand)] rotate-12' : 'bg-white text-orange-500'}`}>
                {inTurn ? <Timer size={48} className="animate-pulse" /> : <Clock size={48} />}
              </div>
              <h3 className="mt-8 text-3xl font-black text-gray-800 tracking-tight">
                {inTurn ? 'Turno Activo' : 'Turno Inactivo'}
              </h3>
              <p className="mt-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
                {inTurn ? `Iniciado a las ${startTime}` : 'Fuera de jornada laboral'}
              </p>
            </div>

            <div className="p-10 flex flex-col gap-6">
               <button 
                 onClick={handleAction}
                 className={`w-full py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 ${
                   inTurn 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white'
                 }`}
               >
                 {inTurn ? (
                   <>
                     <LogOut size={28} />
                     <span>Finalizar Turno</span>
                   </>
                 ) : (
                   <>
                     <LogIn size={28} />
                     <span>Iniciar Turno</span>
                   </>
                 )}
               </button>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-black/5 flex flex-col items-center">
                    <CalendarCheck size={20} className="text-gray-400 mb-1" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Día</span>
                    <span className="text-sm font-black text-gray-800 mt-1">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-black/5 flex flex-col items-center">
                    <Timer size={20} className="text-gray-400 mb-1" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Horas Mes</span>
                    <span className="text-sm font-black text-gray-800 mt-1">160h</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
