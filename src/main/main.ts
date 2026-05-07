import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AppSettings,
  AppSnapshot,
  CompanionClearMemoryResult,
  CompanionMemory,
  CompanionMessage,
  CompanionModelConfig,
  CompanionPersona,
  CompanionProvider,
  CompanionReplyResult,
  CompanionSettings,
  CompanionSnapshot,
  CompanionTestProviderResult,
  CompanionUpdatePersonaResult,
  DeletePetResult,
  DragDelta,
  ImportPetResult,
  PetInteractiveRegion,
  PetLibraryItem,
  PetManifest,
  SettingsPatch
} from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isSmokeTest = process.env.LULU_SMOKE_TEST === '1';
const isDev = !app.isPackaged && !isSmokeTest;
const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const appRoot = path.resolve(__dirname, '../..');
const bundledPetsRoot = isDev
  ? path.join(appRoot, 'public/pets')
  : path.join(appRoot, 'dist/pets');
const trayIconPath = isDev
  ? path.join(appRoot, 'build/tray.png')
  : path.join(process.resourcesPath, 'tray.png');
const maxCompanionMessagesPerPet = 40;
const defaultModelConfigId = 'default-model';

const defaultSettings: AppSettings = {
  petVisible: true,
  sizeScale: 1,
  animationSpeed: 1,
  currentAction: 'idle',
  cloudEnabled: true,
  cloudMessages: [
    '人，你真棒！',
    '人，累了记得休息，我会一直陪着你'
  ],
  cloudOffsetX: 0,
  cloudOffsetY: 0,
  theme: 'dark',
  launchAtLogin: false,
  showMenuBarIcon: true,
  soundEnabled: true,
  currentPetId: 'lulu',
  companion: {
    enabled: false,
    memoryEnabled: true,
    proactiveEnabled: false,
    bubbleMode: 'manual',
    replyFrequencyMinutes: 20,
    activeModelConfigId: defaultModelConfigId,
    modelConfigs: [
      {
        id: defaultModelConfigId,
        name: '默认模型',
        provider: 'disabled',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4.1-mini'
      }
    ],
    provider: 'disabled',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4.1-mini'
  },
  petPosition: null
};
let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dragging = false;
let lastDragPersist = 0;
let petMousePassthrough = false;
let petCursorProbeTimer: NodeJS.Timeout | null = null;
let petInteractiveRegions: PetInteractiveRegion[] = [];
let lastCompanionError: string | null = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function importedPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
}

function companionDir() {
  return path.join(app.getPath('userData'), 'companion');
}

function petCompanionDir(petId: string) {
  return path.join(companionDir(), sanitizeFileName(petId));
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sanitizeCompanionSettings(value: Partial<CompanionSettings> | undefined): CompanionSettings {
  const merged = { ...defaultSettings.companion, ...(value ?? {}) };
  const bubbleModes = new Set(['manual', 'companion', 'mixed']);
  const providers = new Set(['disabled', 'openai-compatible', 'deepseek', 'glm']);
  const legacyConfig: CompanionModelConfig = {
    id: defaultModelConfigId,
    name: '默认模型',
    provider: providers.has(merged.provider) ? merged.provider : 'disabled',
    apiBaseUrl: typeof merged.apiBaseUrl === 'string' && merged.apiBaseUrl.trim()
      ? merged.apiBaseUrl.trim().replace(/\/+$/, '')
      : defaultSettings.companion.apiBaseUrl,
    apiKey: typeof merged.apiKey === 'string' ? merged.apiKey.trim() : '',
    model: typeof merged.model === 'string' && merged.model.trim()
      ? merged.model.trim()
      : defaultSettings.companion.model
  };
  const rawConfigs = Array.isArray(merged.modelConfigs) && merged.modelConfigs.length > 0
    ? merged.modelConfigs
    : [legacyConfig];
  const modelConfigs = rawConfigs
    .map((config, index) => sanitizeModelConfig(config, index))
    .filter((config): config is CompanionModelConfig => Boolean(config))
    .slice(0, 12);
  const safeConfigs = modelConfigs.length > 0 ? modelConfigs : [legacyConfig];
  const activeModelConfigId = typeof merged.activeModelConfigId === 'string' &&
    safeConfigs.some((config) => config.id === merged.activeModelConfigId)
    ? merged.activeModelConfigId
    : safeConfigs[0].id;
  const activeConfig = safeConfigs.find((config) => config.id === activeModelConfigId) ?? safeConfigs[0];
  return {
    enabled: Boolean(merged.enabled),
    memoryEnabled: Boolean(merged.memoryEnabled),
    proactiveEnabled: Boolean(merged.proactiveEnabled),
    bubbleMode: bubbleModes.has(merged.bubbleMode) ? merged.bubbleMode : defaultSettings.companion.bubbleMode,
    replyFrequencyMinutes: clamp(Number(merged.replyFrequencyMinutes) || defaultSettings.companion.replyFrequencyMinutes, 0.001, 240),
    activeModelConfigId,
    modelConfigs: safeConfigs,
    provider: activeConfig.provider,
    apiBaseUrl: activeConfig.apiBaseUrl,
    apiKey: activeConfig.apiKey,
    model: activeConfig.model
  };
}

function sanitizeModelConfig(value: Partial<CompanionModelConfig>, index: number): CompanionModelConfig | null {
  const providers = new Set(['disabled', 'openai-compatible', 'deepseek', 'glm']);
  const provider = typeof value.provider === 'string' && providers.has(value.provider)
    ? value.provider as CompanionProvider
    : 'disabled';
  const id = typeof value.id === 'string' && value.id.trim()
    ? sanitizeFileName(value.id.trim()).slice(0, 60)
    : `model-${index + 1}`;
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim()
      ? value.name.trim().slice(0, 40)
      : `模型 ${index + 1}`,
    provider,
    apiBaseUrl: typeof value.apiBaseUrl === 'string' && value.apiBaseUrl.trim()
      ? value.apiBaseUrl.trim().replace(/\/+$/, '')
      : defaultSettings.companion.apiBaseUrl,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey.trim() : '',
    model: typeof value.model === 'string' && value.model.trim()
      ? value.model.trim().slice(0, 80)
      : defaultSettings.companion.model
  };
}

