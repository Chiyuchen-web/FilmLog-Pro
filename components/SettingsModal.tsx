
import React, { useState, useEffect } from 'react';
import { X, Key, Save, ExternalLink, Cloud, Loader2, Database, Copy, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `
-- 1. Create Tables (if not exist)
create table if not exists film_records (
  id text primary key,
  updated_at timestamptz,
  data jsonb
);

create table if not exists dev_recipes (
  id text primary key,
  updated_at timestamptz,
  data jsonb
);

create table if not exists reciprocity_profiles (
  id text primary key,
  updated_at timestamptz,
  data jsonb
);

-- 2. Enable RLS
alter table film_records enable row level security;
alter table dev_recipes enable row level security;
alter table reciprocity_profiles enable row level security;

-- 3. DROP OLD POLICIES (Clean slate)
drop policy if exists "Public Access" on film_records;
drop policy if exists "Enable read access for all users" on film_records;
drop policy if exists "Enable insert for all users" on film_records;
drop policy if exists "Enable update for all users" on film_records;
drop policy if exists "Enable delete for all users" on film_records;

drop policy if exists "Public Access" on dev_recipes;
drop policy if exists "Enable read access for all users" on dev_recipes;
drop policy if exists "Enable insert for all users" on dev_recipes;
drop policy if exists "Enable update for all users" on dev_recipes;
drop policy if exists "Enable delete for all users" on dev_recipes;

drop policy if exists "Enable read access for all users" on reciprocity_profiles;
drop policy if exists "Enable insert for all users" on reciprocity_profiles;
drop policy if exists "Enable update for all users" on reciprocity_profiles;
drop policy if exists "Enable delete for all users" on reciprocity_profiles;

-- 4. CREATE EXPLICIT POLICIES (Granular control)

-- Film Records Policies
create policy "Enable read access for all users" on film_records for select using (true);
create policy "Enable insert for all users" on film_records for insert with check (true);
create policy "Enable update for all users" on film_records for update using (true) with check (true);
create policy "Enable delete for all users" on film_records for delete using (true);

-- Dev Recipes Policies
create policy "Enable read access for all users" on dev_recipes for select using (true);
create policy "Enable insert for all users" on dev_recipes for insert with check (true);
create policy "Enable update for all users" on dev_recipes for update using (true) with check (true);
create policy "Enable delete for all users" on dev_recipes for delete using (true);

-- Reciprocity Profiles Policies
create policy "Enable read access for all users" on reciprocity_profiles for select using (true);
create policy "Enable insert for all users" on reciprocity_profiles for insert with check (true);
create policy "Enable update for all users" on reciprocity_profiles for update using (true) with check (true);
create policy "Enable delete for all users" on reciprocity_profiles for delete using (true);
`;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('filmlog_gemini_key');
      if (storedKey) setApiKey(storedKey);

      const storedSbKey = localStorage.getItem('filmlog_supabase_key');
      // Set default Key if not stored
      setSupabaseKey(storedSbKey || 'sb_publishable_qXuAT3dkSzzotjdaWA9Stg_zY4g2RwE');

      const storedSbUrl = localStorage.getItem('filmlog_supabase_url');
      // Set default URL if not stored
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
        localStorage.setItem('filmlog_gemini_key', apiKey.trim());
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

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopied(true);
    showToast('SQL script copied', 'success');
    setTimeout(() => setCopied(false), 2000);
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
            
            {/* Database Setup Help */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                        <Database className="w-4 h-4" /> SQL Setup (Required)
                    </h4>
                    <button 
                        onClick={handleCopySql} 
                        className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy SQL'}
                    </button>
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mb-3">
                    Copy this code and run it in the <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noopener noreferrer" className="underline font-bold">Supabase SQL Editor</a> to create the required tables and public access policies.
                </p>
                <div className="bg-gray-800 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-gray-300 leading-relaxed whitespace-pre">{SQL_SCRIPT}</pre>
                </div>
            </div>

            {/* AI Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.api_key')}
              </label>
              <Input
                type="password"
                placeholder={t('settings.api_key_placeholder')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
              <div className="flex justify-between items-start mt-2">
                 <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                    {t('settings.api_key_hint')}
                 </p>
                 <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                 >
                    {t('settings.get_key')} <ExternalLink className="w-3 h-3" />
                 </a>
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
