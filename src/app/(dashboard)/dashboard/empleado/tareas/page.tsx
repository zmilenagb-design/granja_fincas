'use client';

import React, { useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import { ClipboardList, CheckCircle2, Clock, AlertCircle, PlayCircle } from 'lucide-react';
import Badge from '@/components/ui/Badge';

export default function EmpleadoTareasPage() {
  // Mock data for tasks since table doesn't exist yet
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Limpieza de Establo A', priority: 'alta', status: 'pendiente', time: '08:00 AM' },
    { id: 2, title: 'Suministro de Sal Mineral', priority: 'media', status: 'en_proceso', time: '10:30 AM' },
    { id: 3, title: 'Revisión de Bebederos', priority: 'baja', status: 'completada', time: '07:00 AM' },
    { id: 4, title: 'Ordeño Matutino', priority: 'alta', status: 'completada', time: '05:00 AM' },
  ]);

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR', 'EMPLEADO', 'ENCARGADO']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader 
          title="Tareas Asignadas"
          description="Listado de actividades diarias pendientes de ejecución."
          icon={ClipboardList}
        />

        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => (
            <div key={task.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between group hover:border-[var(--brand)] transition-all">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  task.status === 'completada' ? 'bg-green-50 text-green-500' : 
                  task.status === 'en_proceso' ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
                }`}>
                  {task.status === 'completada' ? <CheckCircle2 size={24} /> : 
                   task.status === 'en_proceso' ? <PlayCircle size={24} className="animate-pulse" /> : <Clock size={24} />}
                </div>
                <div>
                  <h4 className={`text-lg font-bold ${task.status === 'completada' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={12} /> {task.time}
                    </span>
                    <Badge variant={task.priority === 'alta' ? 'danger' : task.priority === 'media' ? 'warning' : 'neutral'} className="text-[10px] uppercase font-bold px-2">
                       Prioridad {task.priority}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <button className={`px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                task.status === 'completada' ? 'bg-gray-100 text-gray-400 cursor-default' : 
                'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transform hover:scale-105'
              }`}>
                {task.status === 'pendiente' ? 'Iniciar' : task.status === 'en_proceso' ? 'Finalizar' : 'Completada'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 p-8 bg-[#E4EFE4]/30 rounded-[3rem] border border-[var(--brand)]/10 flex flex-col items-center text-center">
          <AlertCircle className="text-[var(--brand)] mb-4" size={32} />
          <h5 className="text-xl font-black text-gray-800">¿Necesitas ayuda con una tarea?</h5>
          <p className="text-sm text-gray-500 mt-2 max-w-md">Si encuentras algún problema técnico o de salud en los animales durante tu labor, repórtalo inmediatamente al encargado.</p>
        </div>
      </div>
    </RoleGuard>
  );
}