function sanitizeSettings(value: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultSettings, ...value };
  const cloudMessages = Array.isArray(merged.cloudMessages)
    ? merged.cloudMessages
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12)
    : defaultSettings.cloudMessages;
  return {
    ...merged,
    petVisible: Boolean(merged.petVisible),
    sizeScale: clamp(Number(merged.sizeScale) || defaultSettings.sizeScale, 0.5, 2.5),
    animationSpeed: clamp(Number(merged.animationSpeed) || defaultSettings.animationSpeed, 0.5, 2),
    currentAction: typeof merged.currentAction === 'string' && merged.currentAction.trim()
      ? merged.currentAction.trim()
      : defaultSettings.currentAction,
    cloudEnabled: Boolean(merged.cloudEnabled),
    cloudMessages: cloudMessages.length > 0 ? cloudMessages : defaultSettings.cloudMessages,
    cloudOffsetX: clamp(Number(merged.cloudOffsetX) || defaultSettings.cloudOffsetX, -80, 80),
    cloudOffsetY: clamp(Number(merged.cloudOffsetY) || defaultSettings.cloudOffsetY, -80, 80),
    theme: merged.theme === 'system' ? 'system' : 'dark',
    launchAtLogin: Boolean(merged.launchAtLogin),
    showMenuBarIcon: merged.showMenuBarIcon !== false,
    soundEnabled: Boolean(merged.soundEnabled),
    currentPetId: typeof merged.currentPetId === 'string' ? merged.currentPetId : 'lulu',
    companion: sanitizeCompanionSettings(merged.companion),
    petPosition: merged.petPosition && Number.isFinite(merged.petPosition.x) && Number.isFinite(merged.petPosition.y)
      ? { x: merged.petPosition.x, y: merged.petPosition.y }
      : null
  };
}

function getSettings(): AppSettings {
  return sanitizeSettings(readJson<Partial<AppSettings>>(settingsPath(), defaultSettings));
}

function saveSettings(settings: AppSettings) {
  writeJson(settingsPath(), sanitizeSettings(settings));
  broadcastSettings();
}

function patchSettings(patch: SettingsPatch): AppSettings {
  const settings = sanitizeSettings({ ...getSettings(), ...patch });
  saveSettings(settings);
  applySettings(settings);
  return settings;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_') || 'pet';
}

function petSpriteSize(scale = getSettings().sizeScale) {
  return {
    width: Math.round(192 * scale),
    height: Math.round(208 * scale)
  };
}

function petCloudInsets(scale = getSettings().sizeScale) {
  void scale;
  return {
    top: 118,
    right: 168
  };
}

function petWindowBoundsFromSpritePosition(x: number, y: number, scale = getSettings().sizeScale) {
  const sprite = petSpriteSize(scale);
  const insets = petCloudInsets(scale);
  return {
    x: Math.round(x),
    y: Math.round(y - insets.top),
    width: sprite.width + insets.right,
    height: sprite.height + insets.top
  };
}

