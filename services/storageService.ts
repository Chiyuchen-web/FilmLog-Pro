
import { FilmRecord, DevRecipe, SyncQueueItem, SyncTarget, SyncActionType, ReciprocityProfile } from '../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'filmlog_db_v1';
const RECIPE_KEY = 'filmlog_recipes_v1';
const PROFILE_KEY = 'filmlog_reciprocity_v1'; // Reciprocity Profiles
const QUEUE_KEY = 'filmlog_sync_queue_v1'; // The Cache Pool
const TRASH_KEY = 'filmlog_trash_v1';

// Default Keys (Fallback) - In a real production app these should be env vars or securely injected
const DEFAULT_URL = 'https://uvszhvoixngxkfvglgsu.supabase.co';
const DEFAULT_KEY = 'sb_publishable_qXuAT3dkSzzotjdaWA9Stg_zY4g2RwE';

// Get config
const getSupabaseConfig = () => {
    let url = typeof window !== 'undefined' ? localStorage.getItem('filmlog_supabase_url') : null;
    let key = typeof window !== 'undefined' ? localStorage.getItem('filmlog_supabase_key') : null;

    // Auto-fill defaults if missing (Requirement: "Already filled by default")
    if (!url) {
        url = DEFAULT_URL;
        if (typeof window !== 'undefined') localStorage.setItem('filmlog_supabase_url', url);
    }
    if (!key) {
        key = DEFAULT_KEY;
        if (typeof window !== 'undefined') localStorage.setItem('filmlog_supabase_key', key);
    }

    return { url, key };
};

let supabase: SupabaseClient | null = null;
let lastConfig: { url: string; key: string } | null = null;

const initSupabase = () => {
    const { url, key } = getSupabaseConfig();
    if (supabase && lastConfig && lastConfig.url === url && lastConfig.key === key) return;

    if (url && key) {
        try {
            supabase = createClient(url, key, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
                db: { schema: 'public' },
            });
            lastConfig = { url, key };
        } catch (e) {
            console.error("Invalid Supabase Config", e);
            supabase = null;
        }
    } else {
        supabase = null;
    }
};

initSupabase();

// --- Helper: Action Queue (Cache Pool) ---

const getQueue = (): SyncQueueItem[] => {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
};

const addToQueue = (targetId: string, target: SyncTarget, action: SyncActionType, data?: any) => {
    const queue = getQueue();
    // Optimization: If we are adding a DELETE, we can remove any previous UPSERTs for the same ID to save bandwidth
    let newQueue = queue;
    if (action === 'DELETE') {
        newQueue = queue.filter(q => !(q.targetId === targetId && q.target === target));
    }

    const item: SyncQueueItem = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        targetId,
        target,
        action,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined, // Deep copy
        timestamp: Date.now()
    };
    newQueue.push(item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    console.log(`[Cache Pool] Added action: ${action} on ${target} (${targetId})`);
};

