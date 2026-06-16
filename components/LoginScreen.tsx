
import React, { useState } from 'react';
import { Film, Lock } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('0');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === '0' && password === '0') {
      onLogin();
    } else {
      setError(t('auth.error'));
    }
  };

  return (
    <div className="min-h-screen-dynamic flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <Film className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.login')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.username')}</label>
            <Input 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.placeholder_user')}
              className="h-12"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.password')}</label>
            <Input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.placeholder_pass')}
              className="h-12"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-indigo-500/20">
            <Lock className="w-4 h-4 mr-2" />
            {t('auth.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
};