function defaultPetPosition() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = petSpriteSize();
  return {
    x: Math.round(display.workArea.x + display.workArea.width - width - 48),
    y: Math.round(display.workArea.y + display.workArea.height - height - 56)
  };
}

function boundedPosition(x: number, y: number) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const { width, height } = petSpriteSize();
  const area = display.workArea;
  return {
    x: Math.round(clamp(x, area.x, area.x + area.width - width)),
    y: Math.round(clamp(y, area.y, area.y + area.height - height))
  };
}

function createPetWindow() {
  const settings = getSettings();
  const position = settings.petPosition ?? defaultPetPosition();
  const bounds = petWindowBoundsFromSpritePosition(position.x, position.y, settings.sizeScale);

  petWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setAlwaysOnTop(true, 'floating');
  setPetMousePassthrough(true);
  startPetCursorProbe();

  void loadRenderer(petWindow, 'pet');

  petWindow.once('ready-to-show', () => {
    if (getSettings().petVisible) {
      petWindow?.showInactive();
    }
  });

  petWindow.on('closed', () => {
    stopPetCursorProbe();
    petWindow = null;
    petMousePassthrough = false;
  });
}

function setPetMousePassthrough(passthrough: boolean) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const next = dragging ? false : passthrough;
  if (petMousePassthrough === next) return;
  petMousePassthrough = next;
  petWindow.setIgnoreMouseEvents(next, { forward: true });
}

function startPetCursorProbe() {
  if (petCursorProbeTimer) return;
  petCursorProbeTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      stopPetCursorProbe();
      return;
    }
    if (dragging) {
      setPetMousePassthrough(false);
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    const inside = cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height;
    if (!inside) {
      setPetMousePassthrough(true);
      return;
    }
    const settings = getSettings();
    const sprite = petSpriteSize(settings.sizeScale);
    const insets = petCloudInsets(settings.sizeScale);
    const localX = cursor.x - bounds.x;
    const localY = cursor.y - bounds.y;
    const overSprite = localX >= 0 &&
      localX <= sprite.width &&
      localY >= insets.top &&
      localY <= insets.top + sprite.height;
    const overInteractiveRegion = petInteractiveRegions.some((region) => isPointInInteractiveRegion(localX, localY, region));
    setPetMousePassthrough(!overSprite && !overInteractiveRegion);
  }, 40);
}

function isPointInInteractiveRegion(x: number, y: number, region: PetInteractiveRegion) {
  if (
    x < region.x ||
    x > region.x + region.width ||
    y < region.y ||
    y > region.y + region.height
  ) {
    return false;
  }
  const radius = Math.min(region.radius ?? 0, region.width / 2, region.height / 2);
  if (radius <= 0) return true;
  const innerLeft = region.x + radius;
  const innerRight = region.x + region.width - radius;
  const innerTop = region.y + radius;
  const innerBottom = region.y + region.height - radius;
  if ((x >= innerLeft && x <= innerRight) || (y >= innerTop && y <= innerBottom)) {
    return true;
  }
  const cornerX = x < innerLeft ? innerLeft : innerRight;
  const cornerY = y < innerTop ? innerTop : innerBottom;
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 <= radius ** 2;
}

function stopPetCursorProbe() {
  if (!petCursorProbeTimer) return;
  clearInterval(petCursorProbeTimer);
  petCursorProbeTimer = null;
}

function createSettingsWindow() {
  const revealSettingsWindow = (window: BrowserWindow) => {
    // macOS: Mission Control / app switcher can sometimes fail to focus the window
    // when another Electron app is frontmost. A brief always-on-top toggle brings it forward reliably.
    window.setAlwaysOnTop(true, 'modal-panel');
    window.show();
    window.focus();
    setTimeout(() => {
      if (!window.isDestroyed()) {
        window.setAlwaysOnTop(false);
      }
    }, 280);
  };

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    revealSettingsWindow(settingsWindow);
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    title: '桌边小伴 设置',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1d1d1f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  void loadRenderer(settingsWindow, 'settings');

  settingsWindow.once('ready-to-show', () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    revealSettingsWindow(settingsWindow);
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

async function loadRenderer(window: BrowserWindow, route: 'pet' | 'settings') {
  if (isDev) {
    await window.loadURL(`${rendererUrl}/#/${route}`);
    return;
  }
  await window.loadFile(path.join(appRoot, 'dist/index.html'), { hash: `/${route}` });
}

function applySettings(settings = getSettings()) {
  if (petWindow && !petWindow.isDestroyed()) {
    const current = petWindow.getBounds();
    const currentInsets = petCloudInsets(settings.sizeScale);
    const source = settings.petPosition ?? { x: current.x, y: current.y + currentInsets.top };
    const next = boundedPosition(source.x, source.y);
    petWindow.setBounds(petWindowBoundsFromSpritePosition(next.x, next.y, settings.sizeScale), false);
    if (settings.petVisible) {
      petWindow.showInactive();
    } else {
      petWindow.hide();
    }
  }
  if (!isSmokeTest) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }
  syncTray(settings);
}

function broadcastSettings() {
  const settings = getSettings();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('settings:changed', settings);
  }
}

