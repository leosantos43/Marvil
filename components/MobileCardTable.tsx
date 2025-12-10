
import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface MobileCardTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

function MobileCardTable<T>({ data, columns, keyExtractor, onRowClick, emptyMessage = "Nenhum dado encontrado" }: MobileCardTableProps<T>) {
  if (data.length === 0) {
    return <div className="p-8 text-center text-gray-400">{emptyMessage}</div>;
  }

  return (
    <div className="w-full">
      {/* Desktop View: Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-gray-700 bg-secondary">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-800 text-xs uppercase text-gray-400">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-6 py-3 font-medium ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
              {onRowClick && <th className="px-6 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((item) => (
              <tr 
                key={keyExtractor(item)} 
                onClick={() => onRowClick && onRowClick(item)}
                className={`hover:bg-gray-700/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, idx) => (
                  <td key={idx} className="px-6 py-4 whitespace-nowrap">
                    {typeof col.accessor === 'function' 
                      ? col.accessor(item) 
                      : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={16} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View: Stacked Cards */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          <div 
            key={keyExtractor(item)}
            onClick={() => onRowClick && onRowClick(item)}
            className={`bg-secondary p-4 rounded-lg border border-gray-700 shadow-sm relative ${onRowClick ? 'active:bg-gray-800 transition-colors cursor-pointer' : ''}`}
          >
            {columns.map((col, idx) => {
              const content = typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode);
              
              // First column is usually the title/main identifier
              if (idx === 0) {
                return (
                  <div key={idx} className="mb-3 flex justify-between items-start">
                    <div className="font-bold text-white text-lg pr-4">{content}</div>
                    {onRowClick && <ChevronRight className="text-primary mt-1 shrink-0" size={20} />}
                  </div>
                );
              }

              // Special handling for "Ações" column to ensure buttons are reachable
              if (col.header === 'Ações' || col.className?.includes('text-right')) {
                 return (
                    <div key={idx} className="mt-3 pt-3 border-t border-gray-700 flex justify-end" onClick={(e) => e.stopPropagation()}>
                        {content}
                    </div>
                 );
              }

              return (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-700/30 last:border-0 last:pb-0">
                  <span className="text-xs text-gray-400 font-medium uppercase mr-2">{col.header}</span>
                  <div className="text-sm text-gray-200 text-right truncate max-w-[70%]">{content}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MobileCardTable;
