'use client';

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;

  // Paginación
  totalRecords?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Ordenamiento
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  // Exportación
  onExport?: (format: 'csv' | 'excel') => void;

  loading?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No se encontraron registros.',
  onRowClick,
  totalRecords,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDirection = 'asc',
  onSort,
  onExport,
  loading = false
}: DataTableProps<T>) {
  const totalPages = totalRecords !== undefined ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;

  const handleSort = (key: string) => {
    if (!onSort) return;
    onSort(key);
  };

  const exportToCSV = () => {
    if (!onExport) return;
    onExport('csv');
  };

  const exportToExcel = () => {
    if (!onExport) return;
    onExport('excel');
  };

  // Mostrar paginación si hay totalRecords definido (aunque sea 1 página)
  const showPagination = totalRecords !== undefined;

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
      {/* Header con controles de exportación */}
      {onExport && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/30">
          <div className="text-sm text-gray-600">
            {totalRecords !== undefined && (
              <span className="font-bold">{totalRecords}</span>
            )}{' '}
            registros encontrados
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[var(--brand)] rounded-xl hover:bg-[var(--brand-hover)] transition-colors"
            >
              <Download size={16} />
              Excel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-4 text-[10px] uppercase tracking-widest font-extrabold text-gray-400 ${col.sortable ? 'cursor-pointer hover:text-gray-600 select-none' : ''
                    } ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-[var(--brand)]">
                        {sortDirection === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                  <div className="flex justify-center items-center gap-2">
                    <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                    <span>Cargando...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400 italic font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={`hover:bg-gray-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''
                    }`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 text-sm ${col.className || ''}`}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación - Siempre visible si hay totalRecords */}
      {showPagination && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Página <span className="font-bold">{currentPage}</span> de{' '}
              <span className="font-bold">{totalPages}</span>
            </span>
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}