function broadcastPets() {
  const snapshot = getSnapshot();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('pets:changed', snapshot);
  }
}

function broadcastCompanion() {
  const companion = getCompanionSnapshot(getSettings().currentPetId);
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('companion:changed', companion);
  }
}

function normalizedPet(manifest: PetManifest, petDir: string, source: 'bundled' | 'imported'): PetLibraryItem {
  return {
    id: manifest.id,
    displayName: manifest.displayName || manifest.id,
    description: manifest.description || '',
    manifest: {
      frameWidth: 192,
      frameHeight: 208,
      columns: 8,
      rows: 9,
      ...manifest
    },
    spritesheetUrl: pathToFileUrl(path.join(petDir, manifest.spritesheetPath)),
    source
  };
}

function bundledPets(): PetLibraryItem[] {
  if (!fs.existsSync(bundledPetsRoot)) return [];
  return fs.readdirSync(bundledPetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const petDir = path.join(bundledPetsRoot, entry.name);
      const manifest = readJson<PetManifest | null>(path.join(petDir, 'pet.json'), null);
      if (!manifest?.id || !manifest.spritesheetPath) return [];
      return [normalizedPet(manifest, petDir, 'bundled')];
    });
}

function importedPets(): PetLibraryItem[] {
  const dir = importedPetsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const petDir = path.join(dir, entry.name);
      const manifest = readJson<PetManifest | null>(path.join(petDir, 'pet.json'), null);
      if (!manifest?.id || !manifest.spritesheetPath) return [];
      return [normalizedPet(manifest, petDir, 'imported')];
    });
}

function petLibrary(): PetLibraryItem[] {
  const fallbackManifest: PetManifest = {
    id: 'lulu',
    displayName: '噜噜',
    description: '一只圆滚滚的黄色小河马伙伴。',
    spritesheetPath: 'spritesheet.webp'
  };
  const luluFallbackDir = path.join(bundledPetsRoot, 'lulu');
  const base = fs.existsSync(path.join(luluFallbackDir, 'pet.json'))
    ? []
    : [normalizedPet(fallbackManifest, luluFallbackDir, 'bundled')];
  const pets = [...base, ...bundledPets(), ...importedPets()];
  const byId = new Map<string, PetLibraryItem>();
  for (const pet of pets) byId.set(pet.id, pet);
  return [...byId.values()];
}

function defaultMemory(petId: string): CompanionMemory {
  return {
    petId,
    summary: '',
    facts: [],
    updatedAt: null
  };
}

function memoryPath(petId: string) {
  return path.join(petCompanionDir(petId), 'memory.json');
}

function messagesPath(petId: string) {
  return path.join(petCompanionDir(petId), 'messages.json');
}

function personaPath(petId: string) {
  return path.join(petCompanionDir(petId), 'persona.json');
}

function getMemory(petId: string): CompanionMemory {
  const memory = readJson<CompanionMemory>(memoryPath(petId), defaultMemory(petId));
  return {
    petId,
    summary: typeof memory.summary === 'string' ? memory.summary : '',
    facts: Array.isArray(memory.facts)
      ? memory.facts.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : [],
    updatedAt: typeof memory.updatedAt === 'string' ? memory.updatedAt : null
  };
}

function saveMemory(memory: CompanionMemory) {
  writeJson(memoryPath(memory.petId), memory);
}

function defaultPersona(petId: string, pet?: PetLibraryItem): CompanionPersona {
  return {
    petId,
    nickname: pet?.displayName ?? '',
    personality: '温柔、亲近、有一点撒娇，会主动关心用户。',
    tone: '自然、简短、像熟悉的人在身边说话。',
    relationship: '长期陪伴用户的桌面伙伴，关系亲密但不过度冒犯。',
    speakingStyle: '每次回复尽量短，适合显示在桌面气泡里，不说教。',
    updatedAt: null
  };
}

