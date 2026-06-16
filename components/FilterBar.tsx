import React, { useState } from 'react';
import { Plus, X, Search, Filter, ArrowUpDown } from 'lucide-react';
import { SearchFilter, SearchOperator, FIELD_LABELS, FilmRecord, SortOption } from '../types';
import { Button } from './ui/Button';
import { useLanguage } from '../contexts/LanguageContext';

interface FilterBarProps {
  onFiltersChange: (filters: SearchFilter[]) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onFiltersChange, sortOption, onSortChange }) => {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addFilter = () => {
    const newFilter: SearchFilter = {
      id: Date.now().toString(),
      field: 'filmModel',
      operator: 'contains',
      value: ''
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    onFiltersChange(updated);
    setIsOpen(true);
  };

  const removeFilter = (id: string) => {
    const updated = filters.filter(f => f.id !== id);
    setFilters(updated);
    onFiltersChange(updated);
  };

  const updateFilter = (id: string, updates: Partial<SearchFilter>) => {
    const updated = filters.map(f => f.id === id ? { ...f, ...updates } : f);
    setFilters(updated);
    onFiltersChange(updated);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 gap-4 sm:gap-0">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <Search className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold">{t('filter.search')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Sort Dropdown */}
          <div className="relative flex-grow sm:flex-grow-0">
            <select 
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full sm:w-auto appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1.5 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-colors cursor-pointer"
            >
              <option value="date_desc">{t('sort.date_desc')}</option>
              <option value="date_asc">{t('sort.date_asc')}</option>
              <option value="model_asc">{t('sort.model_asc')}</option>
              <option value="model_desc">{t('sort.model_desc')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </div>
          </div>

          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsOpen(!isOpen)}
            className={filters.length > 0 ? 'text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400' : ''}
          >
            <Filter className="w-4 h-4 mr-1.5" />
            {filters.length > 0 ? t('filter.filter_count', { count: filters.length }) : t('filter.filter')}
          </Button>
          <Button variant="primary" size="sm" onClick={addFilter}>
            <Plus className="w-4 h-4 mr-1.5" />
            {t('filter.add')}
          </Button>
        </div>
      </div>

      {(isOpen || filters.length > 0) && (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
          {filters.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-2">{t('filter.no_active')}</p>
          ) : (
            filters.map((filter) => (
              <div key={filter.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                <select
                  value={filter.field}
                  onChange={(e) => updateFilter(filter.id, { field: e.target.value as keyof FilmRecord })}
                  className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {Object.keys(FIELD_LABELS).map((key) => (
                    <option key={key} value={key}>{t(`field.${key}`)}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(filter.id, { operator: e.target.value as SearchOperator })}
                  className="block w-full sm:w-auto rounded-md border-gray-300 dark:border-gray-600 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="contains">{t('filter.contains')}</option>
                  <option value="not_contains">{t('filter.not_contains')}</option>
                  <option value="equals">{t('filter.equals')}</option>
                  <option value="not_equals">{t('filter.not_equals')}</option>
                </select>

                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                  placeholder={t('filter.placeholder')}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />

                <button
                  onClick={() => removeFilter(filter.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors ml-auto sm:ml-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};