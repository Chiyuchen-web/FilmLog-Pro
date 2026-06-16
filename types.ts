
export type FilmFormat = '135' | '120' | '4x5' | '8x10' | 'Other';
export type DevMethod = 'Hand' | 'Rotary' | 'Machine' | 'Tray' | 'Stand';

// Action Queue Types for Sync
export type SyncActionType = 'UPSERT' | 'DELETE';
export type SyncTarget = 'RECORD' | 'RECIPE' | 'PROFILE';

export interface SyncQueueItem {
  id: string; // Unique ID for the queue item
  targetId: string; // ID of the record/recipe
  target: SyncTarget;
  action: SyncActionType;
  data?: any; // For UPSERT
  timestamp: number;
}

export interface FilmRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  date: number; // Shooting/Record date
  _synced?: boolean; // Track if synced to cloud (Legacy flag, kept for compatibility)
  order?: number; // For manual sorting
  isDeleted?: boolean; // For soft delete (cloud trash bin)

  // Shooting Info
  filmModel: string;
  format: FilmFormat;
  aperture: string;
  shutterSpeed: string;
  flashPower: string;
  location: string;
  locationImage: string | null; // Base64 string
  shootingNotes: string;

  // Developing Info
  devMethod: DevMethod;
  devProcess: string; // e.g. C-41, E-6, BW
  developerModel: string;
  fixerModel: string;
  devDilution: string;
  fixDilution: string;
  isPreWet: boolean;
  devTime: string;
  fixTime: string;
  devNotes: string;
  filmImage: string | null; // Base64 string
}

export type SearchOperator = 'contains' | 'not_contains' | 'equals' | 'not_equals';

export interface SearchFilter {
  id: string;
  field: keyof FilmRecord;
  operator: SearchOperator;
  value: string;
}

export type SortOption = 'date_desc' | 'date_asc' | 'model_asc' | 'model_desc';

export const FILM_FORMATS: FilmFormat[] = ['135', '120', '4x5', '8x10', 'Other'];
export const DEV_METHODS: DevMethod[] = ['Hand', 'Rotary', 'Machine', 'Tray', 'Stand'];

export const DEV_METHOD_LABELS: Record<DevMethod, string> = {
  'Hand': '手冲',
  'Rotary': '滚冲',
  'Machine': '机洗',
  'Tray': '显影盘',
  'Stand': '静置/立冲'
};

export const FIELD_LABELS: Record<string, string> = {
  filmModel: '胶片型号',
  format: '画幅',
  date: '拍摄时间',
  location: '拍摄地点',
  aperture: '光圈',
  shutterSpeed: '快门速度',
  devMethod: '冲洗方式',
  developerModel: '显影药型号',
  devProcess: '冲洗工艺',
  shootingNotes: '拍摄备注',
  devNotes: '冲洗备注',
};

// Timer Types
export type TimerPhaseType = 'prewet' | 'develop' | 'stop' | 'fix' | 'wash' | 'rinse' | 'wait';

export interface AgitationConfig {
  agitationDuration: number; // Duration of shaking
  standDuration: number;    // Duration of standing/resting
}

export interface DeveloperStep {
  id: string;
  name: string; 
  dilution: string; 
  volume: string; // Volume in ml
  duration: number; // seconds
  
  // Agitation Settings per step
  initialAgitation: number; // NEW: Initial agitation in seconds
  agitationDuration: number;
  standDuration: number;
  overrideGlobalAgitation?: boolean; // NEW: If true, use local settings instead of global
  
  // Wait/Pour Settings per step
  overridePourTime?: boolean; // NEW: Override global pour time
  pourTime?: number; // NEW: Specific pour time for this step
}

export interface TimerConfig {
  processName?: string;
  filmModel?: string; 
  devMethod: DevMethod;
  devLoopCount: number;

  // Global Agitation Settings
  globalAgitationEnabled?: boolean; // NEW
  globalInitialAgitation?: number; // NEW
  globalAgitationDuration?: number; // NEW
  globalStandDuration?: number; // NEW
  
  // NEW: Wait/Pour Phase
  enablePourTime?: boolean;
  pourTime?: number;
  
  // NEW: Agitation Logic Option
  skipInitialAgitationOnLoop?: boolean;

  // Pre-Wet
  enablePreWet: boolean;
  preWetName: string;
  preWetDilution: string;
  preWetVolume: string;
  preWetTime: number;

  // Developer
  developerSteps: DeveloperStep[];

  // Stop Bath
  enableStopBath: boolean;
  stopBathName: string;
  stopBathDilution: string;
  stopBathVolume: string;
  stopTime: number;

  // Fixer
  fixerName: string;
  fixerDilution: string;
  fixerVolume: string;
  fixTime: number;
  // Fixer Agitation
  fixInitialAgitation: number;
  fixAgitationDuration: number;
  fixStandDuration: number;
  fixOverrideGlobalAgitation?: boolean; // NEW

  // Wash / Wetting Agent
  washName: string; // usually water
  washDilution: string;
  washVolume: string;
  washTime: number;
  enableWettingAgent: boolean; // Logical toggle for the "Phase", usually integrated into Wash or last step
  wettingAgentName: string; // e.g. Photo-flo (added to wash)
  wettingAgentDilution: string;
  wettingAgentVolume: string;
}

export interface DevRecipe {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  notes: string;
  rating?: number; // Added rating field
  config: TimerConfig;
  _synced?: boolean;
  order?: number;
}

// Reciprocity Data Types
export interface ReciprocityDataPoint {
  id: string;
  measured: string;
  actual: string;
}

export type ReciprocityStrategy = 'power' | 'polynomial';

export interface ReciprocityProfile {
  id: string;
  name: string; // Film Model Name
  
  // Strategy
  strategy?: ReciprocityStrategy; // Default 'power' if undefined

  // Power Law (Standard)
  pFactor: string;
  
  // Polynomial (Advanced)
  polyA?: string;
  polyB?: string;
  polyC?: string;

  threshold: string;
  dataPoints: ReciprocityDataPoint[];
  updatedAt: number;
  _synced?: boolean;
  order?: number;
}
