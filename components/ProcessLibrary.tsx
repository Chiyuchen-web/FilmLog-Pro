import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Edit2, Trash2, Droplet, Clock, ChevronRight, Search, BookOpen, Home, Sliders, Hourglass, Activity, Check } from 'lucide-react';
import { DevRecipe, TimerConfig } from '../types';
import { Button } from './ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storageService';
import { ConfirmModal } from './ConfirmModal';

const COLORS = {
    prewet: '#60A5FA', // Blue-400
    develop: '#F59E0B', // Amber-500
    stop: '#A855F7', // Purple-500
    fix: '#14B8A6', // Teal-500
    wash: '#06B6D4', // Cyan-500
    wait: '#94A3B8', // Slate-400
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getTotalTime = (recipe: DevRecipe) => {
    const config = recipe.config;
    let total = 0;
    if (config.enablePreWet) total += (config.preWetTime || 0) + (config.enablePourTime ? (config.pourTime || 10) : 0);
    
    // Dev Loop
    let devTime = 0;
    config.developerSteps.forEach(s => {
        devTime += s.duration;
        const pourTime = s.overridePourTime ? (s.pourTime || 10) : (config.enablePourTime ? (config.pourTime || 10) : 0);
        if (config.enablePourTime || s.overridePourTime) devTime += pourTime;
    });
    total += devTime * Math.max(1, config.devLoopCount);

    if (config.enableStopBath) total += (config.stopTime || 0) + (config.enablePourTime ? (config.pourTime || 10) : 0);
    total += (config.fixTime || 0) + (config.enablePourTime ? (config.pourTime || 10) : 0);
    total += (config.washTime || 0);
    
    return total;
};

const StaticTimeline = ({ config, className = "" }: { config: TimerConfig, className?: string }) => {
    const total = getTotalTime({ config } as DevRecipe);
    if (total === 0) return null;

    const segments: { type: string, duration: number }[] = [];
    
    if (config.enablePreWet) segments.push({ type: 'prewet', duration: config.preWetTime });
    
    // Sum dev time
    const devDuration = config.developerSteps.reduce((acc, s) => acc + s.duration, 0) * config.devLoopCount;
    segments.push({ type: 'develop', duration: devDuration });

    if (config.enableStopBath) segments.push({ type: 'stop', duration: config.stopTime });
    segments.push({ type: 'fix', duration: config.fixTime });
    segments.push({ type: 'wash', duration: config.washTime });

    return (
        <div className={`flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}>
            {segments.map((seg, i) => (
                <div 
                    key={i} 
                    style={{ width: `${(seg.duration / total) * 100}%`, backgroundColor: (COLORS as any)[seg.type] }}
                    className="h-full"
                />
            ))}
        </div>
    );
};

interface ProcessLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onReturnHome: () => void;
    onCreate: () => void;
    onEdit: (recipe: DevRecipe) => void;
    initialSelectedId: string | null;
    lastUpdated: number;
}

export const ProcessLibrary: React.FC<ProcessLibraryProps> = ({ 
    isOpen, onClose, onReturnHome, onCreate, onEdit, initialSelectedId, lastUpdated 
}) => {
    const { t } = useLanguage();
    const [recipes, setRecipes] = useState<DevRecipe[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

    // Resizable Sidebar State
    const [sidebarWidth, setSidebarWidth] = useState(340);
    const [isResizing, setIsResizing] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        id: string | null;
    }>({ isOpen: false, id: null });
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadRecipes();
            setSelectedId(initialSelectedId);
        }
    }, [isOpen, lastUpdated, initialSelectedId]);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            // Constraints: Min 260px, Max 800px
            if (newWidth > 260 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    const loadRecipes = async () => {
        const data = await storageService.getRecipes();
        setRecipes(data);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmModal({ isOpen: true, id });
    };

    const executeDelete = async () => {
        if (!confirmModal.id) return;
        const id = confirmModal.id;
        setConfirmModal({ isOpen: false, id: null });
        
        await storageService.deleteRecipe(id);
        await loadRecipes();
        if (selectedId === id) setSelectedId(null);
    };

    const filteredRecipes = recipes.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.config.filmModel?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedRecipe = recipes.find(r => r.id === selectedId);

    // Agitation Info Component
    const AgitationInfo = ({ config, step, type }: { config: TimerConfig, step?: any, type: 'dev' | 'fix' }) => {
        let overrideGlobal = false;
        let initial, agitate, stand;

        if (type === 'dev' && step) {
            overrideGlobal = !!step.overrideGlobalAgitation;
            initial = step.initialAgitation;
            agitate = step.agitationDuration;
            stand = step.standDuration;
        } else if (type === 'fix') {
            overrideGlobal = !!config.fixOverrideGlobalAgitation;
            initial = config.fixInitialAgitation;
            agitate = config.fixAgitationDuration;
            stand = config.fixStandDuration;
        }

        const useGlobal = config.globalAgitationEnabled && !overrideGlobal;
        const displayInitial = useGlobal ? config.globalInitialAgitation : initial;
        const displayAgitate = useGlobal ? config.globalAgitationDuration : agitate;
        const displayStand = useGlobal ? config.globalStandDuration : stand;

        return (
            <div className="mt-3 text-xs bg-white/50 dark:bg-black/20 rounded-lg p-2 border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 mb-1.5">
                     <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${useGlobal ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300' : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'}`}>
                        {useGlobal ? t('timer.using_global') : t('timer.separate_setting')}
                     </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                         <span className="block text-[10px] text-gray-400 uppercase">{t('timer.initial_agitation')}</span>
                         <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{displayInitial}s</span>
                    </div>
                    <div>
                         <span className="block text-[10px] text-gray-400 uppercase">{t('timer.agitation_duration')}</span>
                         <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{displayAgitate}s</span>
                    </div>
                    <div>
                         <span className="block text-[10px] text-gray-400 uppercase">{t('timer.stand_duration')}</span>
                         <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{displayStand}s</span>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed left-0 right-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-[45] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden shadow-2xl border-t border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-500" /> {t('library.title')}
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={onReturnHome} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                        <Home className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar List - Resizable */}
                <div 
                    className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 relative`}
                    style={{ width: isMobile ? '100%' : sidebarWidth }}
                >
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search recipes..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                        <Button onClick={onCreate} className="w-full justify-center">
                            <Plus className="w-4 h-4 mr-2" /> {t('library.new_process')}
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {filteredRecipes.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-sm">{t('library.empty')}</div>
                        ) : (
                            filteredRecipes.map(recipe => (
                                <div 
                                    key={recipe.id}
                                    onClick={() => setSelectedId(recipe.id)}
                                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 ${selectedId === recipe.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1 text-sm">{recipe.name}</h3>
                                        <ChevronRight className={`w-4 h-4 ${selectedId === recipe.id ? 'text-indigo-500' : 'text-gray-300'}`} />
                                    </div>

                                    {/* Film Model - Full Line */}
                                    {recipe.config.filmModel && (
                                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 truncate">
                                            {recipe.config.filmModel}
                                        </div>
                                    )}

                                    {/* Chemical Steps List (Vertical) */}
                                    <div className="flex flex-col gap-1 mb-3">
                                        {recipe.config.developerSteps.map((step, idx) => (
                                            <div key={`dev-${idx}`} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                                 <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0"></span>
                                                 <span className="truncate">{step.name} {step.dilution} {step.volume}ml</span>
                                            </div>
                                        ))}
                                        <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                             <span className="w-1 h-1 rounded-full bg-teal-500 shrink-0"></span>
                                             <span className="truncate">{recipe.config.fixerName} {recipe.config.fixerDilution} {recipe.config.fixerVolume}ml</span>
                                        </div>
                                    </div>

                                    {/* Footer with Time and Timeline Bar */}
                                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                         <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                                            <Clock className="w-3 h-3" />
                                            <span className="font-mono font-bold">{formatTime(getTotalTime(recipe))}</span>
                                        </div>
                                        <div className="flex-1 h-1.5">
                                             <StaticTimeline config={recipe.config} className="h-full w-full rounded-full opacity-80" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Resize Handle */}
                    {!isMobile && (
                        <div 
                            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 z-50 transition-colors opacity-0 hover:opacity-100 active:opacity-100"
                            onMouseDown={startResizing}
                        />
                    )}
                </div>

                {/* Detail View */}
                <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden`}>
                    {selectedRecipe ? (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-32">
                            <div className="max-w-3xl mx-auto space-y-6">
                                {/* Back button on mobile */}
                                <button onClick={() => setSelectedId(null)} className="md:hidden flex items-center text-gray-500 mb-4">
                                    <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back
                                </button>

                                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 flex gap-2">
                                        <button onClick={() => onEdit(selectedRecipe)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, selectedRecipe.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">{selectedRecipe.name}</h1>
                                    
                                    {/* Global Configuration Card */}
                                    <div className="mt-8 mb-8">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                            <Sliders className="w-5 h-5 text-indigo-500" /> {t('timer.global_settings')}
                                        </h3>
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">{t('field.devMethod')}</div>
                                                <div className="font-medium text-gray-900 dark:text-white">{t(`enum.${selectedRecipe.config.devMethod}`)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">{t('timer.loop_count')}</div>
                                                <div className="font-medium text-gray-900 dark:text-white">{selectedRecipe.config.devLoopCount}x</div>
                                            </div>
                                            
                                            {selectedRecipe.config.globalAgitationEnabled ? (
                                                <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Activity className="w-3 h-3 text-indigo-500" />
                                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">{t('timer.global_agitation')}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-xs text-gray-500 block">{t('timer.initial_agitation')}</span>
                                                            <span className="font-mono font-bold">{selectedRecipe.config.globalInitialAgitation}s</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-gray-500 block">{t('timer.agitation_duration')}</span>
                                                            <span className="font-mono font-bold">{selectedRecipe.config.globalAgitationDuration}s</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-gray-500 block">{t('timer.stand_duration')}</span>
                                                            <span className="font-mono font-bold">{selectedRecipe.config.globalStandDuration}s</span>
                                                        </div>
                                                    </div>
                                                    {selectedRecipe.config.skipInitialAgitationOnLoop && (
                                                        <div className="text-xs text-indigo-500 mt-2 flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> {t('timer.skip_initial_loop')}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                 <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3 mt-1 text-xs text-gray-400 italic">
                                                     {t('timer.global_agitation')} Disabled
                                                 </div>
                                            )}

                                            {selectedRecipe.config.enablePourTime && (
                                                <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                                    <div className="text-xs text-gray-500 uppercase mb-1 flex items-center gap-1"><Hourglass className="w-3 h-3"/> {t('timer.custom_pour')}</div>
                                                    <div className="font-medium text-gray-900 dark:text-white">{selectedRecipe.config.pourTime}s</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Detailed Steps */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Droplet className="w-5 h-5 text-indigo-500" /> {t('timer.stages')}
                                        </h3>
                                        
                                        {/* Prewet */}
                                        {selectedRecipe.config.enablePreWet && (
                                            <div className="flex flex-col p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="font-bold text-blue-900 dark:text-blue-300">{selectedRecipe.config.preWetName || 'Pre-wet'}</div>
                                                    <div className="font-mono font-bold text-blue-800 dark:text-blue-300">
                                                        {formatTime(selectedRecipe.config.preWetTime)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-blue-700 dark:text-blue-400">
                                                     {selectedRecipe.config.preWetVolume}ml
                                                </div>
                                            </div>
                                        )}

                                        {/* Developer Steps - Wrapped for Loop Indication */}
                                        <div className="relative">
                                            {selectedRecipe.config.devLoopCount > 1 && (
                                                <>
                                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-amber-200 dark:bg-amber-800/30 rounded-full"></div>
                                                    <div className="absolute -left-2 -top-2 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border-2 border-white dark:border-gray-800 z-10 transform -rotate-12">
                                                        {selectedRecipe.config.devLoopCount}X
                                                    </div>
                                                </>
                                            )}

                                            <div className={`space-y-4 ${selectedRecipe.config.devLoopCount > 1 ? 'pl-5' : ''}`}>
                                                {selectedRecipe.config.developerSteps.map((step, i) => (
                                                    <div key={i} className="flex flex-col p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-amber-900 dark:text-amber-300">{step.name}</div>
                                                            <div className="font-mono font-bold text-amber-800 dark:text-amber-300">
                                                                {formatTime(step.duration)}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">
                                                            {step.dilution} • {step.volume}ml
                                                        </div>
                                                        
                                                        <AgitationInfo config={selectedRecipe.config} step={step} type="dev" />
                                                        
                                                        {(step.overridePourTime || selectedRecipe.config.enablePourTime) && (
                                                            <div className="mt-2 text-xs text-amber-700/70 flex items-center gap-1">
                                                                <Hourglass className="w-3 h-3" />
                                                                {t('timer.phase_wait')}: {step.overridePourTime ? step.pourTime : (selectedRecipe.config.pourTime || 10)}s
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Stop Bath */}
                                        {selectedRecipe.config.enableStopBath && (
                                            <div className="flex flex-col p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="font-bold text-purple-900 dark:text-purple-300">{selectedRecipe.config.stopBathName || 'Stop Bath'}</div>
                                                    <div className="font-mono font-bold text-purple-800 dark:text-purple-300">
                                                        {formatTime(selectedRecipe.config.stopTime)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-purple-700 dark:text-purple-400">
                                                    {selectedRecipe.config.stopBathDilution} • {selectedRecipe.config.stopBathVolume}ml
                                                </div>
                                            </div>
                                        )}

                                        {/* Fixer */}
                                        <div className="flex flex-col p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-800/30">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-bold text-teal-900 dark:text-teal-300">{selectedRecipe.config.fixerName || 'Fixer'}</div>
                                                <div className="font-mono font-bold text-teal-800 dark:text-teal-300">
                                                    {formatTime(selectedRecipe.config.fixTime)}
                                                </div>
                                            </div>
                                            <div className="text-xs text-teal-700 dark:text-teal-400 mb-1">
                                                {selectedRecipe.config.fixerDilution} • {selectedRecipe.config.fixerVolume}ml
                                            </div>
                                            <AgitationInfo config={selectedRecipe.config} type="fix" />
                                        </div>

                                        {/* Wash */}
                                        <div className="flex flex-col p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-bold text-cyan-900 dark:text-cyan-300">{selectedRecipe.config.washName || 'Wash'}</div>
                                                <div className="font-mono font-bold text-cyan-800 dark:text-cyan-300">
                                                    {formatTime(selectedRecipe.config.washTime)}
                                                </div>
                                            </div>
                                            <div className="text-xs text-cyan-700 dark:text-cyan-400">
                                                {selectedRecipe.config.washDilution} • {selectedRecipe.config.washVolume}ml
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('library.notes')}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 italic whitespace-pre-wrap">
                                                {selectedRecipe.notes || "No notes"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">{t('library.overview')}</p>
                            <p className="text-sm">Select a recipe to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <ConfirmModal
            isOpen={confirmModal.isOpen}
            title={t('library.confirm_delete') as string || 'Delete Recipe'}
            message="Are you sure you want to delete this recipe?"
            onConfirm={executeDelete}
            onCancel={() => setConfirmModal({ isOpen: false, id: null })}
            confirmText="Delete"
        />
        </>
    );
};