function sanitizePersona(value: Partial<CompanionPersona>, petId: string, pet?: PetLibraryItem): CompanionPersona {
  const fallback = defaultPersona(petId, pet);
  const text = (input: unknown, fallbackValue: string, limit = 220) => (
    typeof input === 'string' && input.trim() ? input.trim().slice(0, limit) : fallbackValue
  );
  return {
    petId,
    nickname: text(value.nickname, fallback.nickname, 40),
    personality: text(value.personality, fallback.personality),
    tone: text(value.tone, fallback.tone),
    relationship: text(value.relationship, fallback.relationship),
    speakingStyle: text(value.speakingStyle, fallback.speakingStyle),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt
  };
}

function getPersona(petId: string): CompanionPersona {
  const pet = petLibrary().find((item) => item.id === petId);
  return sanitizePersona(readJson<Partial<CompanionPersona>>(personaPath(petId), defaultPersona(petId, pet)), petId, pet);
}

function savePersona(persona: CompanionPersona) {
  writeJson(personaPath(persona.petId), persona);
}

function getMessages(petId: string): CompanionMessage[] {
  const messages = readJson<CompanionMessage[]>(messagesPath(petId), []);
  return Array.isArray(messages)
    ? messages
      .filter((item) => item && item.petId === petId && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-maxCompanionMessagesPerPet)
    : [];
}

function saveMessages(petId: string, messages: CompanionMessage[]) {
  writeJson(messagesPath(petId), messages.slice(-maxCompanionMessagesPerPet));
}

function appendMessage(petId: string, role: CompanionMessage['role'], content: string) {
  const message: CompanionMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    petId,
    role,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  const messages = [...getMessages(petId), message].slice(-maxCompanionMessagesPerPet);
  saveMessages(petId, messages);
  return message;
}

function getCompanionSnapshot(petId = getSettings().currentPetId): CompanionSnapshot {
  const settings = getSettings();
  return {
    currentPetMemory: getMemory(petId),
    currentPetPersona: getPersona(petId),
    recentMessages: getMessages(petId).slice(-20),
    status: {
      configured: settings.companion.provider !== 'disabled' && Boolean(settings.companion.apiBaseUrl && settings.companion.apiKey && settings.companion.model),
      lastError: lastCompanionError
    }
  };
}

function getSnapshot(): AppSnapshot {
  const settings = getSettings();
  const pets = petLibrary();
  if (!pets.some((pet) => pet.id === settings.currentPetId)) {
    settings.currentPetId = 'lulu';
    saveSettings(settings);
  }
  return {
    settings,
    pets,
    companion: getCompanionSnapshot(settings.currentPetId),
    platform: process.platform,
    version: app.getVersion()
  };
}

function pathToFileUrl(filePath: string) {
  return new URL(`file://${filePath}`).toString();
}

function validatePetSource(sourceDir: string): { manifest: PetManifest; spritesheet: string } {
  const manifestFile = path.join(sourceDir, 'pet.json');
  const manifest = readJson<PetManifest | null>(manifestFile, null);
  if (!manifest?.id || !manifest.displayName || !manifest.spritesheetPath) {
    throw new Error('pet.json 需要包含 id、displayName 和 spritesheetPath。');
  }
  const spritesheet = path.join(sourceDir, manifest.spritesheetPath);
  if (!fs.existsSync(spritesheet)) {
    throw new Error(`找不到精灵表：${manifest.spritesheetPath}`);
  }
  return { manifest, spritesheet };
}

async function importPet(): Promise<ImportPetResult> {
  const options: Electron.OpenDialogOptions = {
    title: '选择宠物资源文件夹',
    properties: ['openDirectory']
  };
  const result = settingsWindow && !settingsWindow.isDestroyed()
    ? await dialog.showOpenDialog(settingsWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, message: '已取消导入。' };
  }

  try {
    const sourceDir = result.filePaths[0];
    const { manifest, spritesheet } = validatePetSource(sourceDir);
    const targetDir = path.join(importedPetsDir(), manifest.id);
    ensureDir(targetDir);
    fs.copyFileSync(path.join(sourceDir, 'pet.json'), path.join(targetDir, 'pet.json'));
    fs.copyFileSync(spritesheet, path.join(targetDir, path.basename(manifest.spritesheetPath)));
    const savedManifest = {
      frameWidth: 192,
      frameHeight: 208,
      columns: 8,
      rows: 9,
      ...manifest,
      spritesheetPath: path.basename(manifest.spritesheetPath)
    };
    writeJson(path.join(targetDir, 'pet.json'), savedManifest);
    const settings = patchSettings({ currentPetId: savedManifest.id });
    const pet = petLibrary().find((item) => item.id === settings.currentPetId);
    broadcastPets();
    return pet
      ? { ok: true, message: `已导入 ${pet.displayName}。`, pet }
      : { ok: true, message: '宠物已导入。' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '导入失败。'
    };
  }
}

