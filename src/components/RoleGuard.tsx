'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Rol } from '@/types/domain/user.schema';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Rol[];
  fallback?: React.ReactNode;
  redirectPath?: string;
}

/**
 * Componente que protege una sección de la UI basada en el rol del usuario.
 * Si el usuario no tiene el rol permitido, muestra un fallback o redirige.
 */
export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallback = null, 
  redirectPath 
}: RoleGuardProps) {
  const { role, loading } = useAuth();
  const router = useRouter();
  
  // Normalizar para comparación robusta
  const userRole = role?.toUpperCase().trim();
  const hasAccess = userRole ? allowedRoles.some(r => r.toUpperCase() === userRole) : false;

  useEffect(() => {
    // Evitar redirecciones innecesarias o bucles
    if (!loading && !hasAccess && redirectPath && window.location.pathname !== redirectPath) {
      console.warn(`[RoleGuard] Acceso denegado. Rol: ${role}, Requeridos: ${allowedRoles.join(', ')}. Redirigiendo...`);
      router.push(redirectPath);
    }
  }, [loading, hasAccess, redirectPath, router, role, allowedRoles]);

  if (loading) return null; // O un spinner de carga

  if (!hasAccess) {
    if (redirectPath) {
      return null;
    }
    
    return fallback || (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
            Acceso Denegado
          </h1>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed text-sm">
            No tienes los permisos suficientes para acceder a esta sección. Esta área está reservada para roles autorizados.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link 
              href="/dashboard"
              className="flex items-center justify-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95 text-sm"
            >
              Volver al Dashboard
            </Link>
            
            <Link 
              href="/"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              Ir al Inicio
            </Link>
          </div>
        </div>
        
        <p className="mt-8 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
          Granja Fincas y Patitas — Sistema de Seguridad
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
