import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Brush,
  CircleHelp,
  Eye,
  FolderInput,
  Info,
  Keyboard,
  Link,
  Maximize2,
  Monitor,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Volume2
} from 'lucide-react';
import type { AppSettings, AppSnapshot, PetLibraryItem, PetMood } from '../shared/types';
import './styles.css';

const fallbackSnapshot: AppSnapshot = {
  settings: {
    petVisible: true,
    sizeScale: 1,
    animationSpeed: 1,
    theme: 'dark',
    launchAtLogin: false,
    soundEnabled: true,
    currentPetId: 'lulu',
    petPosition: null
  },
  pets: [],
  platform: 'darwin',
  version: '0.1.0'
};

function useSnapshot() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(fallbackSnapshot);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void window.lulu.getSnapshot().then((next) => {
      if (mounted) {
        setSnapshot(next);
        setLoading(false);
      }
    });
    const offSettings = window.lulu.onSettingsChanged((settings) => {
      setSnapshot((current) => ({ ...current, settings }));
    });
    const offPets = window.lulu.onPetsChanged((next) => {
      setSnapshot(next);
    });
    return () => {
      mounted = false;
      offSettings();
      offPets();
    };
  }, []);

  return { snapshot, setSnapshot, loading };
}

function App() {
  const route = window.location.hash.includes('/settings') ? 'settings' : 'pet';
  const { snapshot, setSnapshot, loading } = useSnapshot();
  const updateSettings = async (patch: Partial<AppSettings>) => {
    const settings = await window.lulu.updateSettings(patch);
    setSnapshot((current) => ({ ...current, settings }));
  };

  if (route === 'pet') {
    return <PetView snapshot={snapshot} loading={loading} />;
  }

  return <SettingsView snapshot={snapshot} updateSettings={updateSettings} setSnapshot={setSnapshot} />;
}

function PetView({ snapshot, loading }: { snapshot: AppSnapshot; loading: boolean }) {
  const [mood, setMood] = useState<PetMood>('idle');
  const [frame, setFrame] = useState(0);
  const pet = useMemo(() => currentPet(snapshot), [snapshot]);
  const manifest = pet?.manifest;
  const columns = manifest?.columns ?? 8;
  const rows = manifest?.rows ?? 9;
  const frames = mood === 'dragging'
    ? rowFrames(1, 8, columns)
    : mood === 'happy'
      ? rowFrames(3, 4, columns)
      : rowFrames(0, 6, columns);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((value) => (value + 1) % frames.length);
    }, 130 / snapshot.settings.animationSpeed);
    return () => window.clearInterval(interval);
  }, [frames.length, snapshot.settings.animationSpeed]);

  useEffect(() => {
    if (mood !== 'happy') return;
    const timeout = window.setTimeout(() => setMood('idle'), 1200);
    return () => window.clearTimeout(timeout);
  }, [mood]);

  const spriteFrame = frames[frame] ?? 0;
  const x = spriteFrame % columns;
  const y = Math.floor(spriteFrame / columns);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setMood('dragging');
    void window.lulu.beginPetDrag();
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mood !== 'dragging') return;
    void window.lulu.dragPetBy({
      deltaX: event.movementX,
      deltaY: event.movementY
    });
  };

  const endDrag = () => {
    if (mood !== 'dragging') return;
    setMood('idle');
    void window.lulu.endPetDrag();
  };

  if (loading || !pet) {
    return <div className="pet-stage pet-loading" />;
  }

  return (
    <div
      className="pet-stage"
      onDoubleClick={() => setMood('happy')}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      title={`${pet.displayName} - 双击互动`}
    >
      <div
        className={`pet-sprite mood-${mood}`}
        style={{
          backgroundImage: `url("${pet.spritesheetUrl}")`,
          backgroundSize: `${columns * 100}% ${rows * 100}%`,
          backgroundPosition: `${columns === 1 ? 0 : (x / (columns - 1)) * 100}% ${rows === 1 ? 0 : (y / (rows - 1)) * 100}%`
        }}
      />
    </div>
  );
}

const navItems = [
  { id: 'general', label: '通用', caption: '系统与基础行为', icon: Settings },
  { id: 'display', label: '显示', caption: '窗口与位置', icon: Monitor },
  { id: 'pet', label: '宠物', caption: '形象与动画', icon: Sparkles },
  { id: 'behavior', label: '行为', caption: '互动与恢复', icon: SlidersHorizontal },
  { id: 'sound', label: '声音', caption: '通知与提示音', icon: Volume2 },
  { id: 'integrations', label: '集成', caption: 'Hooks 与扩展', icon: Link },
  { id: 'shortcuts', label: '快捷键', caption: '未来操作入口', icon: Keyboard },
  { id: 'about', label: '关于', caption: '版本与更新', icon: Info }
] as const;