function deletePet(petId: string): DeletePetResult {
  const pet = petLibrary().find((item) => item.id === petId);
  if (!pet) {
    return { ok: false, message: '找不到这个宠物。' };
  }
  if (pet.source !== 'imported') {
    return { ok: false, message: '内置宠物不能删除。' };
  }

  const targetDir = path.join(importedPetsDir(), pet.id);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  const pets = petLibrary();
  const fallbackPet = pets.find((item) => item.source === 'bundled') ?? pets[0];
  const settings = getSettings();
  if (settings.currentPetId === pet.id && fallbackPet) {
    patchSettings({ currentPetId: fallbackPet.id });
  }
  broadcastPets();
  return { ok: true, message: `已删除 ${pet.displayName}。`, snapshot: getSnapshot() };
}

function currentPetForCompanion() {
  const settings = getSettings();
  return petLibrary().find((item) => item.id === settings.currentPetId);
}

function localCompanionReply(input: string, proactive = false) {
  const pet = currentPetForCompanion();
  const name = pet?.displayName ?? '我';
  const short = input.trim().slice(0, 40);
  if (proactive) {
    return `${name}想你啦。现在要不要休息一下，或者和我说说你在忙什么？`;
  }
  if (!short) return `${name}在这里，想听你说话。`;
  return `我听到了：“${short}”。我还没接上模型服务，但会先把这次聊天记在本地。`;
}

function updateMemoryFromTurn(petId: string, userInput: string, assistantReply: string) {
  const settings = getSettings();
  if (!settings.companion.memoryEnabled) return;
  const memory = getMemory(petId);
  const normalizedInput = userInput.trim();
  const shouldStoreUserFact = normalizedInput &&
    normalizedInput !== '角色主动说话' &&
    !normalizedInput.startsWith('请主动');
  const fact = shouldStoreUserFact ? normalizedInput.slice(0, 72) : '';
  const facts = fact
    ? [fact, ...memory.facts.filter((item) => item !== fact)].slice(0, 8)
    : memory.facts;
  const summary = facts.length > 0
    ? `已记录 ${facts.length} 条关于用户的偏好和互动线索。最近：${facts.slice(0, 3).join('；')}`
    : memory.summary;
  void assistantReply;
  saveMemory({
    petId,
    facts,
    summary: summary.slice(0, 220),
    updatedAt: new Date().toISOString()
  });
}

function companionSystemPrompt(pet: PetLibraryItem | undefined, memory: CompanionMemory, persona: CompanionPersona, proactive: boolean) {
  const name = persona.nickname || pet?.displayName || '桌边小伴';
  const description = pet?.description ?? '一个陪伴用户的桌面宠物。';
  const facts = memory.facts.length ? memory.facts.map((item) => `- ${item}`).join('\n') : '暂无';
  return [
    `你是桌面宠物角色“${name}”。${description}`,
    `性格：${persona.personality}`,
    `语气：${persona.tone}`,
    `关系定位：${persona.relationship}`,
    `说话风格：${persona.speakingStyle}`,
    '你在和用户长期相处，有陪伴感，但不要过度夸张。',
    proactive ? '这次是你主动开口，请用一句轻柔的话开启互动。' : '请直接回复用户当前消息。',
    '回复不超过 80 个中文字符，适合显示在桌面气泡或小聊天框里。',
    `这个角色自己的长期记忆：\n${memory.summary || '暂无'}`,
    `关键事实：\n${facts}`
  ].join('\n\n');
}

async function callOpenAiCompatible(settings: CompanionSettings, messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.8,
      max_tokens: 180
    })
  });
  if (!response.ok) {
    throw new Error(`模型服务返回 ${response.status}`);
  }
  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('模型没有返回可展示内容。');
  return content.slice(0, 240);
}