// Helper to remove a specific item from queue (safe against concurrent adds)
const removeFromQueue = (itemId: string) => {
    const currentQueue = getQueue();
    const updatedQueue = currentQueue.filter(q => q.id !== itemId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
};

let syncTimeout: any = null;
let isSyncing = false;

export const storageService = {
  
  reloadConfig() {
      initSupabase();
  },

  async testConnection(url: string, key: string): Promise<void> {
      try { new URL(url); } catch { throw new Error("Invalid URL"); }
      if (!key) throw new Error("Missing API Key");
      const tempClient = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await tempClient.from('film_records').select('id').limit(1);
      if (error && error.code !== 'PGRST116') throw error;
  },

  // --- Read Ops (Local Only) ---

  async getAll(): Promise<FilmRecord[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Ensure IDs are strings and filter out soft-deleted items
    return parsed.map((r: any) => ({...r, id: String(r.id)})).filter((r: any) => !r.isDeleted);
  },

  async getRecipes(): Promise<DevRecipe[]> {
    const raw = localStorage.getItem(RECIPE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((r: any) => ({...r, id: String(r.id)}));
  },

  async getReciprocityProfiles(): Promise<ReciprocityProfile[]> {
    const raw = localStorage.getItem(PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((r: any) => ({...r, id: String(r.id)}));
  },

  async getTrash(): Promise<FilmRecord[]> {
    // Combine soft-deleted items from main storage and legacy trash
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    const storageRecords = rawStorage ? JSON.parse(rawStorage) : [];
    const softDeleted = storageRecords
        .filter((r: any) => r.isDeleted)
        .map((r: any) => ({...r, id: String(r.id)}));

    const rawTrash = localStorage.getItem(TRASH_KEY);
    const legacyTrash = rawTrash ? JSON.parse(rawTrash) : [];
    const legacyParsed = legacyTrash.map((r: any) => ({...r, id: String(r.id)}));

    // Combine and deduplicate
    const combined = [...softDeleted, ...legacyParsed];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return unique;
  },

  // --- Write Ops (Local + Queue + AutoSync) ---

  async save(record: FilmRecord): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : [];
    const index = records.findIndex((r: any) => String(r.id) === record.id);
    
    // 1. Update Local Storage immediately
    if (index >= 0) {
        records[index] = record;
    } else {
        records.unshift(record);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

    // 2. Add to Cache Pool
    addToQueue(record.id, 'RECORD', 'UPSERT', record);

    // 3. Real-time Sync (Fire and forget)
    this.triggerSync().catch(console.error);
  },

  // New method to save entire array order
  async saveAllRecords(records: FilmRecord[]): Promise<void> {
      const raw = localStorage.getItem(STORAGE_KEY);
      const allRecords = raw ? JSON.parse(raw) : [];
      
      // Update order for the visible records
      const updatedRecords = records.map((r, index) => ({ ...r, order: index }));
      
      // Merge back with soft-deleted records
      const deletedRecords = allRecords.filter((r: any) => r.isDeleted);
      const finalRecords = [...updatedRecords, ...deletedRecords];
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalRecords));
      
      // Queue UPSERT for all updated records to sync order
      updatedRecords.forEach(r => {
          addToQueue(r.id, 'RECORD', 'UPSERT', r);
      });
      this.triggerSync().catch(console.error);
  },

  async delete(id: string): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : [];
    const index = records.findIndex((r: any) => String(r.id) === id);

    if (index >= 0) {
        // Soft delete
        records[index].isDeleted = true;
        records[index].updatedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

        // Sync UPSERT to cloud (to update isDeleted flag)
        addToQueue(id, 'RECORD', 'UPSERT', records[index]);
        this.triggerSync().catch(console.error);
    }
  },

  async restore(id: string): Promise<void> {
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    const records = rawStorage ? JSON.parse(rawStorage) : [];
    const index = records.findIndex((r: any) => String(r.id) === id);
    
    let recordToRestore = null;

    if (index >= 0) {
        // Restore soft-deleted
        records[index].isDeleted = false;
        records[index].updatedAt = Date.now();
        recordToRestore = records[index];
    } else {
        // Check legacy trash
        const rawTrash = localStorage.getItem(TRASH_KEY);
        const legacyTrash = rawTrash ? JSON.parse(rawTrash) : [];
        const legacyIndex = legacyTrash.findIndex((r: any) => String(r.id) === id);
        if (legacyIndex >= 0) {
            recordToRestore = legacyTrash[legacyIndex];
            recordToRestore.isDeleted = false;
            recordToRestore.updatedAt = Date.now();
            records.unshift(recordToRestore);
            
            // Remove from legacy trash
            legacyTrash.splice(legacyIndex, 1);
            localStorage.setItem(TRASH_KEY, JSON.stringify(legacyTrash));
        }
    }

    if (recordToRestore) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        addToQueue(id, 'RECORD', 'UPSERT', recordToRestore);
        this.triggerSync().catch(console.error);
    }
  },

  async permanentDelete(id: string): Promise<void> {
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    const records = rawStorage ? JSON.parse(rawStorage) : [];
    const filtered = records.filter((r: any) => String(r.id) !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    const rawTrash = localStorage.getItem(TRASH_KEY);
    if (rawTrash) {
        const legacyTrash = JSON.parse(rawTrash);
        const filteredTrash = legacyTrash.filter((r: any) => String(r.id) !== id);
        localStorage.setItem(TRASH_KEY, JSON.stringify(filteredTrash));
    }

    addToQueue(id, 'RECORD', 'DELETE');
    this.triggerSync().catch(console.error);
  },

  // --- Recipe Ops ---

  async saveRecipe(recipe: DevRecipe): Promise<void> {
    const recipes = await this.getRecipes();
    const index = recipes.findIndex(r => r.id === recipe.id);
    
    if (index >= 0) recipes[index] = recipe;
    else recipes.unshift(recipe);
    localStorage.setItem(RECIPE_KEY, JSON.stringify(recipes));

    addToQueue(recipe.id, 'RECIPE', 'UPSERT', recipe);
    this.triggerSync().catch(console.error);
  },

  // New method to save entire recipe order
  async saveAllRecipes(recipes: DevRecipe[]): Promise<void> {
      const updatedRecipes = recipes.map((r, index) => ({ ...r, order: index }));
      localStorage.setItem(RECIPE_KEY, JSON.stringify(updatedRecipes));
      
      updatedRecipes.forEach(r => {
          addToQueue(r.id, 'RECIPE', 'UPSERT', r);
      });
      this.triggerSync().catch(console.error);
  },

  async deleteRecipe(id: string): Promise<void> {
    const recipes = await this.getRecipes();
    const filtered = recipes.filter(r => r.id !== id);
    localStorage.setItem(RECIPE_KEY, JSON.stringify(filtered));

    addToQueue(id, 'RECIPE', 'DELETE');
    this.triggerSync().catch(console.error);
  },

  // --- Reciprocity Profile Ops ---

  async saveReciprocityProfile(profile: ReciprocityProfile): Promise<void> {
    const profiles = await this.getReciprocityProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    
    if (index >= 0) profiles[index] = profile;
    else profiles.unshift(profile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));

    addToQueue(profile.id, 'PROFILE', 'UPSERT', profile);
    this.triggerSync().catch(console.error);
  },

  async deleteReciprocityProfile(id: string): Promise<void> {
    const profiles = await this.getReciprocityProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(filtered));

    addToQueue(id, 'PROFILE', 'DELETE');
    this.triggerSync().catch(console.error);
  },

  // --- Sync Logic (Process Queue) ---

  async triggerSync(): Promise<boolean> {
     // Ensure Supabase is initialized (e.g. if keys were added dynamically)
     if (!supabase) initSupabase();
     if (!supabase) return false;
     
     return new Promise((resolve, reject) => {
         if (syncTimeout) clearTimeout(syncTimeout);
         
         syncTimeout = setTimeout(async () => {
             if (isSyncing) {
                 resolve(false);
                 return;
             }
             
             isSyncing = true;
             console.log("[Sync] Started...");

             try {
                 // 1. PULL: Get latest data from Cloud first
                 await this.pullFromCloud();

                 // 2. PUSH: Process the Cache Pool (Queue)
                 await this.processQueue();
                 
                 resolve(true);
             } catch (e) {
                 console.error("[Sync] Failed", e);
                 reject(e);
             } finally {
                 isSyncing = false;
             }
         }, 1000); // 1-second debounce to prevent network congestion
     });
  },

  async pullFromCloud(): Promise<void> {
      if (!supabase) return;
      
      const queue = getQueue();
      const pendingRecordIds = new Set(queue.filter(q => q.target === 'RECORD').map(q => q.targetId));
      const pendingRecipeIds = new Set(queue.filter(q => q.target === 'RECIPE').map(q => q.targetId));
      const pendingProfileIds = new Set(queue.filter(q => q.target === 'PROFILE').map(q => q.targetId));

      // --- Pull Records ---
      const { data: cloudRecords, error: err1 } = await supabase.from('film_records').select('*');
      if (!err1 && cloudRecords) {
          const rawLocal = localStorage.getItem(STORAGE_KEY);
          const localRecords = rawLocal ? JSON.parse(rawLocal) : [];
          const recordMap = new Map<string, any>(localRecords.map((r: any) => [String(r.id), r]));
          
          cloudRecords.forEach((row: any) => {
               if (pendingRecordIds.has(row.id)) return;
               const record = { ...row.data, id: row.id, _synced: true };
               recordMap.set(row.id, record);
          });
          
          const merged = Array.from(recordMap.values()).sort((a: any, b: any) => {
              if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
              return (b.date || 0) - (a.date || 0);
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }

      // --- Pull Recipes ---
      const { data: cloudRecipes, error: err2 } = await supabase.from('dev_recipes').select('*');
      if (!err2 && cloudRecipes) {
          const rawLocal = localStorage.getItem(RECIPE_KEY);
          const localRecipes = rawLocal ? JSON.parse(rawLocal) : [];
          const recipeMap = new Map<string, any>(localRecipes.map((r: any) => [String(r.id), r]));
          
          cloudRecipes.forEach((row: any) => {
              if (pendingRecipeIds.has(row.id)) return;
              const recipe = { ...row.data, id: row.id, _synced: true };
              recipeMap.set(row.id, recipe);
          });
          
          const merged = Array.from(recipeMap.values()).sort((a: any, b: any) => {
              if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
              return (b.createdAt || 0) - (a.createdAt || 0);
          });
          localStorage.setItem(RECIPE_KEY, JSON.stringify(merged));
      }

      // --- Pull Reciprocity Profiles ---
      const { data: cloudProfiles, error: err3 } = await supabase.from('reciprocity_profiles').select('*');
      if (!err3 && cloudProfiles) {
          const rawLocal = localStorage.getItem(PROFILE_KEY);
          const localProfiles = rawLocal ? JSON.parse(rawLocal) : [];
          const profileMap = new Map<string, any>(localProfiles.map((p: any) => [String(p.id), p]));
          
          cloudProfiles.forEach((row: any) => {
              if (pendingProfileIds.has(row.id)) return;
              const profile = { ...row.data, id: row.id, _synced: true };
              profileMap.set(row.id, profile);
          });
          
          const merged = Array.from(profileMap.values()).sort((a: any, b: any) => {
              if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
              return (b.updatedAt || 0) - (a.updatedAt || 0);
          });
          localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
      }
  },

  async processQueue(): Promise<void> {
      if (!supabase) return;
      
      const queueSnapshot = getQueue();
      if (queueSnapshot.length === 0) return;

      console.log(`[Sync] Processing ${queueSnapshot.length} items from cache pool...`);
      let successCount = 0;

      for (const item of queueSnapshot) {
          let table = '';
          if (item.target === 'RECORD') table = 'film_records';
          else if (item.target === 'RECIPE') table = 'dev_recipes';
          else if (item.target === 'PROFILE') table = 'reciprocity_profiles';
          else continue;

          let success = false;
          
          try {
              if (item.action === 'DELETE') {
                  const idStr = String(item.targetId);
                  const { error } = await supabase.from(table).delete().eq('id', idStr);
                  if (error) throw error;
                  success = true;
              } else if (item.action === 'UPSERT') {
                  const payload = {
                      id: String(item.targetId),
                      updated_at: new Date(item.timestamp).toISOString(),
                      data: item.data
                  };
                  const { error } = await supabase.from(table).upsert(payload);
                  if (error) throw error;
                  
                  // Mark as synced locally
                  if (item.target === 'RECORD') {
                      const records = await this.getAll();
                      const updated = records.map(r => r.id === item.targetId ? { ...r, _synced: true } : r);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                  } else if (item.target === 'RECIPE') {
                      const recipes = await this.getRecipes();
                      const updated = recipes.map(r => r.id === item.targetId ? { ...r, _synced: true } : r);
                      localStorage.setItem(RECIPE_KEY, JSON.stringify(updated));
                  } else if (item.target === 'PROFILE') {
                      const profiles = await this.getReciprocityProfiles();
                      const updated = profiles.map(p => p.id === item.targetId ? { ...p, _synced: true } : p);
                      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
                  }
                  success = true;
              }
          } catch (e) {
              console.error(`[Sync] Critical error processing item ${item.id}`, e);
          }

          if (success) {
              removeFromQueue(item.id);
              successCount++;
          }
      }

      console.log(`[Sync] Batch complete. ${successCount}/${queueSnapshot.length} processed.`);
  },
};
