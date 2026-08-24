'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Beef, Filter, Activity, Plus, Loader2, Search } from 'lucide-react';
import { SupabaseAnimalRepository } from '@/repositories/supabase/AnimalRepository';
import { createClient } from '@/utils/supabase/client';
import { AnimalWithRelations } from '@/types/domain/animal.schema';
import AnimalFormModal from '@/components/animales/AnimalFormModal';

// Función para extraer el apodo del campo notes
function extractNickname(notes: string | null | undefined): string | null {
  if (!notes) return null;

  // Buscar "Apodo: xxx" en las notas
  const match = notes.match(/Apodo:\s*(.+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

export default function AnimalesPage() {
  const router = useRouter();
  const [repo] = useState(() => new SupabaseAnimalRepository(createClient()));

  // Estados de datos
  const [animals, setAnimals] = useState<AnimalWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Estados de ordenamiento
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Estados de filtros
  const [filterSpecies, setFilterSpecies] = useState<string>('Todas');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [filterVaccination, setFilterVaccination] = useState<string>('all');
  const [filterSex, setFilterSex] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Cargar especies para el filtro
  const [speciesList, setSpeciesList] = useState<Array<{ id: string; name: string }>>([]);

  // Escuchar eventos de búsqueda global desde el Header
  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      const customEvent = event as CustomEvent;
      const searchTerm = customEvent.detail.term;
      setSearchText(searchTerm);
    };

    window.addEventListener('global-search', handleGlobalSearch);

    return () => {
      window.removeEventListener('global-search', handleGlobalSearch);
    };
  }, []);

  // Leer parámetro de búsqueda de la URL al cargar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchText(searchParam);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Si hay texto de búsqueda, cargamos todos y filtramos del lado del cliente
      if (searchText && searchText.trim()) {
        // Cargar todos los animales
        const allAnimals = await repo.getAll();

        // Filtrar del lado del cliente
        const filtered = allAnimals.filter(animal => {
          const searchLower = searchText.toLowerCase().trim();

          // Extraer apodo
          const nickname = extractNickname(animal.notes);

          // Buscar en múltiples campos
          const matchesName = animal.name?.toLowerCase().includes(searchLower) || false;
          const matchesNickname = nickname ? nickname.toLowerCase().includes(searchLower) : false;
          const matchesCode = animal.code?.toLowerCase().includes(searchLower) || false;
          const matchesSpecies = animal.species?.name?.toLowerCase().includes(searchLower) || false;
          const matchesSpeciesDisplay = animal.species?.display_name?.toLowerCase().includes(searchLower) || false;
          const matchesBreed = animal.breed?.name?.toLowerCase().includes(searchLower) || false;
          const matchesNotes = animal.notes?.toLowerCase().includes(searchLower) || false;

          return matchesName || matchesNickname || matchesCode || matchesSpecies || matchesSpeciesDisplay || matchesBreed || matchesNotes;
        });

        // Aplicar paginación manual
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = filtered.slice(start, end);

        setAnimals(paginatedData);
        setTotalRecords(filtered.length);
        setTotalPages(Math.ceil(filtered.length / pageSize));
      } else {
        // Búsqueda normal con paginación del lado del servidor
        const result = await repo.search({
          page: currentPage,
          limit: pageSize,
          sort: sortKey,
          order: sortDirection,
          species: filterSpecies !== 'Todas' ? filterSpecies : undefined,
          healthStatus: filterHealth !== 'all' ? filterHealth : undefined,
          vaccinationStatus: filterVaccination !== 'all' ? filterVaccination : undefined,
          sex: filterSex !== 'all' ? filterSex : undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined,
        });

        setAnimals(result.data);
        setTotalRecords(result.total);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error("Error cargando animales:", error);
    } finally {
      setLoading(false);
    }
  }, [repo, currentPage, pageSize, sortKey, sortDirection, filterSpecies, filterHealth, filterVaccination, filterSex, filterStatus, searchText]);

  const loadSpecies = async () => {
    try {
      const species = await repo.getSpecies();
      setSpeciesList(species);
    } catch (error) {
      console.error("Error cargando especies:", error);
    }
  };

  useEffect(() => {
    loadSpecies();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSpecies, filterHealth, filterVaccination, filterSex, filterStatus, searchText]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleExport = (format: 'csv' | 'excel') => {
    // Crear CSV
    const headers = ['ID', 'Apodo', 'Código', 'Especie', 'Raza', 'Sexo', 'Fecha Nacimiento', 'Estado Salud', 'Vacunación', 'Estado'];
    const rows = animals.map(a => {
      const nickname = extractNickname(a.notes);
      return [
        a.id,
        nickname ?? a.name ?? '',
        a.code ?? '',
        a.species?.display_name ?? '',
        a.breed?.name ?? '',
        a.sex,
        a.birth_date ?? '',
        a.health_status,
        a.vaccination_status,
        a.status
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `animales_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Column<AnimalWithRelations>[] = [
    {
      key: 'name',
      header: 'Identificación',
      sortable: true,
      render: (a) => {
        // Extraer apodo de las notas
        const nickname = extractNickname(a.notes);

        return (
          <div className="flex flex-col gap-1">
            {/* Apodo/Nombre del animal */}
            {nickname && nickname.length > 0 ? (
              <span className="font-extrabold text-gray-900 text-base capitalize">
                {nickname}
              </span>
            ) : (
              <span className="text-sm font-bold text-gray-400 italic">
                Sin apodo
              </span>
            )}
            {/* Código del animal */}
            <span className="text-xs font-bold text-[var(--brand)] font-mono">
              {a.code}
            </span>
          </div>
        );
      }
    },
    {
      key: 'species',
      header: 'Especie / Raza',
      sortable: true,
      render: (a) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-700">{a.species?.display_name ?? 'Desconocida'}</span>
          <span className="text-xs font-medium text-gray-500">{a.breed?.name ?? 'Mestiza/Sin definir'}</span>
        </div>
      )
    },
    {
      key: 'sex',
      header: 'Sexo',
      sortable: true,
      render: (a) => (
        <span className="capitalize font-medium text-gray-600">{a.sex}</span>
      )
    },
    {
      key: 'birth_date',
      header: 'Edad / Nacimiento',
      sortable: true,
      render: (a) => {
        if (!a.birth_date) {
          return <span className="text-xs text-gray-400">Sin registro</span>;
        }
        const birthDate = new Date(a.birth_date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - birthDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let ageStr = `${Math.floor(diffDays / 30)} meses`;
        if (diffDays > 365) {
          ageStr = `${(diffDays / 365).toFixed(1)} años`;
        }

        return (
          <div className="flex flex-col">
            <span className="font-bold text-gray-700">{ageStr}</span>
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{a.birth_date}</span>
          </div>
        );
      }
    },
    {
      key: 'health_status',
      header: 'Salud',
      sortable: true,
      render: (a) => {
        let variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';
        const label = a.health_status.replace('_', ' ');
        if (a.health_status === 'sano') variant = 'success';
        if (a.health_status === 'en_tratamiento') variant = 'warning';
        if (a.health_status === 'cronico') variant = 'warning';
        if (a.health_status === 'fallecido') variant = 'danger';

        return <Badge variant={variant} dot>{label}</Badge>;
      }
    },
    {
      key: 'vaccination_status',
      header: 'Vacunas',
      sortable: true,
      render: (a) => {
        if (a.vaccination_status === 'al_dia') return <Badge variant="success" dot>Al día</Badge>;
        if (a.vaccination_status === 'pendiente') return <Badge variant="warning" dot>Pendientes</Badge>;
        if (a.vaccination_status === 'vencido') return <Badge variant="danger" dot>Vencido</Badge>;
        return <Badge variant="danger" dot>Atrasado</Badge>;
      }
    },
    {
      key: 'status',
      header: 'Estado Pecuario',
      sortable: true,
      render: (a) => (
        <Badge variant={a.status === 'activo' ? 'neutral' : 'danger'}>{a.status}</Badge>
      )
    }
  ];

  return (
    <RoleGuard allowedRoles={['ADMINISTRADOR']} redirectPath="/acceso-denegado">
      <div className="space-y-6 animate-fade-in pb-10">
        <PageHeader
          title="Inventario Pecuario"
          description="Visualiza el registro completo de animales, filtra por especies y monitorea el estado de salud, vacunación y mortalidad."
          icon={Beef}
          actions={
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Plus size={18} />
              <span>Registrar Animal</span>
            </button>
          }
        />

        {/* Panel de Filtros Avanzados */}
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-black/5 space-y-4">
          {/* Fila 1: Búsqueda y Filtros Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por apodo, código o especie..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-xl font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>

            {/* Filtro Especie */}
            <select
              value={filterSpecies}
              onChange={(e) => setFilterSpecies(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="Todas">Todas las especies</option>
              {speciesList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Filtro Salud */}
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todos los estados de salud</option>
              <option value="sano">Sano</option>
              <option value="en_tratamiento">En tratamiento</option>
              <option value="cronico">Crónico</option>
              <option value="fallecido">Fallecido</option>
            </select>

            {/* Filtro Vacunación */}
            <select
              value={filterVaccination}
              onChange={(e) => setFilterVaccination(e.target.value)}
              className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors"
            >
              <option value="all">Todas las vacunaciones</option>
              <option value="al_dia">Al día</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>

          {/* Fila 2: Filtros Secundarios y KPIs */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Filtro Sexo */}
              <select
                value={filterSex}
                onChange={(e) => setFilterSex(e.target.value)}
                className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors text-sm"
              >
                <option value="all">Todos los sexos</option>
                <option value="macho">Macho</option>
                <option value="hembra">Hembra</option>
              </select>

              {/* Filtro Estado */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-50 border border-black/5 rounded-xl px-4 py-2 font-medium text-gray-700 outline-none focus:border-[var(--brand)] transition-colors text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="vendido">Vendido</option>
                <option value="muerto">Muerto</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>

            {/* KPIs Rápidos */}
            <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Total</span>
                <span className="text-xl font-black text-gray-900 leading-none mt-1">{totalRecords}</span>
              </div>
              <div className="w-[1px] h-8 bg-gray-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  Tasa Mortalidad (30d) <Activity size={12} className="text-[var(--brand)] ml-1" />
                </span>
                <span className="text-xl font-black text-gray-900 leading-none mt-1">
                  N/A
                </span>
              </div>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={animals}
          keyExtractor={(a) => a.id}
          onRowClick={(a) => router.push(`/dashboard/animales/${a.id}`)}
          emptyMessage="No se encontraron animales registrados."
          totalRecords={totalRecords}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onExport={handleExport}
          loading={loading}
        />

        <AnimalFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadData}
        />
      </div>
    </RoleGuard>
  );
}