type SectionId = (typeof navItems)[number]['id'];

function SettingsView({
  snapshot,
  updateSettings,
  setSnapshot
}: {
  snapshot: AppSnapshot;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setSnapshot: React.Dispatch<React.SetStateAction<AppSnapshot>>;
}) {
  const [active, setActive] = useState<SectionId>('general');
  const [notice, setNotice] = useState('');
  const pet = currentPet(snapshot);

  const importPet = async () => {
    const result = await window.lulu.importPet();
    setNotice(result.message);
    const next = await window.lulu.getSnapshot();
    setSnapshot(next);
  };

  const resetSettings = async () => {
    const settings = await window.lulu.resetSettings();
    const next = await window.lulu.getSnapshot();
    setSnapshot({ ...next, settings });
    setNotice('设置已恢复默认值。');
  };

  const resetPosition = async () => {
    const settings = await window.lulu.resetPetPosition();
    setSnapshot((current) => ({ ...current, settings }));
    setNotice('噜噜已经回到默认位置。');
  };

  return (
    <main className="settings-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Lu</div>
          <div>
            <h1>Lulu</h1>
            <p>Desktop Pet</p>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => setActive(item.id)}>
                <span className="nav-icon"><Icon size={22} /></span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.caption}</small>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <section className="settings-content">
        <header className="content-header">
          <div>
            <p className="eyebrow">{sectionCaption(active)}</p>
            <h2>{sectionTitle(active)}</h2>
          </div>
          <button className="icon-button" title="打开设置窗口" onClick={() => void window.lulu.openSettings()}>
            <Maximize2 size={18} />
          </button>
        </header>
        {notice && <div className="notice">{notice}</div>}
        {active === 'general' && (
          <Panel title="系统">
            <SettingRow title="登录时打开" caption="启动 macOS 后自动显示 Lulu">
              <Switch checked={snapshot.settings.launchAtLogin} onChange={(launchAtLogin) => updateSettings({ launchAtLogin })} />
            </SettingRow>
            <SettingRow title="主题" caption="当前产品优先使用深色面板">
              <select value={snapshot.settings.theme} onChange={(event) => updateSettings({ theme: event.target.value as AppSettings['theme'] })}>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </SettingRow>
            <SettingRow title="重置设置" caption="恢复默认大小、主题、宠物和显示状态">
              <button className="secondary-button" onClick={resetSettings}><RotateCcw size={16} />重置</button>
            </SettingRow>
          </Panel>
        )}
        {active === 'display' && (
          <Panel title="显示">
            <SettingRow title="显示宠物" caption="隐藏后可以从菜单栏重新显示">
              <Switch checked={snapshot.settings.petVisible} onChange={(petVisible) => updateSettings({ petVisible })} />
            </SettingRow>
            <SettingRow title="宠物大小" caption="调整后立即应用到桌面宠物">
              <Range value={snapshot.settings.sizeScale} min={0.5} max={2.5} step={0.1} suffix="x" onChange={(sizeScale) => updateSettings({ sizeScale })} />
            </SettingRow>
            <SettingRow title="重置位置" caption="把 Lulu 放回当前主屏幕右下角">
              <button className="secondary-button" onClick={resetPosition}><RotateCcw size={16} />重置位置</button>
            </SettingRow>
          </Panel>
        )}
        {active === 'pet' && (
          <>
            <Panel title="当前宠物">
              <div className="pet-detail">
                <PetPreview pet={pet} />
                <div>
                  <h3>{pet?.displayName ?? '噜噜'}</h3>
                  <p>{pet?.description ?? '默认桌面伙伴'}</p>
                  <div className="tag-row">
                    <span>8 x 9 Atlas</span>
                    <span>WebP</span>
                    <span>{pet?.source === 'bundled' ? '内置' : '导入'}</span>
                  </div>
                </div>
              </div>
              <SettingRow title="动画速度" caption="控制待机和互动动画播放速度">
                <Range value={snapshot.settings.animationSpeed} min={0.5} max={2} step={0.1} suffix="x" onChange={(animationSpeed) => updateSettings({ animationSpeed })} />
              </SettingRow>
            </Panel>
            <Panel title="宠物库">
              <div className="pet-grid">
                {snapshot.pets.map((item) => (
                  <button
                    key={item.id}
                    className={`pet-card ${snapshot.settings.currentPetId === item.id ? 'selected' : ''}`}
                    onClick={() => updateSettings({ currentPetId: item.id })}
                  >
                    <PetPreview pet={item} />
                    <strong>{item.displayName}</strong>
                    <small>{item.source === 'bundled' ? '内置宠物' : '自定义宠物'}</small>
                  </button>
                ))}
              </div>
              <div className="panel-actions">
                <button className="primary-button" onClick={importPet}><FolderInput size={17} />导入宠物</button>
              </div>
            </Panel>
          </>
        )}
        {active === 'behavior' && (
          <Panel title="行为">
            <SettingRow title="双击互动" caption="双击 Lulu 会触发开心动画">
              <Switch checked onChange={() => undefined} />
            </SettingRow>
            <SettingRow title="位置保护" caption="拖动时限制在当前显示器工作区域内">
              <Switch checked onChange={() => undefined} />
            </SettingRow>
            <SettingRow title="配置恢复" caption="资源缺失或配置损坏时恢复默认 Lulu">
              <Switch checked onChange={() => undefined} />
            </SettingRow>
          </Panel>
        )}
        {active === 'sound' && (
          <Panel title="声音">
            <SettingRow title="提示音" caption="为后续提醒与互动保留">
              <Switch checked={snapshot.settings.soundEnabled} onChange={(soundEnabled) => updateSettings({ soundEnabled })} />
            </SettingRow>
            <SettingRow title="通知音量" caption="后续通知功能会使用该设置">
              <Range value={0.7} min={0} max={1} step={0.1} suffix="" onChange={() => undefined} />
            </SettingRow>
          </Panel>
        )}
        {active === 'integrations' && (
          <Panel title="集成">
            <EmptyState icon={<Brush />} title="扩展接口已预留" text="后续可以接入 Hooks、提醒、AI 对话或 IDE 状态。" />
          </Panel>
        )}
        {active === 'shortcuts' && (
          <Panel title="快捷键">
            <EmptyState icon={<Keyboard />} title="快捷键面板已预留" text="后续可添加显示/隐藏、呼出设置、切换宠物等快捷操作。" />
          </Panel>
        )}
        {active === 'about' && (
          <Panel title="关于">
            <SettingRow title="版本" caption="Lulu Desktop Pet">
              <span className="value-text">{snapshot.version}</span>
            </SettingRow>
            <SettingRow title="运行平台" caption="当前桌面环境">
              <span className="value-text">{snapshot.platform}</span>
            </SettingRow>
            <SettingRow title="用户数据" caption="菜单栏中也可以打开用户数据目录">
              <button className="secondary-button" onClick={() => setNotice('可从菜单栏打开用户数据目录。')}><CircleHelp size={16} />查看</button>
            </SettingRow>
          </Panel>
        )}
      </section>
    </main>
  );
}

