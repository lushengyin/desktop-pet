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

export type PetActionDefinition = {
  id: string;
  label: string;
  row: number;
  frames?: number;
};

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
  actionLabels?: Partial<Record<PetAction, string>>;
  actionFrameCounts?: Partial<Record<PetAction, number>>;
  actions?: PetActionDefinition[];
};

export type PetLibraryItem = {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
  manifest: PetManifest;
  source: 'bundled' | 'imported';
};

export type CompanionBubbleMode = 'manual' | 'companion' | 'mixed';
export type CompanionProvider = 'disabled' | 'openai-compatible' | 'deepseek' | 'glm';

export type CompanionModelConfig = {
  id: string;
  name: string;
  provider: CompanionProvider;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

export type CompanionSettings = {
  enabled: boolean;
  memoryEnabled: boolean;
  proactiveEnabled: boolean;
  bubbleMode: CompanionBubbleMode;
  replyFrequencyMinutes: number;
  activeModelConfigId: string;
  modelConfigs: CompanionModelConfig[];
  provider: CompanionProvider;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

export type CompanionMessage = {
  id: string;
  petId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type CompanionMemory = {
  petId: string;
  summary: string;
  facts: string[];
  updatedAt: string | null;
};

export type CompanionPersona = {
  petId: string;
  nickname: string;
  personality: string;
  tone: string;
  relationship: string;
  speakingStyle: string;
  updatedAt: string | null;
};

export type CompanionStatus = {
  configured: boolean;
  lastError: string | null;
};

export type CompanionSnapshot = {
  currentPetMemory: CompanionMemory;
  currentPetPersona: CompanionPersona;
  recentMessages: CompanionMessage[];
  status: CompanionStatus;
};

export type AppSettings = {
  petVisible: boolean;
  sizeScale: number;
  animationSpeed: number;
  currentAction: string;
  cloudEnabled: boolean;
  cloudMessages: string[];
  cloudOffsetX: number;
  cloudOffsetY: number;
  theme: ThemeMode;
  launchAtLogin: boolean;
  showMenuBarIcon: boolean;
  soundEnabled: boolean;
  currentPetId: string;
  companion: CompanionSettings;
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

export type DeletePetResult = {
  ok: boolean;
  message: string;
  snapshot?: AppSnapshot;
};

export type SettingsPatch = Partial<Omit<AppSettings, 'petPosition'>> & {
  petPosition?: AppSettings['petPosition'];
};

export type AppSnapshot = {
  settings: AppSettings;
  pets: PetLibraryItem[];
  companion: CompanionSnapshot;
  platform: NodeJS.Platform;
  version: string;
};

export type DragDelta = {
  deltaX: number;
  deltaY: number;
};

export type CompanionSendMessageRequest = {
  content: string;
};

export type CompanionReplyResult = {
  ok: boolean;
  message: string;
  reply?: CompanionMessage;
  snapshot: CompanionSnapshot;
};

export type CompanionClearMemoryResult = {
  ok: boolean;
  message: string;
  snapshot: CompanionSnapshot;
};

export type CompanionTestProviderResult = {
  ok: boolean;
  message: string;
  snapshot: CompanionSnapshot;
};

export type CompanionUpdatePersonaResult = {
  ok: boolean;
  message: string;
  snapshot: CompanionSnapshot;
};

export type PetInteractiveRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};
