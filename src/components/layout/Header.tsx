'use client';

import { UserCircle, LogOut, Menu, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface HeaderProps {
  user?: { email: string; full_name?: string; role?: string };
}

export default function Header({ user }: HeaderProps) {
  const { signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) return;

    const search = searchTerm.toLowerCase().trim();

    // Detectar qué está buscando el usuario
    if (search.includes('animal') || search.includes('vaca') || search.includes('cerdo') || search.includes('gallina')) {
      router.push(`/dashboard/animales?search=${encodeURIComponent(search)}`);
    } else if (search.includes('insumo') || search.includes('alimento') || search.includes('medicamento')) {
      router.push(`/dashboard/insumos?search=${encodeURIComponent(search)}`);
    } else if (search.includes('usuario') || search.includes('empleado') || search.includes('personal')) {
      router.push(`/dashboard/usuarios?search=${encodeURIComponent(search)}`);
    } else if (search.includes('vacuna') || search.includes('vacunación')) {
      router.push(`/dashboard/vacunacion?search=${encodeURIComponent(search)}`);
    } else if (search.includes('producción') || search.includes('produccion') || search.includes('produzir')) {
      router.push(`/dashboard/produccion?search=${encodeURIComponent(search)}`);
    } else if (search.includes('reproducción') || search.includes('reproduccion') || search.includes('reproducir')) {
      router.push(`/dashboard/reproduccion?search=${encodeURIComponent(search)}`);
    } else {
      // Búsqueda genérica - ir a insumos por defecto
      router.push(`/dashboard/insumos?search=${encodeURIComponent(search)}`);
    }
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[var(--glass-border)] flex items-center justify-between px-8 z-10 sticky top-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight leading-none">Agrónomo Digital</h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">Fincas y Patitas</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
        <form onSubmit={handleSearch} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e);
              }
            }}
            placeholder="Buscar: animales, insumos, vacunas..."
            className="block w-full pl-11 pr-4 py-3 bg-gray-100/50 border-none rounded-2xl text-sm font-medium placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-[var(--brand)]/10 transition-all outline-none"
          />
        </form>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-5">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-gray-900 leading-tight">
              {user?.full_name || user?.email || 'Usuario'}
            </span>
            <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-widest">{user?.role || 'EMPLEADO'}</span>
          </div>
          <div className="h-11 w-11 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border border-black/5 shadow-sm overflow-hidden">
            {user?.role === 'ADMINISTRADOR' ? (
              <img src="https://ui-avatars.com/api/?name=Admin&background=4a7c59&color=fff" alt="User" />
            ) : (
              <UserCircle className="h-7 w-7" />
            )}
          </div>
        </div>

        <div className="h-8 border-l border-gray-100 mx-1 hidden sm:block"></div>

        <button
          onClick={() => signOut()}
          className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}