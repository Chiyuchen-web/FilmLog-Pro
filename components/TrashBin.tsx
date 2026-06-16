
import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { FilmRecord } from '../types';
import { storageService } from '../services/storageService';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/Button';
import { ConfirmModal } from './ConfirmModal';

interface TrashBinProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void; // Callback to refresh main list
}

export const TrashBin: React.FC<TrashBinProps> = ({ isOpen, onClose, onRestore }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [deletedRecords, setDeletedRecords] = useState<FilmRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    id: string | null;
  }>({ isOpen: false, id: null });

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen]);

  const loadTrash = async () => {
    setLoading(true);
    const data = await storageService.getTrash();
    setDeletedRecords(data);
    setLoading(false);
  };

  const handleRestore = async (id: string) => {
    await storageService.restore(id);
    await loadTrash();
    onRestore(); // Refresh main app list
    showToast('Record restored', 'success');
  };

  const handlePermanentDelete = async (id: string) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executePermanentDelete = async () => {
    if (!confirmModal.id) return;
    const id = confirmModal.id;
    setConfirmModal({ isOpen: false, id: null });
    
    await storageService.permanentDelete(id);
    await loadTrash();
    showToast('Record permanently deleted', 'success');
  };

  if (!isOpen) return null;

  return (
    // Updated Z-Index to 60
    <div className="fixed inset-0 z-[60] overflow-hidden bg-white dark:bg-gray-900 flex flex-col h-screen-dynamic">
       <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 pt-safe-top">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            {t('trash.title')}
        </h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 pb-safe-bottom">
        {loading ? (
           <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : deletedRecords.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Trash2 className="w-12 h-12 mb-2 opacity-20" />
              <p>{t('trash.empty')}</p>
           </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {deletedRecords.map(record => (
                    <div key={record.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{record.filmModel}</h3>
                                <p className="text-xs text-gray-500">{new Date(record.date || record.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-medium">Deleted</span>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleRestore(record.id)} className="flex-1 text-xs">
                                <RotateCcw className="w-3 h-3 mr-1" /> {t('trash.restore')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handlePermanentDelete(record.id)} className="flex-1 text-xs">
                                <X className="w-3 h-3 mr-1" /> {t('trash.delete_forever')}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={t('trash.confirm_permanent') as string || 'Permanent Delete'}
        message="This action cannot be undone. Are you sure?"
        onConfirm={executePermanentDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
        confirmText="Delete Forever"
      />
    </div>
  );
};
