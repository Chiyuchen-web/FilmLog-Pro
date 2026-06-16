
import React, { useState, useEffect } from 'react';
import { X, Camera, Beaker, Upload, Image as ImageIcon, BookOpen, Sparkles, Home, Info, Loader2 } from 'lucide-react';
import { FilmRecord, FilmFormat, DevMethod, FILM_FORMATS, DEV_METHODS, DevRecipe } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';

interface RecordEditorProps {
  initialData?: FilmRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onReturnHome: () => void;
  onSave: (record: FilmRecord) => Promise<void>;
  onViewRecipe: (recipeId: string) => void;
}

const emptyRecord: Omit<FilmRecord, 'id' | 'createdAt' | 'updatedAt'> = {
  date: Date.now(),
  filmModel: '',
  format: '135',
  aperture: '',
  shutterSpeed: '',
  flashPower: '',
  location: '',
  locationImage: null,
  shootingNotes: '',
  devMethod: 'Hand',
  devProcess: 'BW',
  developerModel: '',
  fixerModel: '',
  devDilution: '',
  fixDilution: '',
  isPreWet: false,
  devTime: '',
  fixTime: '',
  devNotes: '',
  filmImage: null,
};

const formatDateForInput = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Image Compression Helper
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1500;

        // Resize logic
        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Compression loop to aim for < 512KB
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Simple heuristic: reduce quality if string length implies > 512KB
        // Base64 size ~= size * 1.33. 512KB ~= 524288 bytes. Target string length ~= 700000
        while (dataUrl.length > 700000 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const RecordEditor: React.FC<RecordEditorProps> = ({ initialData, isOpen, onClose, onReturnHome, onSave, onViewRecipe }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'shooting' | 'developing'>('shooting');
  const [formData, setFormData] = useState<any>(emptyRecord);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [recipes, setRecipes] = useState<DevRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialDate = initialData 
        ? (initialData.date || initialData.createdAt || Date.now()) 
        : Date.now();
      
      setFormData({
        ...(initialData || emptyRecord),
        date: initialDate
      });
      setActiveTab('shooting');
      setSelectedRecipeId('');
      
      storageService.getRecipes().then(setRecipes);
    }
  }, [isOpen, initialData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'locationImage' | 'filmImage') => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
          const compressedDataUrl = await compressImage(file);
          setFormData((prev: any) => ({ ...prev, [field]: compressedDataUrl }));
      } catch (err) {
          console.error("Image compression failed", err);
          alert("Failed to process image. Please try a different file.");
      } finally {
          setIsCompressing(false);
      }
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      const timestamp = new Date(dateString).getTime();
      setFormData({ ...formData, date: timestamp });
    }
  };

  const handleRecipeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const recipeId = e.target.value;
      setSelectedRecipeId(recipeId);
      if(!recipeId) return;
      const recipe = recipes.find(r => r.id === recipeId);
      if(recipe) {
          const totalDevSeconds = recipe.config.developerSteps.reduce((acc, step) => acc + step.duration, 0) * recipe.config.devLoopCount;
          
          setFormData({
              ...formData,
              devMethod: recipe.config.devMethod,
              developerModel: recipe.config.developerSteps[0]?.name || '',
              devDilution: recipe.config.developerSteps[0]?.dilution || '',
              devTime: formatTime(totalDevSeconds),
              fixTime: formatTime(recipe.config.fixTime),
              isPreWet: recipe.config.enablePreWet,
              devNotes: recipe.notes || formData.devNotes
          });
      }
  };

  const handleAiSuggestShooting = async () => {
    if (!formData.filmModel) {
      alert(t('placeholder.filmModel'));
      return;
    }
    setIsAiGenerating(true);
    try {
      const suggestion = await aiService.suggestShootingNotes(formData.filmModel, formData.location, formData.format);
      setFormData(prev => ({ 
        ...prev, 
        shootingNotes: prev.shootingNotes ? `${prev.shootingNotes}\n\nAI 建议：\n${suggestion}` : suggestion 
      }));
    } catch (e: any) {
      if (e.message === 'API_KEY_MISSING') {
          alert(t('editor.ai_error_no_key'));
      } else {
          alert("AI 服务错误，请稍后重试。");
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAiSuggestDev = async () => {
    if (!formData.filmModel) {
      alert(t('placeholder.filmModel'));
      return;
    }
    setIsAiGenerating(true);
    try {
      const suggestion = await aiService.suggestDevNotes(formData.filmModel, formData.developerModel, t(`enum.${formData.devMethod}`));
      setFormData(prev => ({ 
        ...prev, 
        devNotes: prev.devNotes ? `${prev.devNotes}\n\nAI 建议：\n${suggestion}` : suggestion 
      }));
    } catch (e: any) {
      if (e.message === 'API_KEY_MISSING') {
          alert(t('editor.ai_error_no_key'));
      } else {
          alert("AI 服务错误，请稍后重试。");
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const recordToSave: FilmRecord = {
        ...formData,
        id: initialData?.id || Date.now().toString(),
        createdAt: initialData?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await onSave(recordToSave);
      onClose();
    } catch (error) {
      console.error("Failed to save", error);
      alert(t('editor.save_fail'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Z-Index 25 (Same as DevTimer) to sit under Navbar
    // Added Padding Top
    <div className="fixed inset-0 z-25 overflow-y-auto bg-gray-500/75 dark:bg-black/75 pt-[calc(4rem+env(safe-area-inset-top))] pb-safe-bottom">
      <div className="flex items-center justify-center min-h-full px-4 pt-4 text-center sm:p-0">
        
        <div className="inline-block w-full max-w-2xl overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl relative">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {initialData ? t('editor.edit_title') : t('editor.new_title')}
            </h3>
            <div className="flex items-center gap-2">
                <button onClick={onReturnHome} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1" title="Home">
                  <Home className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1">
                  <X className="w-5 h-5" />
                </button>
            </div>
          </div>

          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('shooting')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'shooting'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Camera className="w-4 h-4" /> {t('editor.tab_shooting')}
            </button>
            <button
              onClick={() => setActiveTab('developing')}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'developing'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Beaker className="w-4 h-4" /> {t('editor.tab_developing')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
            {activeTab === 'shooting' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label={t('field.date')}
                  type="datetime-local"
                  value={formatDateForInput(formData.date)}
                  onChange={handleDateChange}
                  required
                  className="md:col-span-2 font-mono"
                />

                <Input
                  label={t('field.filmModel')}
                  placeholder={t('placeholder.filmModel')}
                  value={formData.filmModel}
                  onChange={(e) => setFormData({ ...formData, filmModel: e.target.value })}
                  required
                  className="md:col-span-2"
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('field.format')}</label>
                  <select
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value as FilmFormat })}
                  >
                    {FILM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                
                <Input
                  label={t('field.location')}
                  placeholder={t('placeholder.location')}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />

                <Input
                  label={t('field.aperture')}
                  placeholder={t('placeholder.aperture')}
                  value={formData.aperture}
                  onChange={(e) => setFormData({ ...formData, aperture: e.target.value })}
                />

                <Input
                  label={t('field.shutterSpeed')}
                  placeholder={t('placeholder.shutterSpeed')}
                  value={formData.shutterSpeed}
                  onChange={(e) => setFormData({ ...formData, shutterSpeed: e.target.value })}
                />

                <Input
                  label={t('field.flashPower')}
                  placeholder={t('placeholder.flashPower')}
                  value={formData.flashPower}
                  onChange={(e) => setFormData({ ...formData, flashPower: e.target.value })}
                />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editor.preview_location')}</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                    <div className="space-y-1 text-center">
                      {formData.locationImage ? (
                        <div className="relative">
                            <img src={formData.locationImage} alt="Preview" className="mx-auto h-32 object-contain" />
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, locationImage: null})}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                      ) : (
                        <>
                           {isCompressing ? (
                             <Loader2 className="mx-auto h-12 w-12 text-indigo-500 animate-spin" />
                           ) : (
                             <ImageIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                           )}
                          <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                            <label className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                              <span className="px-1">{t('editor.upload')}</span>
                              <input type="file" className="sr-only" accept="image/*" onChange={(e) => handleImageUpload(e, 'locationImage')} disabled={isCompressing} />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('editor.upload_hint')}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('field.shootingNotes')}</label>
                    <button 
                      type="button"
                      onClick={handleAiSuggestShooting}
                      disabled={isAiGenerating}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 disabled:opacity-50 font-semibold"
                    >
                      <Sparkles className={`w-3 h-3 ${isAiGenerating ? 'animate-pulse' : ''}`} />
                      {isAiGenerating ? t('editor.ai_generating') : t('editor.ai_magic')}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.shootingNotes}
                    onChange={(e) => setFormData({ ...formData, shootingNotes: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                    <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> {t('editor.load_recipe')}
                    </label>
                    <div className="flex gap-2">
                      <select
                          className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          onChange={handleRecipeSelect}
                          value={selectedRecipeId}
                      >
                          <option value="">{t('editor.recipe_placeholder')}</option>
                          {recipes.map(recipe => (
                              <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                          ))}
                      </select>
                      <Button 
                        type="button" 
                        variant="secondary"
                        disabled={!selectedRecipeId}
                        onClick={() => onViewRecipe(selectedRecipeId)}
                        title="View Details"
                        className="px-3"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('field.devMethod')}</label>
                  <select
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.devMethod}
                    onChange={(e) => setFormData({ ...formData, devMethod: e.target.value as DevMethod })}
                  >
                    {DEV_METHODS.map(m => <option key={m} value={m}>{t(`enum.${m}`)}</option>)}
                  </select>
                </div>

                <Input
                  label={t('field.devProcess')}
                  placeholder={t('placeholder.devProcess')}
                  value={formData.devProcess}
                  onChange={(e) => setFormData({ ...formData, devProcess: e.target.value })}
                />

                <Input
                  label={t('field.developerModel')}
                  placeholder={t('placeholder.developerModel')}
                  value={formData.developerModel}
                  onChange={(e) => setFormData({ ...formData, developerModel: e.target.value })}
                />

                <Input
                  label={t('field.devDilution')}
                  placeholder={t('placeholder.devDilution')}
                  value={formData.devDilution}
                  onChange={(e) => setFormData({ ...formData, devDilution: e.target.value })}
                />

                 <Input
                  label={t('field.devTime')}
                  placeholder={t('placeholder.devTime')}
                  value={formData.devTime}
                  onChange={(e) => setFormData({ ...formData, devTime: e.target.value })}
                />

                <div className="flex items-center mt-6">
                    <input
                        id="prewet"
                        type="checkbox"
                        checked={formData.isPreWet}
                        onChange={(e) => setFormData({ ...formData, isPreWet: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    <label htmlFor="prewet" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        {t('editor.prewet')}
                    </label>
                </div>

                <Input
                  label={t('field.fixerModel')}
                  placeholder={t('placeholder.fixerModel')}
                  value={formData.fixerModel}
                  onChange={(e) => setFormData({ ...formData, fixerModel: e.target.value })}
                />

                <Input
                  label={t('field.fixDilution')}
                  placeholder={t('placeholder.fixDilution')}
                  value={formData.fixDilution}
                  onChange={(e) => setFormData({ ...formData, fixDilution: e.target.value })}
                />
                
                <Input
                  label={t('field.fixTime')}
                  placeholder={t('placeholder.fixTime')}
                  value={formData.fixTime}
                  onChange={(e) => setFormData({ ...formData, fixTime: e.target.value })}
                />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editor.preview_film')}</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                     <div className="space-y-1 text-center">
                      {formData.filmImage ? (
                        <div className="relative">
                            <img src={formData.filmImage} alt="Preview" className="mx-auto h-32 object-contain" />
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, filmImage: null})}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                      ) : (
                        <>
                           {isCompressing ? (
                             <Loader2 className="mx-auto h-12 w-12 text-indigo-500 animate-spin" />
                           ) : (
                             <ImageIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                           )}
                          <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                            <label className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                              <span className="px-1">{t('editor.upload')}</span>
                              <input type="file" className="sr-only" accept="image/*" onChange={(e) => handleImageUpload(e, 'filmImage')} disabled={isCompressing} />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('editor.upload_hint_film')}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                 <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('field.devNotes')}</label>
                    <button 
                      type="button"
                      onClick={handleAiSuggestDev}
                      disabled={isAiGenerating}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 disabled:opacity-50 font-semibold"
                    >
                      <Sparkles className={`w-3 h-3 ${isAiGenerating ? 'animate-pulse' : ''}`} />
                      {isAiGenerating ? t('editor.ai_generating') : t('editor.ai_magic')}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.devNotes}
                    onChange={(e) => setFormData({ ...formData, devNotes: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('editor.cancel')}
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving || isCompressing}>
                {initialData ? t('editor.update') : t('editor.save_upload')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
