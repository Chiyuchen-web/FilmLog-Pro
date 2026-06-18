
import React, { useState, useEffect } from 'react';
import { X, Key, Save, Cloud, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedSbKey = localStorage.getItem('filmlog_supabase_key');
      setSupabaseKey(storedSbKey || 'sb_publishable_qXuAT3dkSzzotjdaWA9Stg_zY4g2RwE');

      const storedSbUrl = localStorage.getItem('filmlog_supabase_url');
      setSupabaseUrl(storedSbUrl || 'https://uvszhvoixngxkfvglgsu.supabase.co');
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
      if (!supabaseUrl || !supabaseKey) {
          showToast(t('settings.test_fail') + ": Missing credentials", 'error');
          return;
      }
      setIsTesting(true);
      try {
          await storageService.testConnection(supabaseUrl, supabaseKey);
          showToast(t('settings.test_success'), 'success');
      } catch (e: any) {
          const msg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
          showToast(`${t('settings.test_fail')}: ${msg}`, 'error');
      } finally {
          setIsTesting(false);
      }
  };

  const handleSave = () => {
    try {
        localStorage.setItem('filmlog_supabase_key', supabaseKey.trim());
        localStorage.setItem('filmlog_supabase_url', supabaseUrl.trim());

        storageService.reloadConfig();
        showToast(t('settings.saved'), 'success');

        setTimeout(() => {
          onClose();
        }, 500);
    } catch (e) {
        showToast('Failed to save settings', 'error');
    }
  };

  if (!isOpen) return null;

  const isCloudEnabled = supabaseUrl && supabaseKey;

  return (
    // Update Z-Index to 70 (Highest modal)
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen-dynamic px-4 pt-safe-top pb-safe-bottom text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-lg my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl relative z-50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" /> {t('settings.title')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
            {/* Cloud Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-500" /> {t('settings.cloud_title')}
                  </h4>
                  {isCloudEnabled && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={handleTestConnection} 
                      isLoading={isTesting}
                      className="text-xs py-1 h-7"
                    >
                      {isTesting ? t('settings.testing') : t('settings.test_conn')}
                    </Button>
                  )}
               </div>
               <div className="space-y-4">
                 <Input
                    label={t('settings.supabase_url')}
                    placeholder="https://your-project.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="font-mono text-xs"
                 />
                 <Input
                    label={t('settings.supabase_key')}
                    placeholder="eyJhbG..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="font-mono text-xs"
                 />
               </div>
               <div className="mt-3 flex items-center justify-between">
                 <span className={`text-xs font-medium ${isCloudEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                   {isCloudEnabled ? t('settings.cloud_status_on') : t('settings.cloud_status_off')}
                 </span>
                 <p className="text-xs text-gray-400 dark:text-gray-500 text-right max-w-[150px] leading-tight">
                    {t('settings.cloud_hint')}
                 </p>
               </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button onClick={handleSave} className="w-full">
                {t('settings.save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