async function generateCompanionReply(userInput: string, proactive = false) {
  const settings = getSettings();
  const petId = settings.currentPetId;
  const pet = currentPetForCompanion();
  const memory = getMemory(petId);
  const persona = getPersona(petId);
  const history = getMessages(petId).slice(-10).map((message) => ({
    role: message.role,
    content: message.content
  }));

  if (settings.companion.provider === 'disabled' || !settings.companion.apiBaseUrl || !settings.companion.apiKey || !settings.companion.model) {
    lastCompanionError = settings.companion.provider === 'disabled' ? null : '模型/API 尚未配置完整，已使用本地回退回复。';
    return localCompanionReply(userInput, proactive);
  }

  const messages = [
    { role: 'system' as const, content: companionSystemPrompt(pet, memory, persona, proactive) },
    ...history,
    { role: 'user' as const, content: proactive ? '请主动对我说一句话。' : userInput }
  ];
  try {
    const reply = await callOpenAiCompatible(settings.companion, messages);
    lastCompanionError = null;
    return reply;
  } catch (error) {
    lastCompanionError = error instanceof Error ? error.message : '模型服务调用失败。';
    return localCompanionReply(userInput, proactive);
  }
}

async function sendCompanionMessage(content: string): Promise<CompanionReplyResult> {
  const text = content.trim();
  if (!text) {
    return { ok: false, message: '先输入一句想说的话。', snapshot: getCompanionSnapshot() };
  }
  const settings = getSettings();
  const petId = settings.currentPetId;
  appendMessage(petId, 'user', text);
  const replyText = await generateCompanionReply(text);
  const reply = appendMessage(petId, 'assistant', replyText);
  updateMemoryFromTurn(petId, text, replyText);
  broadcastCompanion();
  return { ok: true, message: '已回复。', reply, snapshot: getCompanionSnapshot(petId) };
}

async function proactiveCompanionMessage(): Promise<CompanionReplyResult> {
  const settings = getSettings();
  if (!settings.companion.enabled || !settings.companion.proactiveEnabled) {
    return { ok: false, message: '主动回复未开启。', snapshot: getCompanionSnapshot() };
  }
  const petId = settings.currentPetId;
  const replyText = await generateCompanionReply('', true);
  const reply = appendMessage(petId, 'assistant', replyText);
  updateMemoryFromTurn(petId, '角色主动说话', replyText);
  broadcastCompanion();
  return { ok: true, message: '角色主动说话。', reply, snapshot: getCompanionSnapshot(petId) };
}

async function testCompanionProvider(): Promise<CompanionTestProviderResult> {
  const settings = getSettings();
  if (settings.companion.provider === 'disabled') {
    lastCompanionError = '请选择一个模型服务。';
    return { ok: false, message: lastCompanionError, snapshot: getCompanionSnapshot() };
  }
  if (!settings.companion.apiBaseUrl || !settings.companion.apiKey || !settings.companion.model) {
    lastCompanionError = '请填写 API Base URL、模型和 API Key。';
    return { ok: false, message: lastCompanionError, snapshot: getCompanionSnapshot() };
  }
  try {
    await callOpenAiCompatible(settings.companion, [
      { role: 'system', content: '你是连接测试助手。' },
      { role: 'user', content: '请只回复 OK。' }
    ]);
    lastCompanionError = null;
    const snapshot = getCompanionSnapshot();
    broadcastCompanion();
    return { ok: true, message: '模型服务连接成功。', snapshot };
  } catch (error) {
    lastCompanionError = error instanceof Error ? error.message : '模型服务连接失败。';
    const snapshot = getCompanionSnapshot();
    broadcastCompanion();
    return { ok: false, message: `连接失败：${lastCompanionError}`, snapshot };
  }
}

function clearCompanionMemory(): CompanionClearMemoryResult {
  const petId = getSettings().currentPetId;
  saveMemory(defaultMemory(petId));
  saveMessages(petId, []);
  broadcastCompanion();
  return { ok: true, message: '已清除当前角色的记忆和聊天记录。', snapshot: getCompanionSnapshot(petId) };
}

function updateCompanionPersona(personaPatch: Partial<CompanionPersona>): CompanionUpdatePersonaResult {
  const petId = getSettings().currentPetId;
  const current = getPersona(petId);
  const next = sanitizePersona({
    ...current,
    ...personaPatch,
    petId,
    updatedAt: new Date().toISOString()
  }, petId, currentPetForCompanion());
  savePersona(next);
  broadcastCompanion();
  return { ok: true, message: '角色设定已保存。', snapshot: getCompanionSnapshot(petId) };
}

function updateTray() {
  if (!tray) return;
  const settings = getSettings();
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  tray.setImage(icon.isEmpty() ? nativeImage.createFromNamedImage('NSStatusAvailable') : icon);
  tray.setToolTip('Desk Buddy');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开设置', click: createSettingsWindow },
    {
      label: settings.petVisible ? '隐藏宠物' : '显示宠物',
      click: () => patchSettings({ petVisible: !settings.petVisible })
    },
    { label: '重置位置', click: resetPetPosition },
    { type: 'separator' },
    { label: '打开用户数据目录', click: () => void shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));
}

