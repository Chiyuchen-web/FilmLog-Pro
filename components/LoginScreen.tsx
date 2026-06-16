
import React, { useState } from 'react';
import { Film, Lock, Mail, UserPlus, LogIn, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storageService';

interface LoginScreenProps {
  onLogin: () => void;
}

type AuthMode = 'login' | 'register';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await storageService.signIn(email, password);
        onLogin();
      } else {
        await storageService.signUp(email, password);
        setSuccess(t('auth.register_success'));
        // Switch to login mode after successful registration
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      if (msg.includes('Invalid login credentials')) {
        setError(t('auth.error_credentials'));
      } else if (msg.includes('already registered')) {
        setError(t('auth.error_already_registered'));
      } else if (msg.includes('Password should be at least 6 characters')) {
        setError(t('auth.error_password_length'));
      } else if (msg.includes('Unable to validate email')) {
        setError(t('auth.error_invalid_email'));
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen-dynamic flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <Film className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mode === 'login' ? t('auth.login_desc') : t('auth.register_desc')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email_placeholder')}
                className="h-12 pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password_placeholder')}
                className="h-12 pl-10"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {mode === 'register' && (
              <p className="text-xs text-gray-400 mt-1">{t('auth.password_hint')}</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg shadow-lg shadow-indigo-500/20"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : mode === 'login' ? (
              <LogIn className="w-5 h-5 mr-2" />
            ) : (
              <UserPlus className="w-5 h-5 mr-2" />
            )}
            {isLoading
              ? t('auth.processing')
              : mode === 'login'
                ? t('auth.submit_login')
                : t('auth.submit_register')
            }
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors font-medium"
          >
            {mode === 'login' ? t('auth.switch_to_register') : t('auth.switch_to_login')}
          </button>
        </div>
      </div>
    </div>
  );
};
