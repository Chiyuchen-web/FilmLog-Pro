
import React, { useState } from 'react';
import { FilmRecord } from '../types';
import { MapPin, Camera, Clock, MoreVertical, Edit2, Trash2, Droplet, Image as ImageIcon, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface FilmCardProps {
  record: FilmRecord;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  onEdit: (record: FilmRecord) => void;
  onDelete: (id: string) => void;
  onSyncRequest: () => void;
}

// Helper for display format: YYYY-MM-DD HH:mm
const formatDateForDisplay = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const FilmCard: React.FC<FilmCardProps> = ({ record, selected, onToggleSelection, onEdit, onDelete, onSyncRequest }) => {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fallback to createdAt if date is missing (legacy records)
  const displayDate = record.date || record.createdAt;
  const isSynced = record._synced === true;

  const handleManualSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSynced) return;
      
      setIsSyncing(true);
      await onSyncRequest();
      setIsSyncing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(false);
      onDelete(record.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(false);
      onEdit(record);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border flex flex-col h-full group relative ${selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-100 dark:border-gray-700'}`}>
      
      {/* Header Area */}
      <div className="relative h-48">
          {/* Image Container - Clipped for round corners */}
          <div className="absolute inset-0 overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            {record.locationImage ? (
                <img 
                    src={record.locationImage} 
                    alt="Location" 
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="text-gray-300 dark:text-gray-500 flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="text-xs font-medium">{t('card.no_location_preview')}</span>
                </div>
            )}
          </div>

          {/* Action Layer - NOT Clipped (z-index higher than image container) */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {/* Selection Checkbox */}
                <div className="absolute top-3 left-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox" 
                        checked={selected}
                        onChange={(e) => { e.stopPropagation(); onToggleSelection(record.id); }}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer"
                    />
                </div>

                 {/* Type Badge */}
                <div className="absolute bottom-3 left-3 pointer-events-auto">
                     <span className="bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                        {record.format}
                    </span>
                </div>

                {/* Menu Trigger */}
                <div className="absolute top-3 right-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm transition-all"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                    <button 
                                        onClick={handleEditClick}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2"
                                    >
                                        <Edit2 className="w-3 h-3" /> {t('card.edit')}
                                    </button>
                                    <button 
                                        onClick={handleDeleteClick}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-3 h-3" /> {t('card.delete')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
          </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1">{record.filmModel}</h3>
          <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{record.location || t('card.unknown_location')}</span>
          </div>
        </div>

        <div className="space-y-3 mb-4 flex-1">
            {/* Shot Details */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>{record.aperture || '--'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>{record.shutterSpeed ? `${record.shutterSpeed}s` : '--'}</span>
                </div>
            </div>

            {/* Dev Details */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 text-xs text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-1.5 mb-1 font-medium text-amber-800 dark:text-amber-400">
                    <Droplet className="w-3.5 h-3.5" />
                    <span>{t('card.dev')} ({t(`enum.${record.devMethod}`)})</span>
                </div>
                <p className="truncate">
                   {record.developerModel || t('card.unknown_chem')} ({record.devDilution || t('card.stock')})
                </p>
                <p className="truncate text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                   {t('card.dev_time')}: {record.devTime || "--"} | {t('card.fix_time')}: {record.fixTime || "--"}
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center mt-auto">
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    {formatDateForDisplay(displayDate)}
                </span>
                
                {/* Sync Status Indicator */}
                <button 
                    onClick={handleManualSync}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                        isSynced 
                        ? 'text-green-500 cursor-default' 
                        : 'text-gray-400 hover:text-indigo-500 cursor-pointer'
                    }`}
                    title={isSynced ? 'Synced to Cloud' : 'Local Only - Click to Sync'}
                >
                    {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSynced ? (
                        <Cloud className="w-3.5 h-3.5" />
                    ) : (
                        <CloudOff className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>

            {record.filmImage && (
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
                    <ImageIcon className="w-3 h-3" />
                    {t('card.preview')}
                </span>
            )}
        </div>
      </div>
    </div>
  );
};
