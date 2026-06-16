
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FilmRecord, SearchFilter, SortOption, DevRecipe } from './types';
import { storageService } from './services/storageService';
import { FilmCard } from './components/FilmCard';
import { RecordEditor } from './components/RecordEditor';
import { FilterBar } from './components/FilterBar';
import { DevTimer } from './components/DevTimer';
import { ProcessLibrary } from './components/ProcessLibrary';
import { SettingsModal } from './components/SettingsModal';
import { GlobalErrorBar } from './components/GlobalErrorBar';
import { LoginScreen } from './components/LoginScreen';
import { ReciprocityCalculator } from './components/ReciprocityCalculator';
import { ConfirmModal } from './components/ConfirmModal';
import { Button } from './components/ui/Button';
import { Plus, Film, Loader2, Trash2, X, Globe, Moon, Sun, Timer, Book, Search, Settings, Cloud, ChevronDown, Check, Eye, Calculator } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useTheme } from './contexts/ThemeContext';
import { useToast } from './contexts/ToastContext';

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { viewMode, cycleMode, toggleThemeAndSave } = useTheme();
  const { showToast } = useToast();
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('filmlog_auth') === 'true';
  });

  const [records, setRecords] = useState<FilmRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  // Track if Timer is opened in "Editor Mode" (from Library) or "Assistant Mode" (from FAB)
  const [isTimerEditorMode, setIsTimerEditorMode] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [librarySelectedRecipeId, setLibrarySelectedRecipeId] = useState<string | null>(null);
  
  // Track recipe updates to force refresh
  const [recipesLastUpdated, setRecipesLastUpdated] = useState(0);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FilmRecord | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<DevRecipe | null>(null);
  
  // GlobalError State
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Header Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
        // Initial Load only if authenticated
        const init = async () => {
            try {
                await loadRecords();
                // Auto Connect & Sync (Requirements)
                const hasUrl = localStorage.getItem('filmlog_supabase_url');
                if (hasUrl) {
                    performSync(true); 
                }
            } catch(e) {
                console.error("Init failed", e);
            }
        };
        init();
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('filmlog_auth', 'true');
  };

  const handleReturnHome = () => {
      setIsEditorOpen(false);
      setIsTimerOpen(false);
      setIsLibraryOpen(false);
      setIsSettingsOpen(false);
      setIsCalculatorOpen(false);
      // Close search if needed, but maybe keep it
  };

  const performSync = async (isAuto = false) => {
      if (isSyncing) return;
      setIsSyncing(true);
      setGlobalError(null); 
      try {
          const success = await storageService.triggerSync();
          await loadRecords();
          if (success) {
              if (isAuto) showToast(t('app.auto_connected'), 'success');
              else showToast(t('app.sync_success'), 'success');
          }
      } catch (e: any) {
          const msg = e instanceof Error ? e.message : "Unknown sync error";
          console.error("Sync Error:", e);
          if (!isAuto) setGlobalError(`${t('app.sync_fail')}: ${msg}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const loadRecords = async () => {
    try {
      const data = await storageService.getAll();
      setRecords(data);
    } catch (e: any) {
      console.error("Failed to load", e);
      setGlobalError("Failed to load local records.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (record: FilmRecord) => {
    try {
        await storageService.save(record);
        await loadRecords();
        showToast('Record saved successfully');
    } catch (e: any) {
        setGlobalError(`Save failed: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('app.confirm_delete') as string,
      message: t('app.confirm_delete_msg') as string || 'Are you sure you want to delete this record?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
            await storageService.delete(id);
            setRecords(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            showToast('Record deleted', 'success');
        } catch (e: any) {
            setGlobalError(`Delete failed: ${e.message}`);
        }
      }
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: String(t('app.confirm_bulk_delete', { count: selectedIds.size })),
      message: 'Are you sure you want to delete the selected records?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const ids = Array.from(selectedIds) as string[];
        
        try {
            for (const id of ids) {
                await storageService.delete(id);
            }
            setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
            setSelectedIds(new Set());
            showToast('Records deleted', 'success');
        } catch (e: any) {
            setGlobalError(`Bulk delete failed: ${e.message}`);
        }
      }
    });
  };

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  // Recipe Management
  const handleCreateRecipe = () => {
      setEditingRecipe(null);
      // We do NOT close the library, so the Timer opens "on top". 
      // Closing the Timer will "Return" to the Library.
      setIsTimerEditorMode(true);
      setIsTimerOpen(true);
  };

  const handleEditRecipe = (recipe: DevRecipe) => {
      setEditingRecipe(recipe);
      // Same stack logic
      setIsTimerEditorMode(true);
      setIsTimerOpen(true);
  };

  const handleOpenTimerAssistant = () => {
      setEditingRecipe(null);
      setIsTimerEditorMode(false); // Assistant mode (Selection screen)
      setIsTimerOpen(true);
  }

  const handleViewRecipeFromEditor = (recipeId: string) => {
      setLibrarySelectedRecipeId(recipeId);
      setIsLibraryOpen(true);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
      dragItem.current = position;
      // You can set effectAllowed here, etc.
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
      e.preventDefault();
      dragOverItem.current = position;
      
      // If we are filtering or sorting, disable reorder visual feedback to avoid confusion
      if (filters.length > 0 || sortOption !== 'date_desc') return;

      const draggedIdx = dragItem.current;
      if (draggedIdx === null || draggedIdx === position) return;

      // Reorder locally in 'records' (optimistic)
      const newRecords = [...records];
      const draggedRecord = newRecords[draggedIdx];
      newRecords.splice(draggedIdx, 1);
      newRecords.splice(position, 0, draggedRecord);
      
      dragItem.current = position;
      setRecords(newRecords);
  };

  const handleDragEnd = async () => {
      dragItem.current = null;
      dragOverItem.current = null;
      
      // Only persist if we are in default view (no filter, default sort)
      if (filters.length === 0 && sortOption === 'date_desc') {
          await storageService.saveAllRecords(records);
      }
  };

  // Memoized filtered records
  // We use this for rendering, but dragging mutates the 'records' state directly for the visual effect
  // If filters are active, we render 'filteredRecords' which might be a subset.
  // Dragging is generally only safe/intuitive on the full list or needs complex index mapping.
  // For simplicity, we disable DnD logic (via handleDragEnter check) if filters are active.
  const displayRecords = useMemo(() => {
    let result = [...records];
    if (filters.length > 0) {
      result = result.filter(record => {
        return filters.every(filter => {
          const recordValue = String(record[filter.field] || '').toLowerCase();
          const filterValue = filter.value.toLowerCase();
          switch (filter.operator) {
            case 'contains': return recordValue.includes(filterValue);
            case 'not_contains': return !recordValue.includes(filterValue);
            case 'equals': return recordValue === filterValue;
            case 'not_equals': return recordValue !== filterValue;
            default: return true;
          }
        });
      });
    }
    // Only apply sort if it's NOT the default manually ordered state (which we treat as date_desc loosely or 'manual')
    // But since we want to support sorting options:
    if (sortOption !== 'date_desc') {
       result.sort((a, b) => {
        switch (sortOption) {
            case 'date_asc': return (a.date || a.createdAt) - (b.date || b.createdAt);
            case 'model_asc': return a.filmModel.localeCompare(b.filmModel);
            case 'model_desc': return b.filmModel.localeCompare(a.filmModel);
            default: return 0;
        }
       });
    }
    return result;
  }, [records, filters, sortOption]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Helper to get mode label and icon
  const getModeLabel = () => {
    if (viewMode === 'light') return { label: t('settings.mode_light'), icon: <Sun className="w-4 h-4" /> };
    if (viewMode === 'dark') return { label: t('settings.mode_dark'), icon: <Moon className="w-4 h-4" /> };
    return { label: t('settings.mode_darkroom'), icon: <Eye className="w-4 h-4" /> };
  };
  const modeInfo = getModeLabel();

  return (
    <div className="min-h-screen-dynamic bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-20 transition-colors duration-300">
      {/* Navbar - Z-Index 50 (Higher than Process Library z-40) */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/90 dark:bg-gray-800/90 transition-all pt-safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {selectedIds.size > 0 ? (
                // Bulk Action Mode
                <div className="flex items-center w-full justify-between animate-in fade-in duration-200">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <X className="w-5 h-5 mr-1" />
                            {t('app.cancel')}
                        </Button>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{t('app.selected_count', { count: selectedIds.size })}</span>
                    </div>
                    <Button variant="danger" size="md" onClick={handleBulkDelete}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('app.bulk_delete')}
                    </Button>
                </div>
            ) : (
                // Normal Mode
                <>
                    <div className="relative" ref={menuRef}>
                        <button 
                            className="flex items-center gap-3 shrink-0 focus:outline-none group select-none cursor-pointer p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            <div className="bg-indigo-600 p-2 rounded-lg transition-all duration-300 group-hover:bg-indigo-700">
                                <Film className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors hidden sm:block">
                                    {t('app.title')}
                                </h1>
                                <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors sm:hidden">
                                    FilmLog
                                </h1>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isMenuOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                            </div>
                        </button>

                        {/* Dropdown Menu below title */}
                        {isMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-left flex flex-col p-1">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    {t('settings.menu_mode')}
                                </div>
                                <button onClick={cycleMode} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-between">
                                    <span className="flex items-center gap-3">
                                        <span className={`p-1.5 rounded-md ${viewMode === 'darkroom' ? 'bg-red-900 text-red-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                                            {modeInfo.icon}
                                        </span>
                                        {modeInfo.label}
                                    </span>
                                </button>
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                                <button onClick={toggleLanguage} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-between">
                                    <span className="flex items-center gap-3"><span className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-300"><Globe className="w-4 h-4" /></span>{t('settings.menu_lang')}</span>
                                    <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">{language === 'zh' ? 'English' : '中文'}</span>
                                </button>
                                <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center gap-3">
                                    <span className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-300"><Settings className="w-4 h-4" /></span>{t('app.settings')}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => performSync()}
                          className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          title={t('app.sync')}
                          disabled={isSyncing}
                        >
                          <Cloud className={`w-5 h-5 ${isSyncing ? 'animate-pulse text-indigo-500' : ''}`} />
                        </Button>
                         <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsSearchOpen(!isSearchOpen)} 
                          className={`text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 ${isSearchOpen ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''}`}
                        >
                          <Search className="w-5 h-5" />
                        </Button>
                      
                        <Button 
                            onClick={() => { setEditingRecord(null); setIsEditorOpen(true); }}
                            className="shadow-sm shadow-indigo-200 dark:shadow-none whitespace-nowrap shrink-0 ml-2"
                        >
                            <Plus className="w-5 h-5 sm:mr-1" />
                            <span className="hidden sm:inline">{t('app.new_record')}</span>
                        </Button>
                    </div>
                </>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-safe-bottom">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isSearchOpen ? 'max-h-[800px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
            <FilterBar 
                onFiltersChange={setFilters} 
                sortOption={sortOption}
                onSortChange={setSortOption}
            />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p>{t('app.loading')}</p>
          </div>
        ) : displayRecords.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            <Film className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">{t('app.no_records')}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {filters.length > 0 ? t('app.try_filter') : t('app.start_record')}
            </p>
            {filters.length === 0 && (
              <div className="mt-6">
                <Button onClick={() => { setEditingRecord(null); setIsEditorOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('app.create_first')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayRecords.map((record, index) => (
              <div
                key={record.id}
                draggable={filters.length === 0 && sortOption === 'date_desc'}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className="transition-transform duration-200 ease-in-out h-full"
              >
                  <FilmCard 
                    record={record}
                    selected={selectedIds.has(String(record.id))}
                    onToggleSelection={(id) => toggleSelection(String(id))}
                    onEdit={(r) => { setEditingRecord(r); setIsEditorOpen(true); }}
                    onDelete={(id) => handleDelete(String(id))}
                    onSyncRequest={() => performSync()}
                  />
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-4 mb-safe-bottom ml-safe-left animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          onClick={() => setIsCalculatorOpen(true)}
          className="group relative flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 hover:scale-110 hover:-translate-y-1"
          title={t('calc.title')}
        >
          <Calculator className="w-5 h-5" />
        </button>

        <button
          onClick={() => { setLibrarySelectedRecipeId(null); setIsLibraryOpen(true); }}
          className="group relative flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 hover:scale-110 hover:-translate-y-1"
          title={t('app.library')}
        >
          <Book className="w-5 h-5" />
        </button>
        
        <button
          onClick={handleOpenTimerAssistant}
          className="group relative flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all duration-300 hover:scale-110 hover:-translate-y-1 hover:shadow-indigo-500/50"
          title={t('timer.title')}
        >
          <Timer className="w-7 h-7" />
        </button>
      </div>

      <GlobalErrorBar 
        message={globalError} 
        onClose={() => setGlobalError(null)} 
      />

      <RecordEditor 
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onReturnHome={handleReturnHome}
        initialData={editingRecord}
        onSave={handleSave}
        onViewRecipe={handleViewRecipeFromEditor}
      />

      <ProcessLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onReturnHome={handleReturnHome}
        onCreate={handleCreateRecipe}
        onEdit={handleEditRecipe}
        initialSelectedId={librarySelectedRecipeId}
        lastUpdated={recipesLastUpdated}
      />

      <DevTimer 
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        onReturnHome={handleReturnHome}
        initialRecipe={editingRecipe}
        isEditorMode={isTimerEditorMode}
        onRecipeSave={() => setRecipesLastUpdated(Date.now())}
      />

      <ReciprocityCalculator
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        confirmText={t('card.delete') as string || 'Delete'}
        cancelText={t('app.cancel') as string || 'Cancel'}
      />
    </div>
  );
};

export default App;
