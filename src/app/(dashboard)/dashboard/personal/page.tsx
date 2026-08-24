'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { UserCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseProfileRepository } from '@/repositories/supabase/ProfileRepository';
import { Profile } from '@/types/domain/profile.schema';

export default function PersonalPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [repo] = useState(() => new SupabaseProfileRepository());

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await repo.getAll(createClient());
      setProfiles(data);
    } catch (error) {
      console.error("Error cargando perfiles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Usuario del Sistema',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E4EFE4]/60 flex items-center justify-center font-black text-[var(--brand)]">
            {(p.full_name || 'U').charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-gray-900">{p.full_name || 'Sin nombre'}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.email}</span>
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Contacto',
      render: (p) => <span className="font-semibold text-gray-500">{p.phone || 'Sin teléfono'}</span>
    },
    {
      key: 'role',
      header: 'Rol',
      render: (p) => (
        <Badge variant={p.role === 'ADMINISTRADOR' ? 'success' : p.role === 'ENCARGADO' ? 'info' : 'neutral'} dot>{p.role}</Badge>
      )
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (p) => (
        <Badge variant={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <button className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
           Gestionar
        </button>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader 
          title="Personal y Usuarios"
          description="Administra los accesos y roles de los usuarios del sistema. Desactiva cuentas cuando sea necesario."
          icon={UserCheck}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest mb-1">Encargados Activos</p>
              <h3 className="text-3xl font-black text-gray-900">
                {profiles.filter(p => p.role === 'ENCARGADO' && p.is_active).length}
              </h3>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-black/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest mb-1">Empleados Activos</p>
              <h3 className="text-3xl font-black text-gray-900">
                {profiles.filter(p => p.role === 'EMPLEADO' && p.is_active).length}
              </h3>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">Cargando Personal...</p>
          </div>
        ) : (
          <DataTable 
            columns={columns}
            data={profiles}
            keyExtractor={(p) => p.id}
          />
        )}
      </div>
    </RoleGuard>
  );
}