function currentPet(snapshot: AppSnapshot) {
  return snapshot.pets.find((pet) => pet.id === snapshot.settings.currentPetId) ?? snapshot.pets[0];
}

function rowFrames(row: number, count: number, columns: number) {
  return Array.from({ length: count }, (_value, index) => row * columns + index);
}

function sectionTitle(section: SectionId) {
  return navItems.find((item) => item.id === section)?.label ?? '设置';
}

function sectionCaption(section: SectionId) {
  return navItems.find((item) => item.id === section)?.caption ?? 'Lulu Desktop Pet';
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function SettingRow({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{caption}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void | Promise<void> }) {
  return (
    <button className={`switch ${checked ? 'checked' : ''}`} onClick={() => void onChange(!checked)} aria-pressed={checked}>
      <span />
    </button>
  );
}

function Range({
  value,
  min,
  max,
  step,
  suffix,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void | Promise<void>;
}) {
  return (
    <div className="range-control">
      <span>{value.toFixed(1)}{suffix}</span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => void onChange(Number(event.target.value))} />
    </div>
  );
}

function PetPreview({ pet }: { pet?: PetLibraryItem }) {
  if (!pet) return <div className="pet-preview empty"><Eye size={24} /></div>;
  return (
    <div
      className="pet-preview"
      style={{
        backgroundImage: `url("${pet.spritesheetUrl}")`,
        backgroundSize: `${(pet.manifest.columns ?? 8) * 100}% ${(pet.manifest.rows ?? 9) * 100}%`
      }}
    />
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
