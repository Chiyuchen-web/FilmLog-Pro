
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Play, Pause, RotateCcw, Bell, Clock, SkipForward, Save, BookOpen, Check, Plus, FolderOpen, AlertCircle, Coffee, Timer as TimerIcon, Settings, ChevronRight, Sliders, Activity, Minus, Trash2, ChevronUp, ChevronDown, ListFilter, Droplet, PenTool, ArrowRight, Home, Hourglass } from 'lucide-react';
import { TimerConfig, DeveloperStep, DevRecipe } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storageService';
import { TimeWheelPicker } from './ui/TimeWheelPicker';

// --- Types & Constants ---

const COLORS = {
    prewet: '#60A5FA', // Blue-400
    develop: '#F59E0B', // Amber-500
    stop: '#A855F7', // Purple-500
    fix: '#14B8A6', // Teal-500
    wash: '#06B6D4', // Cyan-500
    wait: '#94A3B8', // Slate-400
};

const DEFAULT_CONFIG: TimerConfig = {
  processName: '',
  filmModel: '',
  devMethod: 'Hand',
  devLoopCount: 1,

  globalAgitationEnabled: true,
  globalInitialAgitation: 30,
  globalAgitationDuration: 5,
  globalStandDuration: 55,

  enablePourTime: false,
  pourTime: 10,
  
  skipInitialAgitationOnLoop: false,

  enablePreWet: false,
  preWetName: '预湿剂A',
  preWetDilution: 'None',
  preWetVolume: '500',
  preWetTime: 60,

  developerSteps: [
    { 
      id: '1', 
      name: '显影液A', 
      dilution: '1:19', 
      volume: '500', 
      duration: 390, 
      initialAgitation: 30, 
      agitationDuration: 5, 
      standDuration: 55, 
      overrideGlobalAgitation: false,
      overridePourTime: false,
      pourTime: 10
    }
  ],

  enableStopBath: false,
  stopBathName: '停显剂A',
  stopBathDilution: '1:19',
  stopBathVolume: '500',
  stopTime: 60,

  fixerName: '定影液A',
  fixerDilution: '1:4',
  fixerVolume: '500',
  fixTime: 300,
  fixInitialAgitation: 30,
  fixAgitationDuration: 5,
  fixStandDuration: 55,
  fixOverrideGlobalAgitation: false,

  washName: 'Water',
  washDilution: 'None',
  washVolume: '1000',
  washTime: 600,
  enableWettingAgent: false,
  wettingAgentName: 'Photo-Flo',
  wettingAgentDilution: '1:200',
  wettingAgentVolume: '500'
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Helper Components ---
const ProgressTimeline = ({ phases, currentIndex, timeLeft, totalTime }: { phases: any[], currentIndex: number, timeLeft: number, totalTime: number }) => {
    const elapsedBefore = phases.slice(0, currentIndex).reduce((acc, p) => acc + p.duration, 0);
    const currentPhase = phases[currentIndex];
    const elapsedInCurrent = currentPhase ? Math.max(0, currentPhase.duration - timeLeft) : 0;

    return (
        <div className="w-full bg-gray-100 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
            <div className="h-4 sm:h-6 w-full flex bg-gray-200 dark:bg-gray-800">
                {phases.map((phase, idx) => {
                    const width = (phase.duration / totalTime) * 100;
                    const phaseColor = (COLORS as any)[phase.type] || '#CBD5E1';
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    
                    return (
                        <div 
                            key={idx} 
                            className="h-full relative border-r border-white/20 dark:border-black/20 group/segment"
                            style={{ 
                                width: `${width}%`,
                                backgroundColor: isCompleted ? phaseColor : isCurrent ? `${phaseColor}44` : 'transparent'
                            }}
                            title={`${phase.label} (${formatTime(phase.duration)})`}
                        >
                            {isCurrent && (
                                <div 
                                    className="absolute top-0 left-0 h-full transition-all duration-1000 ease-linear"
                                    style={{ 
                                        width: `${(elapsedInCurrent / phase.duration) * 100}%`,
                                        backgroundColor: phaseColor
                                    }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AgitationEditor = ({ enabled, onToggle, initial, agitate, stand, pourEnabled, onPourToggle, pourTime, onChange, openTimePicker }: any) => {
    const { t } = useLanguage();
    return (
        <div className="mt-4 p-3 bg-white dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500"/>
                <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors flex items-center gap-2">
                    <Sliders className="w-4 h-4" /> {t('timer.separate_setting')}
                </span>
            </label>
            {enabled && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <TimeControl label={t('timer.initial_agitation')} value={initial} max={300} onChange={v => onChange('initial', v)} estimateLabel={formatTime(initial)} themeColor="indigo" onPicker={() => openTimePicker('initial')} />
                        <TimeControl label={t('timer.agitation_duration')} value={agitate} max={300} onChange={v => onChange('agitate', v)} estimateLabel={formatTime(agitate)} themeColor="indigo" onPicker={() => openTimePicker('agitate')} />
                        <TimeControl label={t('timer.stand_duration')} value={stand} max={300} onChange={v => onChange('stand', v)} estimateLabel={formatTime(stand)} themeColor="indigo" onPicker={() => openTimePicker('stand')} />
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                        <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                            <input type="checkbox" checked={pourEnabled} onChange={e => onPourToggle(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"/>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-indigo-500 transition-colors flex items-center gap-2">
                                <Hourglass className="w-3 h-3" /> {t('timer.custom_pour')}
                            </span>
                        </label>
                        {pourEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <TimeControl label={t('timer.wait_time')} value={pourTime} max={120} onChange={v => onChange('pour', v)} estimateLabel={formatTime(pourTime)} themeColor="indigo" onPicker={() => openTimePicker('pour')} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProcessMap = ({ phases, totalTime }: { phases: any[], totalTime: number }) => {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-1.5 overflow-hidden">
            {phases.map((phase, idx) => {
                const phaseColor = (COLORS as any)[phase.type] || '#CBD5E1';
                const flexValue = Math.max(0.08, phase.duration / totalTime);
                return (
                    <div key={idx} className="flex gap-2.5 group overflow-hidden" style={{ flex: flexValue }}>
                        <div className="relative flex flex-col items-center shrink-0 h-full">
                            <div className="w-4 rounded-full transition-all duration-300 group-hover:w-5 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] h-full" style={{ backgroundColor: phaseColor, boxShadow: `0 0 8px ${phaseColor}55` }}/>
                        </div>
                        <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
                            <div className="flex flex-col min-w-0 pr-1">
                                <div className="text-[8px] font-black uppercase tracking-[0.1em] text-gray-400 group-hover:text-indigo-500 transition-colors leading-none mb-0.5">{phase.type}</div>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs font-black text-gray-900 dark:text-white truncate leading-tight">{phase.label}</div>
                                    <div className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 tabular-nums">{formatTime(phase.duration)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TimeControl = ({ label, value, onChange, max = 1800, step = 5, disabled = false, estimateLabel, themeColor = "indigo", onPicker }: any) => {
  const percentage = Math.min(100, (value / max) * 100);
  const colorMap: any = { indigo: 'bg-indigo-600', blue: 'bg-blue-600', amber: 'bg-amber-500', teal: 'bg-teal-500' };
  return (
    <div className={`w-full group relative transition-all duration-200 p-2 rounded-xl ${disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'}`}>
      <div className="flex justify-between items-center mb-3 px-1">
        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest group-focus-within:text-indigo-600 transition-colors leading-none truncate pr-2" title={label}>{label}</label>
        <button 
            type="button" 
            onClick={onPicker}
            className={`px-2 py-0.5 rounded-md font-mono font-black text-sm tracking-tighter ${colorMap[themeColor] || 'bg-indigo-600'} text-white shadow-md shadow-indigo-500/20 border-b-2 border-black/10 tabular-nums active:scale-95 transition-transform`}
        >
            {estimateLabel}
        </button>
      </div>
      <div className="relative h-6 flex items-center px-1">
        <div className="absolute w-[calc(100%-8px)] h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
             <div className={`h-full ${colorMap[themeColor] || 'bg-indigo-600'} transition-all duration-75`} style={{ width: `${percentage}%` }}/>
        </div>
        {/* Disable standard touch actions on range to prevent page scroll while dragging */}
        <input 
            type="range" 
            min="0" 
            max={max} 
            step={step} 
            value={Math.min(value, max)} 
            onChange={(e) => onChange(Number(e.target.value))} 
            disabled={disabled} 
            className="absolute w-full h-full opacity-0 cursor-pointer z-10 touch-action-none" 
            style={{ touchAction: 'none' }}
        />
        <div className="absolute h-4 w-4 bg-white border-2 border-current rounded-full shadow-md pointer-events-none transition-all duration-75 group-focus-within:scale-125 group-hover:scale-110" style={{ left: `calc(${percentage}% - 8px)`, color: themeColor === 'indigo' ? '#4f46e5' : themeColor === 'amber' ? '#f59e0b' : '#0d9488' }}/>
      </div>
    </div>
  );
};

const ChemicalInputs = ({ nameLabel, nameValue, onNameChange, dilutionValue, onDilutionChange, volumeValue, onVolumeChange }: any) => {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Input label={nameLabel} value={nameValue} onChange={e => onNameChange(e.target.value)} placeholder={t('placeholder.developerModel')} />
            <Input label={t('timer.stage_dilution')} value={dilutionValue} onChange={e => onDilutionChange(e.target.value)} placeholder="1:19" />
            <Input label={t('timer.volume_ml')} value={volumeValue} onChange={e => onVolumeChange(e.target.value)} placeholder="500" />
        </div>
    );
};

interface DevTimerProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnHome: () => void;
  initialRecipe?: DevRecipe | null;
  isEditorMode?: boolean;
  onRecipeSave?: () => void;
}

export const DevTimer: React.FC<DevTimerProps> = ({ isOpen, onClose, onReturnHome, initialRecipe, isEditorMode = false, onRecipeSave }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'selection' | 'setup' | 'running' | 'finished'>('selection');
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<DevRecipe[]>([]);
  const [phases, setPhases] = useState<any[]>([]); 
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [agitationState, setAgitationState] = useState<'none' | 'agitate' | 'stand' | 'pre-warn'>('none');
  const [isRecipeSelectorOpen, setIsRecipeSelectorOpen] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Picker State
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ key: string, id?: string, field?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialRecipe) {
          setConfig({ ...initialRecipe.config, processName: initialRecipe.name });
          setEditingId(initialRecipe.id);
          setMode('setup');
      } else if (isEditorMode) {
          setMode('setup');
          setEditingId(null);
          setConfig(DEFAULT_CONFIG);
      } else {
          setMode('selection');
          setEditingId(null);
          setConfig(DEFAULT_CONFIG);
      }
      setIsPaused(true);
      storageService.getRecipes().then(setRecipes);
    }
  }, [isOpen, initialRecipe, isEditorMode]);

  const totalProcessTime = useMemo(() => {
      return phases.reduce((acc, p) => acc + p.duration, 0);
  }, [phases]);

  const totalRemainingTime = useMemo(() => {
    if (mode !== 'running' && mode !== 'finished') return 0;
    const elapsedBefore = phases.slice(0, currentPhaseIndex).reduce((acc, p) => acc + p.duration, 0);
    const currentPhase = phases[currentPhaseIndex];
    const elapsedInCurrent = currentPhase ? Math.max(0, currentPhase.duration - timeLeft) : 0;
    const totalElapsed = elapsedBefore + elapsedInCurrent;
    const totalDuration = phases.reduce((acc, p) => acc + p.duration, 0);
    return Math.max(0, totalDuration - totalElapsed);
  }, [phases, currentPhaseIndex, timeLeft, mode]);

  useEffect(() => {
    const buildPhases = () => {
       const list: any[] = [];
      const getAgitationSettings = (local: {initial: number, agitate: number, stand: number}, override: boolean | undefined) => {
         if (config.globalAgitationEnabled && !override) {
             return { initial: config.globalInitialAgitation ?? 30, duration: config.globalAgitationDuration ?? 5, stand: config.globalStandDuration ?? 55 };
         }
         return { initial: local.initial, duration: local.agitate, stand: local.stand };
      };

      const addWait = (overridePour: boolean | undefined, localPourTime: number | undefined) => {
          const shouldUseLocal = overridePour === true;
          const isEnabled = shouldUseLocal ? true : config.enablePourTime;
          const duration = shouldUseLocal ? (localPourTime || 10) : (config.pourTime || 10);

          if (isEnabled && duration > 0) {
              list.push({ type: 'wait', label: t('timer.phase_wait'), duration: duration });
          }
      }

      if (config.enablePreWet) {
        list.push({ type: 'prewet', label: config.preWetName || t('timer.phase_prewet'), duration: config.preWetTime });
        addWait(undefined, undefined); 
      }

      const loops = Math.max(1, config.devLoopCount);
      for(let i=0; i<loops; i++) {
        config.developerSteps.forEach((step, idx) => {
          let name = step.name || t('timer.phase_develop');
          if (loops > 1 || config.developerSteps.length > 1) {
              const loopInfo = loops > 1 ? `L${i+1}` : '';
              const stepInfo = config.developerSteps.length > 1 ? `S${idx+1}` : '';
              if (loopInfo || stepInfo) name += ` (${loopInfo}${stepInfo})`;
          }
          const agi = getAgitationSettings({ initial: step.initialAgitation, agitate: step.agitationDuration, stand: step.standDuration }, step.overrideGlobalAgitation);
          
          // Logic: Skip initial agitation on loops > 0 if config is set
          let initialAgiDuration = agi.initial;
          if (i > 0 && config.skipInitialAgitationOnLoop) {
              initialAgiDuration = 0;
          }

          list.push({ 
              type: 'develop', 
              label: name, 
              duration: step.duration, 
              initialAgitation: initialAgiDuration, 
              agitationDuration: agi.duration, 
              standDuration: agi.stand 
          });
          
          addWait(step.overridePourTime, step.pourTime);
        });
      }

      if (config.enableStopBath) {
        list.push({ type: 'stop', label: config.stopBathName || t('timer.phase_stop'), duration: config.stopTime });
        addWait(undefined, undefined);
      }
      
      const fixAgi = getAgitationSettings({ initial: config.fixInitialAgitation, agitate: config.fixAgitationDuration, stand: config.fixStandDuration }, config.fixOverrideGlobalAgitation);
      list.push({ 
          type: 'fix', 
          label: config.fixerName || t('timer.phase_fix'), 
          duration: config.fixTime, 
          initialAgitation: fixAgi.initial, 
          agitationDuration: fixAgi.duration, 
          standDuration: fixAgi.stand 
      });
      addWait(undefined, undefined);

      list.push({ type: 'wash', label: config.washName || t('timer.phase_wash'), duration: config.washTime });
      setPhases(list);
    };
    buildPhases();
  }, [config, t]);

  useEffect(() => {
    let interval: any = null;
    if (mode === 'running' && !isPaused && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (mode === 'running' && !isPaused && timeLeft === 0) {
      handlePhaseComplete();
    }
    return () => { if (interval) clearInterval(interval); };
  }, [mode, isPaused, timeLeft]);

  useEffect(() => {
    if (mode !== 'running' || isPaused) { setAgitationState('none'); return; }
    const currentPhase = phases[currentPhaseIndex];
    if (!currentPhase || (currentPhase.type !== 'develop' && currentPhase.type !== 'fix')) { setAgitationState('none'); return; }
    const initial = currentPhase.initialAgitation || 0;
    const agitateTime = currentPhase.agitationDuration || 0;
    const standTime = currentPhase.standDuration || 0;
    const cycleTime = agitateTime + standTime;
    const elapsed = currentPhase.duration - timeLeft;
    let newState: 'none' | 'agitate' | 'stand' | 'pre-warn' = 'stand';
    
    // Logic: Initial Agitation -> Stand -> Agitate loop
    if (elapsed < initial) { 
        newState = 'agitate'; 
    } else if (cycleTime > 0) {
        const timeSinceInitial = elapsed - initial;
        const timeInCycle = timeSinceInitial % cycleTime;
        
        // Stand phase comes FIRST in the cycle after initial agitation
        if (timeInCycle < standTime) {
             // We are in Stand phase
             // Check for pre-warn (e.g. last 3 seconds of standing)
             // Only warn if there is time left in the phase
             if (standTime - timeInCycle <= 3 && timeLeft > 5) {
                 newState = 'pre-warn';
             } else {
                 newState = 'stand';
             }
        } else {
             // We are in Agitate phase
             newState = 'agitate';
        }
    } else { 
        newState = 'stand'; 
    }
    
    if (newState !== agitationState) {
        if (newState === 'agitate') {
            playDualTone('rising'); 
        } else if (newState === 'stand' && agitationState === 'agitate') {
            playDualTone('falling'); 
        } else if (newState === 'pre-warn' && agitationState !== 'pre-warn') {
            playDualTone('warning');
        }
        setAgitationState(newState);
    }

  }, [timeLeft, mode, isPaused, agitationState]);

  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playDualTone = (type: 'rising' | 'falling' | 'warning') => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      
      // Force resume context if suspended (common browser policy fix)
      if (ctx.state === 'suspended') {
          ctx.resume();
      }

      const now = ctx.currentTime;
      
      // Soft, Pure Sine Wave (Bell/Chime-like)
      const playNote = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine'; // Pure Sine Wave, no electronic harmonics
          osc.frequency.setValueAtTime(freq, startTime);
          
          // Bell Envelope: Instant attack, exponential decay
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(1.0, startTime + 0.01); // Sharp attack
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Long, smooth tail
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
      };

      const gap = 0.12; 

      if (type === 'rising') {
          // "Ding-Dong" (A4 -> D5)
          playNote(440, now, 0.8); 
          playNote(587.33, now + gap, 1.0); 
      } else if (type === 'falling') {
          // "Dong-Ding" (D5 -> A4)
          playNote(587.33, now, 0.8); 
          playNote(440, now + gap, 1.0); 
      } else if (type === 'warning') {
          // Soft pulsing C5
          const warnGap = 0.15;
          playNote(523.25, now, 0.3); 
          playNote(523.25, now + warnGap, 0.3);
      }
  };

  const startTimer = () => {
    initAudio();
    if (mode === 'setup' || mode === 'finished') {
        setMode('running');
        setCurrentPhaseIndex(0);
        setTimeLeft(phases[0]?.duration || 0);
    }
    setIsPaused(false);
  };

  const handlePhaseComplete = () => {
    if (currentPhaseIndex < phases.length - 1) {
        const nextIdx = currentPhaseIndex + 1;
        setCurrentPhaseIndex(nextIdx);
        setTimeLeft(phases[nextIdx].duration);
    } else {
        setMode('finished');
        setIsPaused(true);
    }
  };

  const reset = () => { setMode('setup'); setIsPaused(true); setCurrentPhaseIndex(0); };
  const handleManualSetup = () => { setConfig(DEFAULT_CONFIG); setEditingId(null); setMode('setup'); };

  const handleSaveRecipe = async () => {
      if (!config.processName) { alert("Please enter a process name first."); return; }
      
      const newRecipe: DevRecipe = { 
          id: editingId || Date.now().toString(), 
          name: config.processName, 
          createdAt: editingId ? (initialRecipe?.createdAt || Date.now()) : Date.now(), 
          updatedAt: Date.now(), 
          notes: initialRecipe?.notes || '', 
          rating: initialRecipe?.rating || 0, // Preserve rating
          config: config 
      };
      
      await storageService.saveRecipe(newRecipe);
      alert(t('timer.saved_success'));
      const updatedRecipes = await storageService.getRecipes();
      setRecipes(updatedRecipes);
      if (!editingId) setEditingId(newRecipe.id);
      
      // Notify parent to refresh recipe list
      if (onRecipeSave) onRecipeSave();
  };

  const applyRecipe = (recipe: DevRecipe) => {
      setConfig({ ...recipe.config, processName: recipe.name });
      setEditingId(recipe.id); 
      setIsRecipeSelectorOpen(false);
      setMode('setup');
  };

  const addDeveloper = () => {
      const newStep: DeveloperStep = { id: Date.now().toString(), name: `${t('timer.phase_develop')} ${config.developerSteps.length + 1}`, dilution: '1:19', volume: '500', duration: 390, initialAgitation: config.globalInitialAgitation ?? 30, agitationDuration: config.globalAgitationDuration ?? 5, standDuration: config.globalStandDuration ?? 55, overrideGlobalAgitation: false, overridePourTime: false, pourTime: 10 };
      setConfig({...config, developerSteps: [...config.developerSteps, newStep]});
  };

  const removeDeveloper = (id: string) => { if (config.developerSteps.length <= 1) return; setConfig({...config, developerSteps: config.developerSteps.filter(s => s.id !== id)}); };

  const getTimerBgClass = () => {
      if (agitationState === 'agitate') return 'bg-red-600 text-white';
      if (agitationState === 'pre-warn') return 'bg-orange-500 text-white';
      if (phases[currentPhaseIndex]?.type === 'wait') return 'bg-slate-500 text-white';
      return 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white';
  };

  const handleOpenPicker = (key: string, id?: string, field?: string) => {
      setPickerTarget({ key, id, field });
      setIsTimePickerOpen(true);
  };

  const handlePickerSave = (totalSeconds: number) => {
      if (!pickerTarget) return;
      const { key, id, field } = pickerTarget;

      if (key === 'prewet') setConfig({...config, preWetTime: totalSeconds});
      else if (key === 'stop') setConfig({...config, stopTime: totalSeconds});
      else if (key === 'fix') setConfig({...config, fixTime: totalSeconds});
      else if (key === 'wash') setConfig({...config, washTime: totalSeconds});
      else if (key === 'pour') setConfig({...config, pourTime: totalSeconds});
      else if (key === 'global_init') setConfig({...config, globalInitialAgitation: totalSeconds});
      else if (key === 'global_agitate') setConfig({...config, globalAgitationDuration: totalSeconds});
      else if (key === 'global_stand') setConfig({...config, globalStandDuration: totalSeconds});
      else if (key === 'dev_duration' && id) {
          const newSteps = config.developerSteps.map(s => s.id === id ? { ...s, duration: totalSeconds } : s);
          setConfig({...config, developerSteps: newSteps});
      }
      else if (key === 'dev_agitation' && id && field) {
          const newSteps = config.developerSteps.map(s => {
              if (s.id === id) {
                  if (field === 'initial') return { ...s, initialAgitation: totalSeconds };
                  if (field === 'agitate') return { ...s, agitationDuration: totalSeconds };
                  if (field === 'stand') return { ...s, standDuration: totalSeconds };
                  if (field === 'pour') return { ...s, pourTime: totalSeconds };
              }
              return s;
          });
          setConfig({...config, developerSteps: newSteps});
      }
      else if (key === 'fix_agitation' && field) {
          if (field === 'initial') return config.fixInitialAgitation;
          if (field === 'agitate') return config.fixAgitationDuration;
          if (field === 'stand') return config.fixStandDuration;
      }
  };

  const getPickerInitialValue = () => {
      if (!pickerTarget) return 0;
      const { key, id, field } = pickerTarget;
      if (key === 'prewet') return config.preWetTime;
      if (key === 'stop') return config.stopTime;
      if (key === 'fix') return config.fixTime;
      if (key === 'wash') return config.washTime;
      if (key === 'pour') return config.pourTime || 10;
      if (key === 'global_init') return config.globalInitialAgitation ?? 30;
      if (key === 'global_agitate') return config.globalAgitationDuration ?? 5;
      if (key === 'global_stand') return config.globalStandDuration ?? 55;
      if (key === 'dev_duration' && id) return config.developerSteps.find(s => s.id === id)?.duration || 0;
      if (key === 'dev_agitation' && id && field) {
          const s = config.developerSteps.find(s => s.id === id);
          if (s) {
            if (field === 'initial') return s.initialAgitation;
            if (field === 'agitate') return s.agitationDuration;
            if (field === 'stand') return s.standDuration;
            if (field === 'pour') return s.pourTime || 10;
          }
      }
      if (key === 'fix_agitation' && field) {
          if (field === 'initial') return config.fixInitialAgitation;
          if (field === 'agitate') return config.fixAgitationDuration;
          if (field === 'stand') return config.fixStandDuration;
      }
      return 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 flex flex-col font-sans overflow-hidden h-screen-dynamic pt-safe-top">
      
      <TimeWheelPicker 
          isOpen={isTimePickerOpen} 
          onClose={() => setIsTimePickerOpen(false)}
          onSave={handlePickerSave}
          initialSeconds={getPickerInitialValue()}
          stepSeconds={5}
      />

      {/* Dynamic App Bar with Safe Area */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 italic tracking-tighter uppercase shrink-0">
                {isEditorMode ? (
                    <>
                       <PenTool className="w-6 h-6 text-indigo-500" /> {editingId ? t('library.edit_process') : t('library.new_process')}
                    </>
                ) : (
                    <>
                       <Clock className="w-6 h-6 text-indigo-500" /> <span className="hidden sm:inline">{t('timer.title')}</span><span className="sm:hidden">Timer</span>
                    </>
                )}
            </h2>
            
            {(mode === 'running' || mode === 'finished') && (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500 border-l-2 border-gray-200 dark:border-gray-700 pl-4 sm:pl-6 h-8">
                     <span className="text-2xl sm:text-3xl font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums leading-none">
                        {formatTime(Math.ceil(totalRemainingTime))}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-900/40 hidden sm:block">
                             <TimerIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white uppercase truncate max-w-[100px] sm:max-w-[200px] leading-tight">
                             {phases[currentPhaseIndex]?.label || t('timer.finish')}
                        </span>
                    </div>
                </div>
            )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
            <button onClick={onReturnHome} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all" title="Home">
                <Home className="w-6 h-6" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all" title="Close/Back">
                <X className="w-7 h-7" />
            </button>
        </div>
      </div>

      {(mode === 'running' || mode === 'finished') && (
          <ProgressTimeline phases={phases} currentIndex={currentPhaseIndex} timeLeft={timeLeft} totalTime={totalProcessTime} />
      )}

      <div className="flex-1 overflow-hidden flex flex-col relative pb-safe-bottom">
          {mode === 'selection' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button onClick={handleManualSetup} className="group relative flex flex-col items-center justify-center p-6 sm:p-8 md:p-12 bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border-2 border-gray-100 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 hover:-translate-y-2">
                          <div className="mb-4 sm:mb-6 p-4 sm:p-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                              <PenTool className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{t('timer.setup')}</h3>
                          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center font-medium max-w-[200px] sm:max-w-xs">Manually configure every step of your development process from scratch.</p>
                          <div className="mt-6 sm:mt-8 flex items-center font-bold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">Start Setup <ArrowRight className="w-5 h-5 ml-1" /></div>
                      </button>
                      <button onClick={() => setIsRecipeSelectorOpen(true)} className="group relative flex flex-col items-center justify-center p-6 sm:p-8 md:p-12 bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border-2 border-gray-100 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 hover:-translate-y-2">
                          <div className="mb-4 sm:mb-6 p-4 sm:p-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                              <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{t('library.title')}</h3>
                          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center font-medium max-w-[200px] sm:max-w-xs">Load a pre-configured process from your saved recipes collection.</p>
                          <div className="mt-6 sm:mt-8 flex items-center font-bold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">Select Process <ArrowRight className="w-5 h-5 ml-1" /></div>
                      </button>
                  </div>
              </div>
          ) : mode === 'setup' ? (
              <div className="flex flex-col md:flex-row w-full flex-1 overflow-hidden">
                  <div className="hidden md:flex w-80 flex-col bg-gray-50/50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 p-8 h-full overflow-hidden shrink-0">
                      <div className="mb-8 shrink-0">
                          <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em] mb-2">{t('timer.total_time')}</h4>
                          <div className="text-5xl font-mono font-black text-gray-900 dark:text-white tracking-tighter">{formatTime(totalProcessTime)}</div>
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden mb-6">
                          <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em] mb-4 flex items-center gap-2 shrink-0"><Activity className="w-4 h-4 text-indigo-500" /> {t('timer.process_map')}</h4>
                          <ProcessMap phases={phases} totalTime={totalProcessTime} />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 bg-white dark:bg-gray-900">
                      <div className="max-w-2xl mx-auto space-y-8 sm:space-y-12 pb-32">
                          <section>
                              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                                  <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg"><BookOpen className="w-5 h-5" /></div>
                                  <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{t('timer.section_recipe')}</h4>
                              </div>
                              <div className="p-5 sm:p-8 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-6">
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                                      <div className="flex-1">
                                          <Input label={t('timer.process_name')} value={config.processName} onChange={e => setConfig({...config, processName: e.target.value})} placeholder={t('placeholder.process_name')} className="font-bold h-12"/>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button variant="secondary" onClick={handleSaveRecipe} className="h-12 px-4 shadow-sm border-2 whitespace-nowrap bg-white dark:bg-gray-800 flex-1 sm:flex-none"><Save className="w-4 h-4 mr-2 text-indigo-500" /> {t('timer.save_short')}</Button>
                                        {!isEditorMode && <Button variant="secondary" onClick={() => setIsRecipeSelectorOpen(true)} className="h-12 px-4 shadow-sm border-2 whitespace-nowrap bg-white dark:bg-gray-800 flex-1 sm:flex-none"><FolderOpen className="w-4 h-4 mr-2 text-indigo-500" /> {t('timer.select_short')}</Button>}
                                      </div>
                                  </div>
                                  <Input label={t('timer.film_model')} value={config.filmModel} onChange={e => setConfig({...config, filmModel: e.target.value})} placeholder={t('placeholder.filmModel')} className="h-12"/>
                              </div>
                          </section>
                          <section className="bg-indigo-50/40 dark:bg-indigo-900/10 p-5 sm:p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/20">
                              <label className="flex items-center gap-3 mb-6 sm:mb-8 cursor-pointer group">
                                  <input type="checkbox" checked={config.globalAgitationEnabled} onChange={e => setConfig({...config, globalAgitationEnabled: e.target.checked})} className="w-6 h-6 text-indigo-600 rounded-xl focus:ring-indigo-500"/>
                                  <span className="font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest text-xs group-hover:text-indigo-500 transition-colors">{t('timer.global_agitation')}</span>
                              </label>
                              {config.globalAgitationEnabled && (
                                  <div className="space-y-4">
                                      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                                          <TimeControl label={t('timer.initial_agitation')} value={config.globalInitialAgitation ?? 30} max={300} onChange={v => setConfig({...config, globalInitialAgitation: v})} estimateLabel={formatTime(config.globalInitialAgitation ?? 30)} themeColor="indigo" onPicker={() => handleOpenPicker('global_init')} />
                                          <TimeControl label={t('timer.agitation_duration')} value={config.globalAgitationDuration ?? 5} max={300} onChange={v => setConfig({...config, globalAgitationDuration: v})} estimateLabel={formatTime(config.globalAgitationDuration ?? 5)} themeColor="indigo" onPicker={() => handleOpenPicker('global_agitate')} />
                                          <TimeControl label={t('timer.stand_duration')} value={config.globalStandDuration ?? 55} max={300} onChange={v => setConfig({...config, globalStandDuration: v})} estimateLabel={formatTime(config.globalStandDuration ?? 55)} themeColor="indigo" onPicker={() => handleOpenPicker('global_stand')} />
                                      </div>
                                  </div>
                              )}
                              
                              {/* New Skip Option */}
                              {config.devLoopCount > 1 && config.globalAgitationEnabled && (
                                <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800/30">
                                   <label className="flex items-center gap-3 cursor-pointer group">
                                      <input 
                                        type="checkbox" 
                                        checked={config.skipInitialAgitationOnLoop} 
                                        onChange={e => setConfig({...config, skipInitialAgitationOnLoop: e.target.checked})} 
                                        className="w-5 h-5 text-indigo-500 rounded focus:ring-indigo-500"
                                      />
                                      <span className="font-bold text-indigo-700 dark:text-indigo-400 text-xs uppercase tracking-widest group-hover:text-indigo-500 transition-colors">
                                          {t('timer.skip_initial_loop')}
                                      </span>
                                  </label>
                                </div>
                              )}
                              
                              <div className="mt-8 pt-8 border-t border-indigo-100 dark:border-indigo-800/30">
                                   <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                      <input type="checkbox" checked={config.enablePourTime} onChange={e => setConfig({...config, enablePourTime: e.target.checked})} className="w-6 h-6 text-slate-500 rounded-xl focus:ring-slate-500"/>
                                      <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs group-hover:text-slate-500 transition-colors flex items-center gap-2">
                                          <Hourglass className="w-4 h-4" /> {t('timer.enable_wait')}
                                      </span>
                                  </label>
                                  {config.enablePourTime && (
                                      <div className="grid grid-cols-2 gap-4">
                                          <TimeControl label={t('timer.wait_time')} value={config.pourTime ?? 10} max={120} onChange={v => setConfig({...config, pourTime: v})} estimateLabel={formatTime(config.pourTime ?? 10)} themeColor="indigo" onPicker={() => handleOpenPicker('pour')} />
                                      </div>
                                  )}
                              </div>

                          </section>
                          {/* Sections for Prewet, Dev, Stop, Fix, Wash omitted for brevity but logic remains exactly as before */}
                          {/* Ensure all sections are present in final code */}
                          <section className="border-t border-gray-100 dark:border-gray-800 pt-8 sm:pt-12">
                              <label className="flex items-center justify-between mb-6 sm:mb-8 cursor-pointer group">
                                  <div className="flex items-center gap-4"><span className="w-3 h-3 rounded-full bg-blue-400"></span><span className="font-black text-gray-900 dark:text-white tracking-tight uppercase text-lg">{t('timer.phase_prewet')}</span></div>
                                  <input type="checkbox" className="w-7 h-7 text-blue-600 rounded-xl focus:ring-blue-500" checked={config.enablePreWet} onChange={e => setConfig({...config, enablePreWet: e.target.checked})} />
                              </label>
                              {config.enablePreWet && (
                                  <div className="p-5 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-top-4">
                                      <ChemicalInputs nameLabel={t('timer.prewet_agent_name')} nameValue={config.preWetName} onNameChange={v => setConfig({...config, preWetName: v})} dilutionValue={config.preWetDilution} onDilutionChange={v => setConfig({...config, preWetDilution: v})} volumeValue={config.preWetVolume} onVolumeChange={v => setConfig({...config, preWetVolume: v})} />
                                      <TimeControl label={t('timer.duration_label')} value={config.preWetTime} max={600} onChange={val => setConfig({...config, preWetTime: val})} estimateLabel={formatTime(config.preWetTime)} themeColor="blue" onPicker={() => handleOpenPicker('prewet')} />
                                  </div>
                              )}
                          </section>
                          <section className="border-t border-gray-100 dark:border-gray-800 pt-8 sm:pt-12">
                               <div className="flex items-center gap-4 mb-6 sm:mb-8"><span className="w-3 h-3 rounded-full bg-amber-500"></span><h4 className="font-black text-gray-900 dark:text-white tracking-tight uppercase text-lg">{t('timer.section_dev')}</h4></div>
                               <div className="relative pl-0 md:pl-4">
                                    <div className="absolute left-[34px] md:left-[38px] top-12 bottom-12 w-0.5 bg-amber-200 dark:bg-amber-900/40 rounded-full z-0 hidden sm:block"></div>
                                    <div className="relative z-10 mb-8 pl-0">
                                         <div className="inline-flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 pr-5 shadow-sm hover:border-amber-400 dark:hover:border-amber-600 transition-colors w-full sm:w-auto">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shrink-0"><RotateCcw className="w-5 h-5" /></div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">{t('timer.loop_dev_steps')}</span>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setConfig({...config, devLoopCount: Math.max(1, config.devLoopCount - 1)})} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"><ChevronDown className="w-5 h-5" /></button>
                                                    <span className="font-mono font-black text-xl w-6 text-center text-gray-900 dark:text-white">{config.devLoopCount}</span>
                                                    <button onClick={() => setConfig({...config, devLoopCount: Math.min(20, config.devLoopCount + 1)})} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"><ChevronUp className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-10 sm:pl-10 relative z-10">
                                            {config.developerSteps.map((step, idx) => (
                                                <div key={step.id} className="p-5 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative group/step">
                                                    <div className="absolute -top-3 left-8 px-4 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Developer {idx + 1}</div>
                                                    {config.developerSteps.length > 1 && (<button type="button" onClick={() => removeDeveloper(step.id)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>)}
                                                    <ChemicalInputs nameLabel={t('timer.dev_liquid_name')} nameValue={step.name} onNameChange={v => { const newSteps = [...config.developerSteps]; newSteps[idx].name = v; setConfig({...config, developerSteps: newSteps}); }} dilutionValue={step.dilution} onDilutionChange={v => { const newSteps = [...config.developerSteps]; newSteps[idx].dilution = v; setConfig({...config, developerSteps: newSteps}); }} volumeValue={step.volume} onVolumeChange={v => { const newSteps = [...config.developerSteps]; newSteps[idx].volume = v; setConfig({...config, developerSteps: newSteps}); }} />
                                                    <TimeControl label={t('timer.duration_label')} value={step.duration} onChange={val => { const newSteps = [...config.developerSteps]; newSteps[idx].duration = val; setConfig({...config, developerSteps: newSteps}); }} estimateLabel={formatTime(step.duration)} themeColor="amber" onPicker={() => handleOpenPicker('dev_duration', step.id)} />
                                                    
                                                    {/* Updated Agitation Editor with Pour settings */}
                                                    <AgitationEditor 
                                                        enabled={!!step.overrideGlobalAgitation} 
                                                        onToggle={v => { const newSteps = [...config.developerSteps]; newSteps[idx].overrideGlobalAgitation = v; setConfig({...config, developerSteps: newSteps}); }} 
                                                        initial={step.initialAgitation} 
                                                        agitate={step.agitationDuration} 
                                                        stand={step.standDuration} 
                                                        pourEnabled={!!step.overridePourTime}
                                                        onPourToggle={v => { const newSteps = [...config.developerSteps]; newSteps[idx].overridePourTime = v; setConfig({...config, developerSteps: newSteps}); }}
                                                        pourTime={step.pourTime || 10}
                                                        onChange={(f: string, v: number) => { 
                                                            const newSteps = [...config.developerSteps]; 
                                                            if (f === 'initial') newSteps[idx].initialAgitation = v; 
                                                            if (f === 'agitate') newSteps[idx].agitationDuration = v; 
                                                            if (f === 'stand') newSteps[idx].standDuration = v; 
                                                            if (f === 'pour') newSteps[idx].pourTime = v;
                                                            setConfig({...config, developerSteps: newSteps}); 
                                                        }} 
                                                        openTimePicker={(f: string) => handleOpenPicker('dev_agitation', step.id, f)} 
                                                    />
                                                </div>
                                            ))}
                                            <Button variant="secondary" onClick={addDeveloper} className="w-full h-16 rounded-2xl border-dashed border-2 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"><Plus className="w-6 h-6 mr-2 text-amber-500 group-hover:scale-110 transition-transform" /><span className="font-black uppercase tracking-widest text-[10px]">{t('timer.add_developer')}</span></Button>
                                    </div>
                               </div>
                               <div className="mt-12">
                                  <label className="flex items-center justify-between mb-6 sm:mb-8 cursor-pointer group">
                                      <div className="flex items-center gap-4"><span className="w-3 h-3 rounded-full bg-purple-500"></span><span className="font-black text-gray-900 dark:text-white tracking-tight uppercase text-lg">{t('timer.phase_stop')}</span></div>
                                      <input type="checkbox" className="w-7 h-7 text-purple-600 rounded-xl focus:ring-purple-500" checked={config.enableStopBath} onChange={e => setConfig({...config, enableStopBath: e.target.checked})} />
                                  </label>
                                  {config.enableStopBath && (
                                      <div className="p-5 sm:p-8 bg-purple-50/30 dark:bg-purple-900/10 rounded-[2.5rem] border border-purple-100 dark:border-purple-800/20 shadow-sm animate-in fade-in slide-in-from-top-4">
                                          <ChemicalInputs nameLabel={t('timer.stop_agent')} nameValue={config.stopBathName} onNameChange={v => setConfig({...config, stopBathName: v})} dilutionValue={config.stopBathDilution} onDilutionChange={v => setConfig({...config, stopBathDilution: v})} volumeValue={config.stopBathVolume} onVolumeChange={v => setConfig({...config, stopBathVolume: v})} />
                                          <TimeControl label={t('timer.duration_label')} value={config.stopTime} max={300} onChange={val => setConfig({...config, stopTime: val})} estimateLabel={formatTime(config.stopTime)} onPicker={() => handleOpenPicker('stop')} />
                                      </div>
                                  )}
                              </div>
                          </section>
                          <section className="border-t border-gray-100 dark:border-gray-800 pt-8 sm:pt-12">
                               <div className="flex items-center gap-4 mb-6 sm:mb-8"><span className="w-3 h-3 rounded-full bg-teal-500"></span><h4 className="font-black text-gray-900 dark:text-white tracking-tight uppercase text-lg">{t('timer.section_fix')}</h4></div>
                               <div className="p-5 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                                   <ChemicalInputs nameLabel={t('timer.fix_liquid_name')} nameValue={config.fixerName} onNameChange={v => setConfig({...config, fixerName: v})} dilutionValue={config.fixerDilution} onDilutionChange={v => setConfig({...config, fixerDilution: v})} volumeValue={config.fixerVolume} onVolumeChange={v => setConfig({...config, fixerVolume: v})} />
                                   <TimeControl label={t('timer.duration_label')} value={config.fixTime} max={1200} onChange={val => setConfig({...config, fixTime: val})} estimateLabel={formatTime(config.fixTime)} themeColor="teal" onPicker={() => handleOpenPicker('fix')} />
                                   <AgitationEditor enabled={!!config.fixOverrideGlobalAgitation} onToggle={v => setConfig({...config, fixOverrideGlobalAgitation: v})} initial={config.fixInitialAgitation} agitate={config.fixAgitationDuration} stand={config.fixStandDuration} onChange={(f: string, v: number) => { if (f === 'initial') setConfig({...config, fixInitialAgitation: v}); if (f === 'agitate') setConfig({...config, fixAgitationDuration: v}); if (f === 'stand') setConfig({...config, fixStandDuration: v}); }} openTimePicker={(f: string) => handleOpenPicker('fix_agitation', undefined, f)} />
                               </div>
                          </section>
                           <section className="border-t border-gray-100 dark:border-gray-800 pt-8 sm:pt-12 pb-24">
                               <div className="flex items-center gap-4 mb-6 sm:mb-8"><span className="w-3 h-3 rounded-full bg-cyan-500"></span><h4 className="font-black text-gray-900 dark:text-white tracking-tight uppercase text-lg">{t('timer.section_wash')}</h4></div>
                               <div className="p-5 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                                   <ChemicalInputs nameLabel={t('timer.agent_name')} nameValue={config.washName} onNameChange={v => setConfig({...config, washName: v})} dilutionValue={config.washDilution} onDilutionChange={v => setConfig({...config, washDilution: v})} volumeValue={config.washVolume} onVolumeChange={v => setConfig({...config, washVolume: v})} />
                                   <TimeControl label={t('timer.duration_label')} value={config.washTime} onChange={val => setConfig({...config, washTime: val})} estimateLabel={formatTime(config.washTime)} themeColor="blue" onPicker={() => handleOpenPicker('wash')} />
                               </div>
                           </section>
                      </div>
                  </div>
              </div>
          ) : mode === 'finished' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-950">
                  <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-3xl flex items-center justify-center mb-8 shadow-xl"><Check className="w-12 h-12" /></div>
                  <h2 className="text-4xl font-black mb-4 text-gray-900 dark:text-white tracking-tighter uppercase">{t('timer.finished_msg')}</h2>
                  <Button size="lg" onClick={reset} className="mt-12 px-12 h-16 rounded-3xl text-xl font-black shadow-lg uppercase tracking-widest">{t('timer.close')}</Button>
              </div>
          ) : (
              <div className={`flex-1 flex flex-col items-center justify-center p-6 sm:p-12 transition-colors duration-500 ${getTimerBgClass()}`}>
                  <div className="text-center w-full max-w-lg">
                      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 mb-4 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                          <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight leading-none text-center px-2">{phases[currentPhaseIndex]?.label}</span>
                          {phases[currentPhaseIndex + 1] && (<div className="flex items-center gap-2 opacity-60"><ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 hidden md:block" /><ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 md:hidden" /><span className="text-lg sm:text-xl md:text-2xl font-bold uppercase tracking-tight leading-none">{phases[currentPhaseIndex + 1].label}</span></div>)}
                      </div>
                      <div className={`text-7xl sm:text-9xl md:text-[12rem] font-mono font-black tracking-tighter mb-8 tabular-nums leading-none cursor-pointer ${agitationState !== 'none' && agitationState !== 'stand' ? 'text-white' : 'text-gray-900 dark:text-white'}`}
                        // Allow clicking timer to edit if needed, or simple pause
                        onClick={() => setIsPaused(!isPaused)}
                      >{formatTime(timeLeft)}</div>
                      <div className="h-24 flex flex-col items-center justify-center">
                         {agitationState === 'agitate' && (<div className="flex flex-col items-center animate-bounce"><div className="flex items-center gap-2 sm:gap-4 text-3xl sm:text-5xl font-black text-white italic"><Bell className="w-8 h-8 sm:w-12 sm:h-12 fill-current" /> {t('timer.alert_agitate')}</div></div>)}
                         {agitationState === 'stand' && (<div className="flex items-center gap-2 sm:gap-4 text-2xl sm:text-3xl font-black text-gray-400 dark:text-gray-500"><Coffee className="w-8 h-8 sm:w-10 sm:h-10" /> {t('timer.alert_stand')}</div>)}
                         {agitationState === 'pre-warn' && (<div className="flex flex-col items-center animate-pulse"><div className="flex items-center gap-2 sm:gap-4 text-2xl sm:text-4xl font-black text-white"><Activity className="w-8 h-8 sm:w-10 sm:h-10" /> {t('timer.alert_pre_agitate')}</div></div>)}
                         {phases[currentPhaseIndex]?.type === 'wait' && (<div className="flex items-center gap-2 sm:gap-4 text-2xl sm:text-3xl font-black text-white"><Hourglass className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" /> {t('timer.phase_wait')} </div>)}
                      </div>
                  </div>
              </div>
          )}

          {((mode === 'setup' && !isEditorMode) || mode === 'running') && (
            <div className={`absolute bottom-8 z-40 transition-all duration-300 left-1/2 -translate-x-1/2 ${mode === 'setup' ? 'md:left-[calc(50%+10rem)]' : ''} mb-safe-bottom`}>
                {mode === 'setup' ? (
                    <button onClick={startTimer} className="flex items-center justify-center w-20 h-20 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all group" title={t('timer.start')}>
                        <Play className="w-8 h-8 fill-current ml-1 group-hover:scale-110 transition-transform" />
                    </button>
                ) : (
                    <div className="flex items-center gap-2 p-2 pl-3 pr-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full">
                         <Button variant="ghost" size="sm" onClick={reset} className="rounded-full w-12 h-12 p-0 text-gray-400 hover:text-gray-900 dark:hover:text-white"><RotateCcw className="w-5 h-5"/></Button>
                         <Button onClick={() => setIsPaused(!isPaused)} className="rounded-full w-16 h-16 p-0 flex items-center justify-center shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 transition-transform">
                            {isPaused ? <Play className="w-8 h-8 fill-current ml-1"/> : <Pause className="w-8 h-8 fill-current"/>}
                         </Button>
                         <Button variant="ghost" size="sm" onClick={handlePhaseComplete} className="rounded-full w-12 h-12 p-0 text-gray-400 hover:text-gray-900 dark:hover:text-white"><SkipForward className="w-5 h-5"/></Button>
                    </div>
                )}
            </div>
          )}
      </div>

      {isRecipeSelectorOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[80vh] mt-safe-top mb-safe-bottom">
                  <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-950/50">
                      <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3 italic"><ListFilter className="w-5 h-5 text-indigo-500" /> {t('timer.select_modal_title')}</h3>
                      <button onClick={() => setIsRecipeSelectorOpen(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {recipes.length === 0 ? (<div className="text-center py-12 text-gray-400 italic">{t('library.empty')}</div>) : (
                          recipes.map(recipe => (
                              <button key={recipe.id} onClick={() => applyRecipe(recipe)} className="w-full text-left p-6 rounded-3xl border-2 border-gray-100 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group flex items-center justify-between">
                                  <div className="min-w-0 flex-1 pr-4">
                                      <div className="font-black text-gray-900 dark:text-white text-lg truncate mb-1 uppercase tracking-tight italic">{recipe.name}</div>
                                      <div className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                          <Droplet className="w-3 h-3" /> {recipe.config.developerSteps[0]?.name || '--'}
                                      </div>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                          {recipe.config.filmModel && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 border border-gray-200 dark:border-gray-600 truncate max-w-[150px]">{recipe.config.filmModel}</span>}
                                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 border border-gray-200 dark:border-gray-600">{t(`enum.${recipe.config.devMethod}`)}</span>
                                          {recipe.config.devLoopCount > 1 && <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-500 border border-amber-100 dark:border-amber-800/30">{recipe.config.devLoopCount}x Loops</span>}
                                      </div>
                                  </div>
                                  <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                              </button>
                          ))
                      )}
                  </div>
                  <div className="p-6 bg-gray-50 dark:bg-gray-950 flex justify-end">
                      <Button variant="secondary" onClick={() => setIsRecipeSelectorOpen(false)} className="rounded-2xl px-6 font-bold uppercase tracking-widest text-xs">{t('app.cancel')}</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