function syncTray(settings = getSettings()) {
  if (!settings.showMenuBarIcon) {
    destroyTray();
    return;
  }
  if (!tray) {
    createTray();
    return;
  }
  updateTray();
}

function createTray() {
  if (tray) {
    updateTray();
    return;
  }
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromNamedImage('NSStatusAvailable') : icon);
  updateTray();
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });
}

function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
        label: app.name,
        submenu: [
          { label: '打开设置', accelerator: 'CmdOrCtrl+,', click: createSettingsWindow },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const }
        ]
      }]
      : []),
    {
      label: '桌边小伴',
      submenu: [
        { label: '打开设置', accelerator: process.platform === 'darwin' ? undefined : 'CmdOrCtrl+,', click: createSettingsWindow },
        {
          label: '显示/隐藏宠物',
          click: () => patchSettings({ petVisible: !getSettings().petVisible })
        },
        { label: '重置位置', click: resetPetPosition }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function resetPetPosition() {
  const position = boundedPosition(defaultPetPosition().x, defaultPetPosition().y);
  const settings = sanitizeSettings({ ...getSettings(), petPosition: position, petVisible: true });
  saveSettings(settings);
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setBounds(petWindowBoundsFromSpritePosition(position.x, position.y, settings.sizeScale), false);
    petWindow.showInactive();
  }
  applySettings(settings);
  return settings;
}

function registerIpc() {
  ipcMain.handle('app:getSnapshot', () => getSnapshot());
  ipcMain.handle('settings:update', (_event, patch: SettingsPatch) => patchSettings(patch));
  ipcMain.handle('settings:reset', () => {
    const reset = { ...defaultSettings, petPosition: defaultPetPosition() };
    saveSettings(reset);
    applySettings(reset);
    return getSettings();
  });
  ipcMain.handle('pet:resetPosition', () => resetPetPosition());
  ipcMain.handle('pet:setVisibility', (_event, visible: boolean) => patchSettings({ petVisible: visible }));
  ipcMain.handle('settings:open', () => createSettingsWindow());
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('pet:beginDrag', () => {
    dragging = true;
    setPetMousePassthrough(false);
  });
  ipcMain.handle('pet:endDrag', () => {
    dragging = false;
    if (!petWindow) return getSettings();
    const [x, y] = petWindow.getPosition();
    const top = petCloudInsets(getSettings().sizeScale).top;
    return patchSettings({ petPosition: boundedPosition(x, y + top) });
  });
  ipcMain.handle('pet:dragBy', (_event, delta: DragDelta) => {
    if (!petWindow || petWindow.isDestroyed()) return getSettings();
    const [x, y] = petWindow.getPosition();
    const top = petCloudInsets(getSettings().sizeScale).top;
    const next = boundedPosition(x + delta.deltaX, y + delta.deltaY + top);
    petWindow.setPosition(next.x, next.y - top, false);
    const now = Date.now();
    if (dragging && now - lastDragPersist > 250) {
      lastDragPersist = now;
      return patchSettings({ petPosition: next });
    }
    return getSettings();
  });
  ipcMain.handle('pet:import', () => importPet());
  ipcMain.handle('pet:delete', (_event, petId: string) => deletePet(petId));
  ipcMain.handle('pet:setInteractiveRegions', (_event, regions: PetInteractiveRegion[]) => {
    petInteractiveRegions = Array.isArray(regions)
      ? regions
        .filter((region) => (
          Number.isFinite(region.x) &&
          Number.isFinite(region.y) &&
          Number.isFinite(region.width) &&
          Number.isFinite(region.height) &&
          region.width > 0 &&
          region.height > 0
        ))
        .map((region) => ({
          ...region,
          radius: Number.isFinite(region.radius) ? clamp(Number(region.radius), 0, 40) : 0
        }))
        .slice(0, 6)
      : [];
  });
  ipcMain.handle('companion:sendMessage', (_event, content: string) => sendCompanionMessage(content));
  ipcMain.handle('companion:proactive', () => proactiveCompanionMessage());
  ipcMain.handle('companion:testProvider', () => testCompanionProvider());
  ipcMain.handle('companion:updatePersona', (_event, personaPatch: Partial<CompanionPersona>) => updateCompanionPersona(personaPatch));
  ipcMain.handle('companion:clearMemory', () => clearCompanionMemory());
}

app.whenReady().then(() => {
  registerIpc();
  createApplicationMenu();
  createPetWindow();
  applySettings();

  if (isSmokeTest) {
    setTimeout(() => {
      app.quit();
    }, 1200);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
    createSettingsWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
});
