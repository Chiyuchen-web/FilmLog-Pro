
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './Button';

interface TimeWheelProps {
    value: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
    label: string;
}

const TimeWheel = ({ value, max, step = 1, onChange, label }: TimeWheelProps) => {
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const direction = Math.sign(e.deltaY);
        // Reverse direction for natural scroll feel
        let next = value + (direction * step);
        if (next < 0) next = Math.floor(max / step) * step;
        if (next > max) next = 0;
        onChange(next);
    };

    const increment = () => {
        let next = value + step;
        if (next > max) next = 0;
        onChange(next);
    };

    const decrement = () => {
        let next = value - step;
        if (next < 0) next = Math.floor(max / step) * step;
        onChange(next);
    };

    return (
        <div className="flex flex-col items-center gap-2 select-none">
            <button 
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors active:scale-95"
                onClick={decrement}
            >
                <ChevronUp className="w-8 h-8" />
            </button>
            <div 
                onWheel={handleWheel}
                className="w-24 h-32 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 flex items-center justify-center text-5xl font-mono font-black text-gray-900 dark:text-white cursor-ns-resize select-none transition-all shadow-inner touch-none"
            >
                {value.toString().padStart(2, '0')}
            </div>
            <button 
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors active:scale-95"
                onClick={increment}
            >
                <ChevronDown className="w-8 h-8" />
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        </div>
    );
};

interface TimeWheelPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (totalSeconds: number) => void;
    initialSeconds: number;
    title?: string;
    stepSeconds?: number;
}

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({ isOpen, onClose, onSave, initialSeconds, title = "Set Time", stepSeconds = 1 }) => {
    const [h, setH] = React.useState(0);
    const [m, setM] = React.useState(0);
    const [s, setS] = React.useState(0);

    React.useEffect(() => {
        if (isOpen) {
            setH(Math.floor(initialSeconds / 3600));
            setM(Math.floor((initialSeconds % 3600) / 60));
            // Round seconds to nearest step if needed
            const rawS = Math.floor(initialSeconds % 60);
            setS(Math.floor(rawS / stepSeconds) * stepSeconds);
        }
    }, [isOpen, initialSeconds, stepSeconds]);

    const handleSave = () => {
        onSave(h * 3600 + m * 60 + s);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200 p-6" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center gap-8 border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wider">{title}</h3>
                
                <div className="flex items-center gap-2 sm:gap-4 justify-center w-full">
                    {h > 0 && (
                        <>
                         <TimeWheel value={h} max={24} onChange={setH} label="Hrs" />
                         <span className="text-3xl font-black text-gray-300 dark:text-gray-700 pb-6">:</span>
                        </>
                    )}
                    <TimeWheel value={m} max={59} onChange={setM} label="Min" />
                    <span className="text-3xl font-black text-gray-300 dark:text-gray-700 pb-6">:</span>
                    <TimeWheel value={s} max={60 - stepSeconds} step={stepSeconds} onChange={setS} label="Sec" />
                </div>

                <div className="flex gap-4 w-full">
                    <Button variant="secondary" onClick={onClose} className="flex-1 h-14 rounded-2xl text-lg font-bold">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="flex-1 h-14 rounded-2xl text-lg font-bold shadow-lg shadow-indigo-500/30">
                        Confirm
                    </Button>
                </div>
            </div>
        </div>
    );
};
