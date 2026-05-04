export type PetMood = 'idle' | 'dragging' | 'happy' | 'sleepy';

export type ThemeMode = 'dark' | 'system';
export type PetAction =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

export type PetManifest = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  author?: string;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
};

export type PetLibraryItem = {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
  manifest: PetManifest;
  source: 'bundled' | 'imported';
};

export type AppSettings = {
  petVisible: boolean;
  sizeScale: number;
  animationSpeed: number;
  currentAction: PetAction;
  cloudEnabled: boolean;
  cloudMessages: string[];
  cloudOffsetX: number;
  cloudOffsetY: number;
  theme: ThemeMode;
  launchAtLogin: boolean;
  soundEnabled: boolean;
  currentPetId: string;
  petPosition: {
    x: number;
    y: number;
  } | null;
};

export type ImportPetResult = {
  ok: boolean;
  message: string;
  pet?: PetLibraryItem;
};

export type SettingsPatch = Partial<Omit<AppSettings, 'petPosition'>> & {
  petPosition?: AppSettings['petPosition'];
};

export type AppSnapshot = {
  settings: AppSettings;
  pets: PetLibraryItem[];
  platform: NodeJS.Platform;
  version: string;
};

export type DragDelta = {
  deltaX: number;
  deltaY: number;
};
