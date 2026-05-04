import type { LuluApi } from '../preload/index';

declare global {
  interface Window {
    lulu: LuluApi;
  }
}

export {};
