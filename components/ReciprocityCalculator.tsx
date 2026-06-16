import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calculator, ArrowRight, Info, Table, Plus, Trash2, Save, FolderOpen, Check, FunctionSquare, LayoutGrid, ArrowLeft, Timer, Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import { ReciprocityProfile, ReciprocityDataPoint, ReciprocityStrategy } from '../types';
import { TimeWheelPicker } from './ui/TimeWheelPicker';
import { ConfirmModal } from './ConfirmModal';

interface ReciprocityCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS: ReciprocityProfile[] = [
    {
        id: 'preset_foma200',
        name: 'Fomapan 200 Creative (精准版)',
        strategy: 'polynomial',
        pFactor: '1.3', 
        polyA: '1.073',
        polyB: '1.582',
        polyC: '-0.041',
        threshold: '1',
        dataPoints: [],
        updatedAt: 0
    },
    {
        id: 'preset_retro320',
        name: 'Retropan 320 Soft (精准版)',
        strategy: 'polynomial',
        pFactor: '1.3',
        polyA: '0.429',
        polyB: '1.826',
        polyC: '-0.101',
        threshold: '1',
        dataPoints: [],
        updatedAt: 0
    }
];

const formatMeasuredDisplay = (sec: number) => {
  if (isNaN(sec) || sec < 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  
  if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimerCountdown = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const ReciprocityCalculator: React.FC<ReciprocityCalculatorProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'time' | 'factor'>('time');
  const [viewState, setViewState] = useState<'calc' | 'profiles' | 'timer'>('calc');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  
  // Strategy State
  const [calcStrategy, setCalcStrategy] = useState<ReciprocityStrategy>('power');

  // Data State
  const [measuredTime, setMeasuredTime] = useState<string>('');
  
  // ND Filter State
  const [ndValue, setNdValue] = useState<string>('0');
  const [ndMode, setNdMode] = useState<'factor' | 'stops'>('stops');
  
  // Power Law Params
  const [factor, setFactor] = useState<string>('1.3');
  
  // Polynomial Params
  const [polyA, setPolyA] = useState<string>('');
  const [polyB, setPolyB] = useState<string>('');
  const [polyC, setPolyC] = useState<string>('');

  const [result, setResult] = useState<string>('--');
  const [threshold, setThreshold] = useState<string>('1');
  const [rows, setRows] = useState<ReciprocityDataPoint[]>([
    { id: '1', measured: '', actual: '' },
    { id: '2', measured: '', actual: '' },
    { id: '3', measured: '', actual: '' },
  ]);
  const [avgP, setAvgP] = useState<string>('--');
  
  // Profile Management State
  const [profiles, setProfiles] = useState<ReciprocityProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [isSaveMode, setIsSaveMode] = useState(false);

  // Timer State
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    id: string | null;
  }>({ isOpen: false, id: null });
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    } else {
        // Reset state on close
        setViewState('calc');
        setTimerActive(false);
    }
  }, [isOpen]);

  // Audio Logic (Mirrored from DevTimer)
  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playDualTone = (type: 'rising' | 'falling' | 'warning') => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const playNote = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(1.0, startTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
      };

      const gap = 0.12; 
      if (type === 'rising') {
          playNote(440, now, 0.8); 
          playNote(587.33, now + gap, 1.0); 
      }
  };

  // Timer Effect
  useEffect(() => {
      let interval: any = null;
      if (viewState === 'timer' && timerActive && timerLeft > 0) {
          interval = setInterval(() => {
              setTimerLeft(prev => {
                  const next = prev - 1;
                  if (next === 0) {
                      playDualTone('rising');
                      setTimerActive(false);
                  }
                  return next;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [viewState, timerActive, timerLeft]);

  const loadProfiles = async () => {
    const saved = await storageService.getReciprocityProfiles();
    setProfiles([...PRESETS, ...saved]);
  };

  // Derived Multiplier
  const ndMultiplier = useMemo(() => {
    const val = parseFloat(ndValue);
    if (isNaN(val)) return 1;
    if (ndMode === 'factor') return Math.max(1, val);
    return Math.pow(2, val);
  }, [ndValue, ndMode]);

  // Effect: Calculate Time
  useEffect(() => {
    if (mode !== 'time') return;
    const mTimeVal = parseFloat(measuredTime);
    
    if (isNaN(mTimeVal) || mTimeVal <= 0) {
      setResult('--');
      return;
    }

    // Calculation Step 1: Measured Time * ND Multiplier
    const tVal = mTimeVal * ndMultiplier;
    
    // Calculation Step 2: Reciprocity Threshold check
    const threshVal = parseFloat(threshold);
    if (!isNaN(threshVal) && tVal <= threshVal) {
        setResult(tVal.toFixed(2) + 's');
        return;
    }

    // Calculation Step 3: Apply Reciprocity failure formula
    if (calcStrategy === 'power') {
        const pVal = parseFloat(factor);
        if (!isNaN(pVal)) {
            const calculated = Math.pow(tVal, pVal);
            setResult(calculated.toFixed(2) + 's');
        } else {
            setResult('--');
        }
    } else {
        const a = parseFloat(polyA);
        const b = parseFloat(polyB);
        const c = parseFloat(polyC);
        if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
            const lnT = Math.log(tVal);
            const exponent = a + (b * lnT) + (c * Math.pow(lnT, 2));
            const calculated = Math.exp(exponent);
            setResult(calculated.toFixed(2) + 's');
        } else {
            setResult('--');
        }
    }
  }, [measuredTime, ndMultiplier, factor, polyA, polyB, polyC, mode, calcStrategy, threshold]);

  // Effect: Calculate P Factor
  useEffect(() => {
    if (mode !== 'factor') return;
    
    let totalP = 0;
    let validCount = 0;

    rows.forEach(row => {
        const m = parseFloat(row.measured);
        const a = parseFloat(row.actual);
        
        if (!isNaN(m) && !isNaN(a) && m > 1 && a > m) {
            const p = Math.log(a) / Math.log(m);
            totalP += p;
            validCount++;
        }
    });

    if (validCount > 0) {
        const avg = (totalP / validCount).toFixed(3);
        setAvgP(avg);
        if (calcStrategy === 'power') {
            setFactor(avg);
        }
    } else {
        setAvgP('--');
    }

  }, [rows, mode, calcStrategy]);

  const handleRowChange = (id: string, field: 'measured' | 'actual', value: string) => {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
      setRows(prev => [...prev, { id: Date.now().toString(), measured: '', actual: '' }]);
  };

  const removeRow = (id: string) => {
      if (rows.length <= 1) return;
      setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveProfile = async () => {
      if (!saveName.trim()) {
          alert("Please enter a profile name");
          return;
      }
      let pToSave = factor;
      if (avgP !== '--' && !isNaN(parseFloat(avgP))) {
          pToSave = avgP;
      }

      const profile: ReciprocityProfile = {
          id: currentProfileId || Date.now().toString(),
          name: saveName,
          strategy: calcStrategy,
          pFactor: pToSave,
          polyA: polyA,
          polyB: polyB,
          polyC: polyC,
          threshold: threshold,
          dataPoints: rows,
          updatedAt: Date.now()
      };

      await storageService.saveReciprocityProfile(profile);
      await loadProfiles();
      
      setCurrentProfileId(profile.id);
      setIsSaveMode(false);
      showToast(t('calc.saved_success'));
  };

  const handleLoadProfile = (profile: ReciprocityProfile) => {
      setSaveName(profile.name);
      setCalcStrategy(profile.strategy || 'power');
      setFactor(profile.pFactor);
      setPolyA(profile.polyA || '');
      setPolyB(profile.polyB || '');
      setPolyC(profile.polyC || '');
      setThreshold(profile.threshold);
      
      if (profile.dataPoints && profile.dataPoints.length > 0) {
          setRows(profile.dataPoints);
      } else {
          setRows([
            { id: '1', measured: '', actual: '' },
            { id: '2', measured: '', actual: '' },
            { id: '3', measured: '', actual: '' },
          ]);
      }
      
      if (profile.id.startsWith('preset_')) {
          setCurrentProfileId(null);
      } else {
          setCurrentProfileId(profile.id);
      }
      setViewState('calc');
  };

  const handleDeleteProfile = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (id.startsWith('preset_')) return;
      setConfirmModal({ isOpen: true, id });
  }

  const executeDeleteProfile = async () => {
      if (!confirmModal.id) return;
      const id = confirmModal.id;
      setConfirmModal({ isOpen: false, id: null });
      
      await storageService.deleteReciprocityProfile(id);
      await loadProfiles();
      if (currentProfileId === id) {
          setCurrentProfileId(null);
          setSaveName('');
      }
  }

  const handleStartTimer = () => {
      const seconds = parseFloat(result);
      if (isNaN(seconds) || seconds <= 0) return;
      
      initAudio();
      setTimerTotal(Math.ceil(seconds));
      setTimerLeft(Math.ceil(seconds));
      setTimerActive(true);
      setViewState('timer');
  };

  const handleTimerReset = () => {
      setTimerLeft(timerTotal);
      setTimerActive(false);
  };

  const formattedMeasuredInput = useMemo(() => {
     const val = parseFloat(measuredTime);
     if (isNaN(val) || val < 0) return null;
     return formatMeasuredDisplay(val);
  }, [measuredTime]);

  const handleTimePickerSave = (total: number) => {
      setMeasuredTime(total.toString());
  };

  const quickNdSet = (val: string, mode: 'factor' | 'stops') => {
    setNdValue(val);
    setNdMode(mode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-500" /> {t('calc.title')}
          </h3>
          <div className="flex items-center gap-2">
             {viewState === 'calc' && (
                 <button onClick={() => setViewState('profiles')} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title={t('calc.manage_profiles')}>
                     <FolderOpen className="w-5 h-5" />
                 </button>
             )}
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {viewState === 'timer' ? (
            <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-8 bg-gray-50 dark:bg-gray-900/50">
                <div className="w-full text-center">
                    <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Exposure Timer</div>
                    <div className={`text-7xl sm:text-9xl font-mono font-black tabular-nums tracking-tighter leading-none ${timerLeft === 0 ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                        {formatTimerCountdown(timerLeft)}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-400 mt-2 font-mono">
                        {timerLeft}s
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <Button 
                        variant="secondary" 
                        className="rounded-full w-14 h-14 p-0 flex items-center justify-center" 
                        onClick={handleTimerReset}
                    >
                        <RotateCcw className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                    </Button>
                    <Button 
                        className="rounded-full w-20 h-20 p-0 flex items-center justify-center shadow-xl shadow-indigo-500/20" 
                        onClick={() => setTimerActive(!timerActive)}
                    >
                        {timerActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </Button>
                </div>

                <Button variant="ghost" size="sm" onClick={() => { setTimerActive(false); setViewState('calc'); }}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
            </div>
        ) : viewState === 'profiles' ? (
            <div className="p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white">{t('calc.manage_profiles')}</h4>
                    <Button size="sm" variant="secondary" onClick={() => setViewState('calc')}>
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back to Calc
                    </Button>
                </div>
                {profiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        {t('calc.no_profiles')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {profiles.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => handleLoadProfile(p)}
                                className="cursor-pointer group flex items-center justify-between p-4 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all"
                            >
                                <div>
                                    <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                        {p.name}
                                        {p.strategy === 'polynomial' ? <FunctionSquare className="w-3.5 h-3.5 text-indigo-500" /> : <LayoutGrid className="w-3.5 h-3.5 text-gray-400" />}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 font-mono">
                                        {p.strategy === 'polynomial' 
                                            ? `Poly (a=${p.polyA}...) | Thresh: ${p.threshold}s`
                                            : `P: ${p.pFactor} | Thresh: ${p.threshold}s`
                                        }
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!p.id.startsWith('preset_') && (
                                        <button onClick={(e) => handleDeleteProfile(e, p.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <Check className={`w-5 h-5 text-indigo-600 transition-opacity ${p.id === currentProfileId ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ) : (
            <>
                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <button 
                        onClick={() => setMode('time')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'time' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <ArrowRight className="w-4 h-4" /> {t('calc.tab_time')}
                    </button>
                    <button 
                        onClick={() => setMode('factor')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'factor' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <Table className="w-4 h-4" /> {t('calc.tab_p')}
                    </button>
                </div>

                <div className="p-6 overflow-y-auto relative">
                
                <TimeWheelPicker 
                    isOpen={isTimePickerOpen} 
                    onClose={() => setIsTimePickerOpen(false)} 
                    onSave={handleTimePickerSave}
                    initialSeconds={parseFloat(measuredTime) || 10}
                    title={t('calc.measured')}
                />

                {mode === 'time' ? (
                    <div className="space-y-6">
                        {/* Measured Time Input */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('calc.measured')}</label>
                                    {formattedMeasuredInput && (
                                        <button 
                                                onClick={() => setIsTimePickerOpen(true)}
                                                className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            {formattedMeasuredInput}
                                        </button>
                                    )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="number"
                                        value={measuredTime}
                                        onChange={(e) => setMeasuredTime(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="font-mono text-lg"
                                        autoFocus
                                    />
                                    <button 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onClick={() => setIsTimePickerOpen(true)}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('calc.nd_filter')}</label>
                                    <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
                                        <button 
                                            onClick={() => setNdMode('stops')}
                                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${ndMode === 'stops' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500'}`}
                                        >
                                            档位
                                        </button>
                                        <button 
                                            onClick={() => setNdMode('factor')}
                                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${ndMode === 'factor' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500'}`}
                                        >
                                            倍率
                                        </button>
                                    </div>
                                </div>
                                <Input 
                                    type="number"
                                    value={ndValue}
                                    onChange={(e) => setNdValue(e.target.value)}
                                    placeholder={ndMode === 'factor' ? "1" : "0"}
                                    className="font-mono text-lg"
                                />
                            </div>
                        </div>

                        {/* ND Quick Presets */}
                        <div className="flex flex-wrap gap-2">
                             <button onClick={() => quickNdSet('0', 'stops')} className="text-[10px] font-bold px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded hover:border-indigo-400 transition-colors">None</button>
                             <button onClick={() => quickNdSet('3', 'stops')} className="text-[10px] font-bold px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded hover:border-indigo-400 transition-colors">ND8 (+3)</button>
                             <button onClick={() => quickNdSet('6', 'stops')} className="text-[10px] font-bold px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded hover:border-indigo-400 transition-colors">ND64 (+6)</button>
                             <button onClick={() => quickNdSet('1000', 'factor')} className="text-[10px] font-bold px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded hover:border-indigo-400 transition-colors">ND1000</button>
                        </div>

                        {/* ND Filtered Result (Intermediate) */}
                        {ndMultiplier > 1 && !isNaN(parseFloat(measuredTime)) && (
                            <div className="flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span>{t('calc.nd_label')}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 font-normal">{ndMode === 'stops' ? `(2^${ndValue} ≈ ${ndMultiplier.toFixed(0)}x)` : ''}</span>
                                    <span className="font-mono">{(parseFloat(measuredTime) * ndMultiplier).toFixed(2)}s</span>
                                </div>
                            </div>
                        )}

                        {/* Strategy Switcher */}
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <button 
                                onClick={() => setCalcStrategy('power')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${calcStrategy === 'power' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                {t('calc.mode_standard')}
                            </button>
                            <button 
                                onClick={() => setCalcStrategy('polynomial')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${calcStrategy === 'polynomial' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                {t('calc.mode_advanced')}
                            </button>
                        </div>
                        
                        {/* Parameters based on Strategy */}
                        {calcStrategy === 'power' ? (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('calc.factor')}</label>
                                    <div className="group relative">
                                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-black/80 text-white text-xs p-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                                            {t('calc.factor_hint')}
                                        </div>
                                    </div>
                                </div>
                                <Input 
                                    type="number"
                                    step="0.01"
                                    value={factor}
                                    onChange={(e) => setFactor(e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                <Input 
                                    label={t('calc.coeff_a')} 
                                    value={polyA} 
                                    onChange={e => setPolyA(e.target.value)} 
                                    className="font-mono" 
                                    placeholder="a"
                                    type="number"
                                />
                                <Input 
                                    label={t('calc.coeff_b')} 
                                    value={polyB} 
                                    onChange={e => setPolyB(e.target.value)} 
                                    className="font-mono" 
                                    placeholder="b"
                                    type="number"
                                />
                                <Input 
                                    label={t('calc.coeff_c')} 
                                    value={polyC} 
                                    onChange={e => setPolyC(e.target.value)} 
                                    className="font-mono" 
                                    placeholder="c"
                                    type="number"
                                />
                            </div>
                        )}

                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                            <div className="text-xs text-indigo-600 dark:text-indigo-300 font-medium mb-1 uppercase tracking-wider">{t('calc.formula')}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-4 break-words whitespace-normal">
                                {calcStrategy === 'power' ? t('calc.formula_desc') : t('calc.formula_poly_desc')}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-2 gap-2">
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300 pb-1">{t('calc.result')}</span>
                                <div className="text-right flex flex-col items-end">
                                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight block leading-none break-all">{result}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">{t('calc.threshold_label')}</label>
                                <span className="text-[10px] text-gray-400">{t('calc.threshold_hint')}</span>
                            </div>
                            <Input 
                                type="number" 
                                value={threshold} 
                                onChange={e => setThreshold(e.target.value)} 
                                className="h-8 font-mono text-sm"
                                placeholder="1"
                            />
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2 w-1/3">{t('calc.table_header_measured')}</th>
                                        <th className="px-3 py-2 w-1/3">{t('calc.table_header_actual')}</th>
                                        <th className="px-3 py-2 text-center">{t('calc.table_header_p')}</th>
                                        <th className="px-1 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-800">
                                    {rows.map((row, idx) => {
                                        const m = parseFloat(row.measured);
                                        const a = parseFloat(row.actual);
                                        let rowP = '--';
                                        if (!isNaN(m) && !isNaN(a) && m > 1 && a > 0) {
                                            rowP = (Math.log(a) / Math.log(m)).toFixed(2);
                                        }

                                        return (
                                            <tr key={row.id} className="group">
                                                <td className="px-2 py-2">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 font-mono text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        value={row.measured}
                                                        onChange={e => handleRowChange(row.id, 'measured', e.target.value)}
                                                        placeholder="> 1"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 font-mono text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        value={row.actual}
                                                        onChange={e => handleRowChange(row.id, 'actual', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                    {rowP}
                                                </td>
                                                <td className="px-1 py-2 text-center">
                                                    {rows.length > 1 && (
                                                        <button onClick={() => removeRow(row.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="bg-gray-50 dark:bg-gray-900 p-2 border-t border-gray-200 dark:border-gray-700">
                                <button onClick={addRow} className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors">
                                    <Plus className="w-3 h-3" /> {t('calc.add_row')}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">{t('calc.avg_p')}</div>
                                        <div className="font-mono text-xs opacity-80">{t('calc.formula_p_desc')}</div>
                                    </div>
                                    <div className="text-4xl font-black tracking-tighter">{avgP}</div>
                                </div>
                                {avgP === '--' && (
                                    <div className="mt-2 text-[10px] text-indigo-200 bg-indigo-700/50 px-2 py-1 rounded inline-block">
                                        {t('calc.insufficient_data')}
                                    </div>
                                )}
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {isSaveMode ? (
                        <div className="flex items-center gap-2">
                            <Input 
                                value={saveName} 
                                onChange={e => setSaveName(e.target.value)} 
                                placeholder={t('calc.profile_name')}
                                className="h-10 text-sm"
                                autoFocus
                            />
                            <Button size="sm" onClick={handleSaveProfile} className="shrink-0 h-10 px-4">
                                <Save className="w-4 h-4 mr-1" /> {t('settings.save')}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setIsSaveMode(false)} className="shrink-0 h-10">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => { setIsSaveMode(true); setSaveName(currentProfileId ? profiles.find(p => p.id === currentProfileId)?.name || '' : ''); }}>
                                <Save className="w-4 h-4 mr-2" /> {t('calc.save_profile')}
                            </Button>
                            {mode === 'time' && (
                                <Button 
                                    variant="primary" 
                                    className="flex-1 shadow-lg shadow-indigo-500/20" 
                                    onClick={handleStartTimer} 
                                    disabled={result === '--' || parseFloat(result) <= 0}
                                >
                                    <Timer className="w-4 h-4 mr-2" /> Start Timer
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Profile"
        message="Are you sure you want to delete this profile?"
        onConfirm={executeDeleteProfile}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
        confirmText="Delete"
      />
    </div>
  );
};
