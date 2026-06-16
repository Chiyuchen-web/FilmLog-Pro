
import React, { useState, useEffect } from 'react';
import { AlertCircle, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface GlobalErrorBarProps {
  message: string | null;
  onClose: () => void;
}

export const GlobalErrorBar: React.FC<GlobalErrorBarProps> = ({ message, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLanguage();

  // Auto-expand if a new message arrives
  useEffect(() => {
    if (message) {
      setIsCollapsed(false);
    }
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] max-w-md w-full px-4 animate-in slide-in-from-bottom-5 duration-300">
      {isCollapsed ? (
        // Collapsed State
        <div className="bg-red-600 dark:bg-red-700 text-white shadow-lg rounded-full px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-red-700 dark:hover:bg-red-600 transition-colors mx-auto w-fit">
           <AlertTriangle className="w-5 h-5 animate-pulse" />
           <span className="text-sm font-bold pr-1">Error</span>
           <button 
             onClick={() => setIsCollapsed(false)}
             className="p-1 hover:bg-white/20 rounded-full"
             title="Expand"
           >
             <ChevronUp className="w-4 h-4" />
           </button>
           <button 
             onClick={onClose}
             className="p-1 hover:bg-white/20 rounded-full border-l border-white/20 ml-1 pl-2"
             title="Dismiss"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
      ) : (
        // Expanded State
        <div className="bg-white dark:bg-gray-800 border-l-4 border-red-500 shadow-2xl rounded-lg p-4 flex items-start gap-3 ring-1 ring-gray-200 dark:ring-gray-700">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">
              Attention Needed
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 break-words leading-tight">
              {message}
            </p>
          </div>
          <div className="flex flex-col gap-1 shrink-0 ml-2">
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-indigo-500 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors mt-auto"
              title="Collapse"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
