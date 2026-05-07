import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSnapshot,
  AppSettings,
  CompanionClearMemoryResult,
  CompanionReplyResult,
  CompanionSnapshot,
  CompanionTestProviderResult,
  CompanionPersona,
  CompanionUpdatePersonaResult,
  DeletePetResult,
  DragDelta,
  ImportPetResult,
  PetInteractiveRegion,
  SettingsPatch
} from '../shared/types.js';

const api = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke('app:getSnapshot'),
  updateSettings: (patch: SettingsPatch): Promise<AppSettings> => ipcRenderer.invoke('settings:update', patch),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  resetPetPosition: (): Promise<AppSettings> => ipcRenderer.invoke('pet:resetPosition'),
  setPetVisibility: (visible: boolean): Promise<AppSettings> => ipcRenderer.invoke('pet:setVisibility', visible),
  dragPetBy: (delta: DragDelta): Promise<AppSettings> => ipcRenderer.invoke('pet:dragBy', delta),
  beginPetDrag: (): Promise<void> => ipcRenderer.invoke('pet:beginDrag'),
  endPetDrag: (): Promise<AppSettings> => ipcRenderer.invoke('pet:endDrag'),
  setPetInteractiveRegions: (regions: PetInteractiveRegion[]): Promise<void> => ipcRenderer.invoke('pet:setInteractiveRegions', regions),
  importPet: (): Promise<ImportPetResult> => ipcRenderer.invoke('pet:import'),
  deletePet: (petId: string): Promise<DeletePetResult> => ipcRenderer.invoke('pet:delete', petId),
  sendCompanionMessage: (content: string): Promise<CompanionReplyResult> => ipcRenderer.invoke('companion:sendMessage', content),
  requestProactiveCompanionMessage: (): Promise<CompanionReplyResult> => ipcRenderer.invoke('companion:proactive'),
  testCompanionProvider: (): Promise<CompanionTestProviderResult> => ipcRenderer.invoke('companion:testProvider'),
  updateCompanionPersona: (personaPatch: Partial<CompanionPersona>): Promise<CompanionUpdatePersonaResult> => ipcRenderer.invoke('companion:updatePersona', personaPatch),
  clearCompanionMemory: (): Promise<CompanionClearMemoryResult> => ipcRenderer.invoke('companion:clearMemory'),
  openSettings: (): Promise<void> => ipcRenderer.invoke('settings:open'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  onPetsChanged: (callback: (snapshot: AppSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => callback(snapshot);
    ipcRenderer.on('pets:changed', listener);
    return () => ipcRenderer.removeListener('pets:changed', listener);
  },
  onCompanionChanged: (callback: (snapshot: CompanionSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: CompanionSnapshot) => callback(snapshot);
    ipcRenderer.on('companion:changed', listener);
    return () => ipcRenderer.removeListener('companion:changed', listener);
  }
};

contextBridge.exposeInMainWorld('lulu', api);

export type LuluApi = typeof api;
