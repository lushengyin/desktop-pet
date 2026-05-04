import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppSettings, AppSnapshot, DragDelta, ImportPetResult, PetLibraryItem, PetManifest, SettingsPatch } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isSmokeTest = process.env.LULU_SMOKE_TEST === '1';
const isDev = !app.isPackaged && !isSmokeTest;
const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const appRoot = path.resolve(__dirname, '../..');
const bundledPetDir = isDev
  ? path.join(appRoot, 'public/pets/lulu')
  : path.join(appRoot, 'dist/pets/lulu');
const trayIconPath = isDev
  ? path.join(appRoot, 'build/tray.png')
  : path.join(process.resourcesPath, 'tray.png');

const defaultSettings: AppSettings = {
  petVisible: true,
  sizeScale: 1,
  animationSpeed: 1,
  theme: 'dark',
  launchAtLogin: false,
  soundEnabled: true,
  currentPetId: 'lulu',
  petPosition: null
};

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dragging = false;
let lastDragPersist = 0;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function importedPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
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

function sanitizeSettings(value: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultSettings, ...value };
  return {
    ...merged,
    petVisible: Boolean(merged.petVisible),
    sizeScale: clamp(Number(merged.sizeScale) || defaultSettings.sizeScale, 0.5, 2.5),
    animationSpeed: clamp(Number(merged.animationSpeed) || defaultSettings.animationSpeed, 0.5, 2),
    theme: merged.theme === 'system' ? 'system' : 'dark',
    launchAtLogin: Boolean(merged.launchAtLogin),
    soundEnabled: Boolean(merged.soundEnabled),
    currentPetId: typeof merged.currentPetId === 'string' ? merged.currentPetId : 'lulu',
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

function petSize(scale = getSettings().sizeScale) {
  return {
    width: Math.round(192 * scale),
    height: Math.round(208 * scale)
  };
}

function defaultPetPosition() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = petSize();
  return {
    x: Math.round(display.workArea.x + display.workArea.width - width - 48),
    y: Math.round(display.workArea.y + display.workArea.height - height - 56)
  };
}

function boundedPosition(x: number, y: number) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const { width, height } = petSize();
  const area = display.workArea;
  return {
    x: Math.round(clamp(x, area.x, area.x + area.width - width)),
    y: Math.round(clamp(y, area.y, area.y + area.height - height))
  };
}

function createPetWindow() {
  const settings = getSettings();
  const size = petSize(settings.sizeScale);
  const position = settings.petPosition ?? defaultPetPosition();

  petWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y,
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

  void loadRenderer(petWindow, 'pet');

  petWindow.once('ready-to-show', () => {
    if (getSettings().petVisible) {
      petWindow?.showInactive();
    }
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    title: 'Lulu Desktop Pet 设置',
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
    settingsWindow?.show();
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
    const size = petSize(settings.sizeScale);
    const current = petWindow.getBounds();
    const next = boundedPosition(current.x, current.y);
    petWindow.setBounds({ ...next, ...size }, false);
    if (settings.petVisible) {
      petWindow.showInactive();
    } else {
      petWindow.hide();
    }
  }
  if (!isSmokeTest) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }
  updateTray();
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

function bundledPet(): PetLibraryItem {
  const manifest = readJson<PetManifest>(path.join(bundledPetDir, 'pet.json'), {
    id: 'lulu',
    displayName: '噜噜',
    description: '一只圆滚滚的黄色小河马伙伴。',
    spritesheetPath: 'spritesheet.webp'
  });
  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: manifest.description,
    manifest: {
      frameWidth: 192,
      frameHeight: 208,
      columns: 8,
      rows: 9,
      ...manifest
    },
    spritesheetUrl: pathToFileUrl(path.join(bundledPetDir, manifest.spritesheetPath)),
    source: 'bundled'
  };
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
      return [{
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
        source: 'imported' as const
      }];
    });
}

function petLibrary(): PetLibraryItem[] {
  const pets = [bundledPet(), ...importedPets()];
  const byId = new Map<string, PetLibraryItem>();
  for (const pet of pets) byId.set(pet.id, pet);
  return [...byId.values()];
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

function updateTray() {
  if (!tray) return;
  const settings = getSettings();
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  tray.setImage(icon.isEmpty() ? nativeImage.createFromNamedImage('NSStatusAvailable') : icon);
  tray.setToolTip('Lulu Desktop Pet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开设置', click: createSettingsWindow },
    {
      label: settings.petVisible ? '隐藏噜噜' : '显示噜噜',
      click: () => patchSettings({ petVisible: !settings.petVisible })
    },
    { label: '重置位置', click: resetPetPosition },
    { type: 'separator' },
    { label: '打开用户数据目录', click: () => void shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromNamedImage('NSStatusAvailable') : icon);
  updateTray();
  tray.on('click', createSettingsWindow);
}

function resetPetPosition() {
  const settings = patchSettings({ petPosition: defaultPetPosition(), petVisible: true });
  applySettings(settings);
  return settings;
}

function registerIpc() {
  ipcMain.handle('app:getSnapshot', () => getSnapshot());
  ipcMain.handle('settings:update', (_event, patch: SettingsPatch) => patchSettings(patch));
  ipcMain.handle('settings:reset', () => {
    saveSettings(defaultSettings);
    applySettings(defaultSettings);
    return getSettings();
  });
  ipcMain.handle('pet:resetPosition', () => resetPetPosition());
  ipcMain.handle('pet:setVisibility', (_event, visible: boolean) => patchSettings({ petVisible: visible }));
  ipcMain.handle('settings:open', () => createSettingsWindow());
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('pet:beginDrag', () => {
    dragging = true;
  });
  ipcMain.handle('pet:endDrag', () => {
    dragging = false;
    if (!petWindow) return getSettings();
    const [x, y] = petWindow.getPosition();
    return patchSettings({ petPosition: boundedPosition(x, y) });
  });
  ipcMain.handle('pet:dragBy', (_event, delta: DragDelta) => {
    if (!petWindow || petWindow.isDestroyed()) return getSettings();
    const [x, y] = petWindow.getPosition();
    const next = boundedPosition(x + delta.deltaX, y + delta.deltaY);
    petWindow.setPosition(next.x, next.y, false);
    const now = Date.now();
    if (dragging && now - lastDragPersist > 250) {
      lastDragPersist = now;
      return patchSettings({ petPosition: next });
    }
    return getSettings();
  });
  ipcMain.handle('pet:import', () => importPet());
}

app.whenReady().then(() => {
  registerIpc();
  createPetWindow();
  createTray();
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
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
});
