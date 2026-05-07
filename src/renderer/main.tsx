import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  Brush,
  Brain,
  ChevronDown,
  CircleHelp,
  Eraser,
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
  Trash2,
  Zap,
  Volume2
} from 'lucide-react';
import type { AppSettings, AppSnapshot, CompanionModelConfig, CompanionSettings, PetAction, PetLibraryItem, PetMood } from '../shared/types';
import './styles.css';

const fallbackSnapshot: AppSnapshot = {
  settings: {
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
      activeModelConfigId: 'default-model',
      modelConfigs: [
        {
          id: 'default-model',
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
  },
  pets: [],
  companion: {
    currentPetMemory: {
      petId: 'lulu',
      summary: '',
      facts: [],
      updatedAt: null
    },
    currentPetPersona: {
      petId: 'lulu',
      nickname: '噜噜',
      personality: '温柔、亲近、有一点撒娇，会主动关心用户。',
      tone: '自然、简短、像熟悉的人在身边说话。',
      relationship: '长期陪伴用户的桌面伙伴，关系亲密但不过度冒犯。',
      speakingStyle: '每次回复尽量短，适合显示在桌面气泡里，不说教。',
      updatedAt: null
    },
    recentMessages: [],
    status: {
      configured: false,
      lastError: null
    }
  },
  platform: 'darwin',
  version: '0.1.0'
};

const companionProviderPresets: Record<CompanionSettings['provider'], {
  label: string;
  apiBaseUrl: string;
  model: string;
}> = {
  disabled: {
    label: '未配置',
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini'
  },
  'openai-compatible': {
    label: 'OpenAI-compatible',
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini'
  },
  deepseek: {
    label: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash'
  },
  glm: {
    label: 'GLM',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash'
  }
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
    const offCompanion = window.lulu.onCompanionChanged((companion) => {
      setSnapshot((current) => ({ ...current, companion }));
    });
    return () => {
      mounted = false;
      offSettings();
      offPets();
      offCompanion();
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
  const stageRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<PetMood>('idle');
  const [dragAction, setDragAction] = useState<PetAction>('running-right');
  const [frame, setFrame] = useState(0);
  const [cloudIndex, setCloudIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [companionBubble, setCompanionBubble] = useState('');
  const pet = useMemo(() => currentPet(snapshot), [snapshot]);
  const manifest = pet?.manifest;
  const columns = manifest?.columns ?? 8;
  const rows = manifest?.rows ?? 9;
  const cloudLayout = useMemo(
    () => petCloudLayout(snapshot.settings.sizeScale),
    [snapshot.settings.sizeScale]
  );
  const cloudMessages = useMemo(
    () => sanitizeCloudMessages(snapshot.settings.cloudMessages),
    [snapshot.settings.cloudMessages]
  );
  const manualCloudMessage = cloudMessages[cloudIndex % cloudMessages.length] ?? '';
  const latestCompanionMessage = snapshot.companion.recentMessages
    .filter((message) => message.role === 'assistant')
    .at(-1)?.content ?? '';
  const companionCloudMessage = companionBubble || latestCompanionMessage;
  const activeCloudMessage = cloudMessageForMode(snapshot.settings.companion.bubbleMode, manualCloudMessage, companionCloudMessage);
  const selectedAction = selectedActionId(snapshot.settings.currentAction, pet);
  const displayAction = mood === 'dragging'
    ? preferredActionId(pet, [dragAction, 'urgent', selectedAction])
    : mood === 'happy'
      ? preferredActionId(pet, ['waving', 'wave', 'happy', selectedAction])
      : selectedAction;
  const frames = actionFrames(displayAction, columns, manifest);

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

  useEffect(() => {
    setCloudIndex(0);
  }, [snapshot.settings.currentPetId, snapshot.settings.cloudMessages]);

  useEffect(() => {
    if (!snapshot.settings.cloudEnabled || cloudMessages.length < 2) return;
    const timer = window.setInterval(() => {
      setCloudIndex((value) => (value + 1) % cloudMessages.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [snapshot.settings.cloudEnabled, cloudMessages]);

  useEffect(() => {
    setCompanionBubble('');
    setChatOpen(false);
  }, [snapshot.settings.currentPetId]);

  useEffect(() => {
    const measureRegions = () => {
      const stage = stageRef.current;
      if (!stage) {
        void window.lulu.setPetInteractiveRegions([]);
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      const target = chatOpen ? chatRef.current : cloudRef.current;
      if (!target) {
        void window.lulu.setPetInteractiveRegions([]);
        return;
      }
      const rect = target.getBoundingClientRect();
      void window.lulu.setPetInteractiveRegions([{
        x: Math.round(rect.left - stageRect.left),
        y: Math.round(rect.top - stageRect.top - (chatOpen ? 0 : 6)),
        width: Math.round(rect.width),
        height: Math.round(rect.height + (chatOpen ? 0 : 12)),
        radius: chatOpen ? 14 : 16
      }]);
    };
    measureRegions();
    const resizeObserver = new ResizeObserver(measureRegions);
    if (stageRef.current) resizeObserver.observe(stageRef.current);
    if (cloudRef.current) resizeObserver.observe(cloudRef.current);
    if (chatRef.current) resizeObserver.observe(chatRef.current);
    const animationFrame = window.requestAnimationFrame(measureRegions);
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      void window.lulu.setPetInteractiveRegions([]);
    };
  }, [
    activeCloudMessage,
    chatOpen,
    snapshot.companion.recentMessages,
    snapshot.settings.cloudEnabled,
    snapshot.settings.cloudOffsetX,
    snapshot.settings.cloudOffsetY,
    snapshot.settings.companion.enabled
  ]);

  useEffect(() => {
    if (!snapshot.settings.companion.enabled || !snapshot.settings.companion.proactiveEnabled) return;
    const delay = Math.max(100, snapshot.settings.companion.replyFrequencyMinutes * 60_000);
    const timer = window.setInterval(() => {
      void window.lulu.requestProactiveCompanionMessage().then((result) => {
        if (result.reply?.content) {
          setCompanionBubble(result.reply.content);
        }
      });
    }, delay);
    return () => window.clearInterval(timer);
  }, [
    snapshot.settings.companion.enabled,
    snapshot.settings.companion.proactiveEnabled,
    snapshot.settings.companion.replyFrequencyMinutes,
    snapshot.settings.currentPetId
  ]);

  const spriteFrame = frames[frame] ?? 0;
  const x = spriteFrame % columns;
  const y = Math.floor(spriteFrame / columns);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragAction('running-right');
    setMood('dragging');
    void window.lulu.beginPetDrag();
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mood !== 'dragging') return;
    if (Math.abs(event.movementX) >= 1) {
      setDragAction(event.movementX > 0 ? 'running-right' : 'running-left');
    }
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

  const sendChatMessage = async () => {
    const text = chatText.trim();
    if (!text || chatBusy) return;
    setChatBusy(true);
    setChatText('');
    const result = await window.lulu.sendCompanionMessage(text);
    if (result.reply?.content) {
      setCompanionBubble(result.reply.content);
      setMood('happy');
    }
    setChatBusy(false);
  };

  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void window.lulu.openSettings();
  };

  if (loading || !pet) {
    return <div className="pet-stage pet-loading" />;
  }

  return (
    <div
      ref={stageRef}
      className="pet-stage"
      onDoubleClick={() => setMood('happy')}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={openContextMenu}
      title={`${pet.displayName} - 双击互动`}
    >
      <div
        className={`pet-rig mood-${mood}`}
        style={{
          ['--cloud-gutter-top' as string]: `${cloudLayout.top}px`,
          ['--cloud-gutter-right' as string]: `${cloudLayout.right}px`
        }}
      >
        <div className="pet-anchor">
          {snapshot.settings.cloudEnabled && activeCloudMessage && (
            <div
              ref={cloudRef}
              className="pet-cloud"
              key={`${snapshot.settings.currentPetId}-${cloudIndex}`}
              style={{
                ['--cloud-offset-x' as string]: `${snapshot.settings.cloudOffsetX}px`,
                ['--cloud-offset-y' as string]: `${snapshot.settings.cloudOffsetY}px`
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span>{activeCloudMessage}</span>
              <button
                className="pet-cloud-reply"
                title="回复"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setChatOpen((value) => !value);
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                回复
              </button>
            </div>
          )}
          {snapshot.settings.companion.enabled && chatOpen && (
            <div ref={chatRef} className="pet-chat" onPointerDown={(event) => event.stopPropagation()}>
              <button
                className="pet-chat-close"
                title="收起聊天"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setChatOpen(false);
                }}
              >
                ×
              </button>
              <div className="pet-chat-log">
                {snapshot.companion.recentMessages.slice(-4).map((message) => (
                  <div key={message.id} className={`pet-chat-message ${message.role}`}>
                    {message.content}
                  </div>
                ))}
                {snapshot.companion.recentMessages.length === 0 && (
                  <div className="pet-chat-empty">想和我说什么都可以。</div>
                )}
              </div>
              <form
                className="pet-chat-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendChatMessage();
                }}
              >
                <input
                  value={chatText}
                  disabled={chatBusy}
                  onChange={(event) => setChatText(event.target.value)}
                  placeholder={chatBusy ? '回复中...' : '和我说句话'}
                />
                <button disabled={chatBusy || !chatText.trim()}>{chatBusy ? '...' : '发'}</button>
              </form>
            </div>
          )}
          <div
            className="pet-sprite"
            style={{
              backgroundImage: `url("${pet.spritesheetUrl}")`,
              backgroundSize: `${columns * 100}% ${rows * 100}%`,
              backgroundPosition: `${columns === 1 ? 0 : (x / (columns - 1)) * 100}% ${rows === 1 ? 0 : (y / (rows - 1)) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}

const navItems = [
  { id: 'general', label: '通用', caption: '系统与基础行为', icon: Settings },
  { id: 'display', label: '显示', caption: '窗口与位置', icon: Monitor },
  { id: 'pet', label: '宠物', caption: '形象、互动与陪伴', icon: Sparkles },
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
  const [cloudDraft, setCloudDraft] = useState('');
  const [cloudEditorOpen, setCloudEditorOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [personaDraft, setPersonaDraft] = useState(fallbackSnapshot.companion.currentPetPersona);
  const [modelDraft, setModelDraft] = useState<CompanionModelConfig | null>(null);
  const [expandedModelConfigId, setExpandedModelConfigId] = useState<string | null>(fallbackSnapshot.settings.companion.activeModelConfigId);
  const [settingsChatText, setSettingsChatText] = useState('');
  const [settingsChatBusy, setSettingsChatBusy] = useState(false);
  const [petTab, setPetTab] = useState<'appearance' | 'interaction' | 'companion'>('appearance');
  const [companionPage, setCompanionPage] = useState<'overview' | 'models'>('overview');
  const [petQuery, setPetQuery] = useState('');
  const [petSourceFilter, setPetSourceFilter] = useState<'all' | 'bundled' | 'imported'>('all');
  const pet = currentPet(snapshot);
  const filteredPets = snapshot.pets.filter((item) => {
    const query = petQuery.trim().toLowerCase();
    const matchesQuery = !query ||
      item.displayName.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query);
    const matchesSource = petSourceFilter === 'all' || item.source === petSourceFilter;
    return matchesQuery && matchesSource;
  });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 1600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setCloudDraft(snapshot.settings.cloudMessages.join('\n'));
  }, [snapshot.settings.cloudMessages]);

  useEffect(() => {
    setPersonaDraft(snapshot.companion.currentPetPersona);
  }, [snapshot.settings.currentPetId, snapshot.companion.currentPetPersona]);

  const importPet = async () => {
    const result = await window.lulu.importPet();
    setNotice(result.message);
    const next = await window.lulu.getSnapshot();
    setSnapshot(next);
  };

  const deletePet = async (item: PetLibraryItem) => {
    if (item.source !== 'imported') return;
    const confirmed = window.confirm(`删除自定义宠物“${item.displayName}”？`);
    if (!confirmed) return;
    const result = await window.lulu.deletePet(item.id);
    setNotice(result.message);
    setSnapshot(result.snapshot ?? await window.lulu.getSnapshot());
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
    setNotice('宠物已经回到默认位置。');
  };

  const saveCloudMessages = async () => {
    const nextMessages = sanitizeCloudMessages(cloudDraft.split('\n'));
    await updateSettings({ cloudMessages: nextMessages });
    setCloudDraft(nextMessages.join('\n'));
    setNotice('云朵文案已更新。');
    setCloudEditorOpen(false);
  };

  const updateCompanion = (patch: Partial<CompanionSettings>) => updateSettings({
    companion: {
      ...snapshot.settings.companion,
      ...patch
    }
  });

  const activeModelConfig = snapshot.settings.companion.modelConfigs.find((config) => (
    config.id === snapshot.settings.companion.activeModelConfigId
  )) ?? snapshot.settings.companion.modelConfigs[0];
  const modelConfigured = (config: CompanionModelConfig) => (
    config.provider !== 'disabled' && Boolean(config.apiBaseUrl && config.apiKey && config.model)
  );
  const activeModelConfigured = Boolean(activeModelConfig && modelConfigured(activeModelConfig));
  const modelDraftDirty = Boolean(activeModelConfig && modelDraft && JSON.stringify(activeModelConfig) !== JSON.stringify(modelDraft));
  const modelProviderLabel = (provider: CompanionSettings['provider']) => companionProviderPresets[provider]?.label ?? provider;
  const activeModelVersion = activeModelConfig
    ? [activeModelConfig.id, activeModelConfig.name, activeModelConfig.provider, activeModelConfig.apiBaseUrl, activeModelConfig.apiKey, activeModelConfig.model].join('\u0000')
    : '';

  const updateActiveModelConfig = (patch: Partial<CompanionModelConfig>) => {
    const currentConfig = activeModelConfig;
    if (!currentConfig) return Promise.resolve();
    const modelConfigs = snapshot.settings.companion.modelConfigs.map((config) => (
      config.id === currentConfig.id ? { ...config, ...patch } : config
    ));
    return updateCompanion({
      modelConfigs,
      activeModelConfigId: currentConfig.id
    });
  };

  const updateModelDraft = (patch: Partial<CompanionModelConfig>) => {
    setModelDraft((current) => current ? { ...current, ...patch } : current);
  };

  const updateCompanionProvider = (provider: CompanionSettings['provider']) => {
    const preset = companionProviderPresets[provider];
    updateModelDraft({
      provider,
      apiBaseUrl: preset.apiBaseUrl,
      model: preset.model
    });
  };

  useEffect(() => {
    setModelDraft(activeModelConfig ? { ...activeModelConfig } : null);
  }, [activeModelVersion, companionPage]);

  useEffect(() => {
    const activeId = snapshot.settings.companion.activeModelConfigId;
    const hasExpanded = snapshot.settings.companion.modelConfigs.some((config) => config.id === expandedModelConfigId);
    if (expandedModelConfigId !== null && !hasExpanded && activeId) {
      setExpandedModelConfigId(activeId);
    }
  }, [expandedModelConfigId, snapshot.settings.companion.activeModelConfigId, snapshot.settings.companion.modelConfigs]);

  const saveModelConfig = async () => {
    if (!modelDraft) return;
    await updateActiveModelConfig(modelDraft);
    setNotice('模型配置已保存。');
  };

  const testSelectedModelProvider = async () => {
    if (modelDraftDirty) {
      await saveModelConfig();
    }
    await testCompanionProvider();
  };

  const selectModelConfig = (activeModelConfigId: string) => {
    if (activeModelConfigId === snapshot.settings.companion.activeModelConfigId) return Promise.resolve();
    if (modelDraftDirty && !window.confirm('当前模型配置还没有保存，切换后会放弃未保存内容。继续切换？')) {
      return Promise.resolve();
    }
    return updateCompanion({ activeModelConfigId });
  };

  const toggleModelConfig = async (config: CompanionModelConfig) => {
    if (expandedModelConfigId === config.id) {
      setExpandedModelConfigId(null);
      return;
    }
    setExpandedModelConfigId(config.id);
    await selectModelConfig(config.id);
  };

  const addModelConfig = () => {
    const id = `model-${Date.now().toString(36)}`;
    const nextConfig: CompanionModelConfig = {
      id,
      name: `模型 ${snapshot.settings.companion.modelConfigs.length + 1}`,
      provider: 'deepseek',
      apiBaseUrl: companionProviderPresets.deepseek.apiBaseUrl,
      apiKey: '',
      model: companionProviderPresets.deepseek.model
    };
    return updateCompanion({
      modelConfigs: [...snapshot.settings.companion.modelConfigs, nextConfig],
      activeModelConfigId: id
    });
  };

  const deleteModelConfig = (config: CompanionModelConfig) => {
    if (snapshot.settings.companion.modelConfigs.length <= 1) return;
    const confirmed = window.confirm(`删除模型配置“${config.name}”？`);
    if (!confirmed) return;
    const modelConfigs = snapshot.settings.companion.modelConfigs.filter((item) => item.id !== config.id);
    void updateCompanion({
      modelConfigs,
      activeModelConfigId: snapshot.settings.companion.activeModelConfigId === config.id
        ? modelConfigs[0]?.id
        : snapshot.settings.companion.activeModelConfigId
    });
  };

  const clearCompanionMemory = async () => {
    const confirmed = window.confirm(`清除“${pet?.displayName ?? '当前角色'}”的记忆和聊天记录？`);
    if (!confirmed) return;
    const result = await window.lulu.clearCompanionMemory();
    setSnapshot((current) => ({ ...current, companion: result.snapshot }));
    setNotice(result.message);
  };

  const savePersona = async () => {
    const result = await window.lulu.updateCompanionPersona(personaDraft);
    setSnapshot((current) => ({ ...current, companion: result.snapshot }));
    setNotice(result.message);
  };

  const sendSettingsChatMessage = async () => {
    const text = settingsChatText.trim();
    if (!text || settingsChatBusy) return;
    setSettingsChatBusy(true);
    setSettingsChatText('');
    const result = await window.lulu.sendCompanionMessage(text);
    setSnapshot((current) => ({ ...current, companion: result.snapshot }));
    setNotice(result.message);
    setSettingsChatBusy(false);
  };

  const testCompanionProvider = async () => {
    if (testingProvider) return;
    setTestingProvider(true);
    const result = await window.lulu.testCompanionProvider();
    setSnapshot((current) => ({ ...current, companion: result.snapshot }));
    setNotice(result.message);
    setTestingProvider(false);
  };

  return (
    <main className="settings-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <aside className="sidebar">
        <div className="brand">
          <PetAvatarBadge pet={pet} />
          <div>
            <h1>桌边小伴</h1>
            <p>Desk Buddy</p>
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
            <SettingRow title="登录时打开" caption="启动 macOS 后自动显示宠物">
              <Switch checked={snapshot.settings.launchAtLogin} onChange={(launchAtLogin) => updateSettings({ launchAtLogin })} />
            </SettingRow>
            <SettingRow title="菜单栏图标" caption="关闭后可通过 Dock、快捷键或宠物右键打开设置">
              <Switch checked={snapshot.settings.showMenuBarIcon} onChange={(showMenuBarIcon) => updateSettings({ showMenuBarIcon })} />
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
            <SettingRow title="宠物大小" caption="调整后立即应用到桌边小伴">
              <Range value={snapshot.settings.sizeScale} min={0.5} max={2.5} step={0.1} suffix="x" onChange={(sizeScale) => updateSettings({ sizeScale })} />
            </SettingRow>
            <SettingRow title="重置位置" caption="把宠物放回当前主屏幕右下角">
              <button className="secondary-button" onClick={resetPosition}><RotateCcw size={16} />重置位置</button>
            </SettingRow>
          </Panel>
        )}
        {active === 'pet' && (
          <>
            <div className="section-tabs">
              <button className={petTab === 'appearance' ? 'active' : ''} onClick={() => setPetTab('appearance')}>形象动画</button>
              <button className={petTab === 'interaction' ? 'active' : ''} onClick={() => setPetTab('interaction')}>互动行为</button>
              <button className={petTab === 'companion' ? 'active' : ''} onClick={() => setPetTab('companion')}>智能陪伴</button>
            </div>
            {petTab === 'appearance' && (
              <>
                <Panel title="当前宠物">
                  <div className="pet-detail compact">
                    <PetPreview pet={pet} />
                    <div>
                      <h3>{pet?.displayName ?? '宠物'}</h3>
                      <p>{pet?.description ?? '默认桌面伙伴'}</p>
                      <div className="tag-row">
                        <span>{pet?.source === 'bundled' ? '内置' : '导入'}</span>
                        <span>{pet?.manifest.columns ?? 8} x {pet?.manifest.rows ?? 9}</span>
                      </div>
                    </div>
                  </div>
                  <SettingRow title="动画速度" caption="待机和互动动画速度">
                    <Range value={snapshot.settings.animationSpeed} min={0.5} max={2} step={0.1} suffix="x" onChange={(animationSpeed) => updateSettings({ animationSpeed })} />
                  </SettingRow>
                  <SettingRow title="当前动作" caption="桌面默认循环动作">
                    <select value={selectedActionId(snapshot.settings.currentAction, pet)} onChange={(event) => updateSettings({ currentAction: event.target.value })}>
                      {actionOptions(pet).map((action) => (
                        <option key={action.id} value={action.id}>{action.label}</option>
                      ))}
                    </select>
                  </SettingRow>
                </Panel>
                <Panel title="云朵气泡">
                  <div className="settings-grid two">
                    <MiniSetting title="显示气泡" caption="头顶文案">
                      <Switch checked={snapshot.settings.cloudEnabled} onChange={(cloudEnabled) => updateSettings({ cloudEnabled })} />
                    </MiniSetting>
                    <MiniSetting title="文案" caption={`${snapshot.settings.cloudMessages.length} 条`}>
                      <button className="secondary-button" onClick={() => setCloudEditorOpen(true)}>编辑</button>
                    </MiniSetting>
                    <MiniSetting title="左右偏移" caption="避开脸部">
                      <Range value={snapshot.settings.cloudOffsetX} min={-80} max={80} step={2} suffix="" onChange={(cloudOffsetX) => updateSettings({ cloudOffsetX })} formatValue={(value) => `${value > 0 ? '+' : ''}${Math.round(value)}px`} />
                    </MiniSetting>
                    <MiniSetting title="上下偏移" caption="调整高度">
                      <Range value={snapshot.settings.cloudOffsetY} min={-80} max={80} step={2} suffix="" onChange={(cloudOffsetY) => updateSettings({ cloudOffsetY })} formatValue={(value) => `${value > 0 ? '+' : ''}${Math.round(value)}px`} />
                    </MiniSetting>
                  </div>
                </Panel>
                <Panel title="宠物库">
                  <div className="pet-library-toolbar">
                    <input className="text-input" value={petQuery} placeholder="搜索宠物" onChange={(event) => setPetQuery(event.target.value)} />
                    <select value={petSourceFilter} onChange={(event) => setPetSourceFilter(event.target.value as typeof petSourceFilter)}>
                      <option value="all">全部</option>
                      <option value="bundled">内置</option>
                      <option value="imported">自定义</option>
                    </select>
                    <span>{filteredPets.length} / {snapshot.pets.length}</span>
                  </div>
                  <div className="pet-list">
                    {filteredPets.map((item) => (
                      <button key={item.id} className={`pet-list-item ${snapshot.settings.currentPetId === item.id ? 'selected' : ''}`} onClick={() => updateSettings({ currentPetId: item.id })}>
                        <PetPreview pet={item} />
                        <span>
                          <strong>{item.displayName}</strong>
                          <small>{item.source === 'bundled' ? '内置宠物' : '自定义宠物'} · {item.manifest.columns ?? 8} x {item.manifest.rows ?? 9}</small>
                        </span>
                        {snapshot.settings.currentPetId === item.id && <em>当前</em>}
                        {item.source === 'imported' && (
                          <span role="button" tabIndex={0} className="pet-list-delete" title="删除自定义宠物" onClick={(event) => { event.stopPropagation(); void deletePet(item); }} onKeyDown={(event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); event.stopPropagation(); void deletePet(item); }}>
                            <Trash2 size={15} />
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredPets.length === 0 && <div className="pet-list-empty">没有找到匹配的宠物。</div>}
                  </div>
                  <div className="panel-actions compact">
                    <button className="primary-button" onClick={importPet}><FolderInput size={17} />导入宠物</button>
                  </div>
                </Panel>
              </>
            )}
            {petTab === 'interaction' && (
              <Panel title="互动行为">
                <div className="settings-grid three">
                  <StatusTile title="双击互动" text="双击触发开心动画" active />
                  <StatusTile title="位置保护" text="拖动限制在屏幕内" active />
                  <StatusTile title="配置恢复" text="资源异常时自动回退" active />
                </div>
              </Panel>
            )}
            {petTab === 'companion' && companionPage === 'models' && (
              <>
                <div className="settings-subpage-header model-page-header">
                  <button className="secondary-button" onClick={() => setCompanionPage('overview')}><ArrowLeft size={16} />返回</button>
                  <div>
                    <strong>模型配置</strong>
                    <span>当前模型用于聊天、主动说话和连接测试。</span>
                  </div>
                  <button className="primary-button" onClick={() => void addModelConfig()}>新增模型</button>
                </div>
                <section className="model-manager-panel">
                  <div className="model-config-list">
                    {snapshot.settings.companion.modelConfigs.map((config) => {
                      const isActiveConfig = config.id === snapshot.settings.companion.activeModelConfigId;
                      const isExpanded = expandedModelConfigId === config.id;
                      const displayConfig = isActiveConfig && modelDraft ? modelDraft : config;
                      const configured = modelConfigured(displayConfig);
                      return (
                        <div key={config.id} className={`model-config-item ${isActiveConfig ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}>
                          <button className="model-config-summary" onClick={() => void toggleModelConfig(config)}>
                            <span className="model-config-main">
                              <strong>{displayConfig.name || '未命名模型'}</strong>
                              <small>{modelProviderLabel(displayConfig.provider)} · {displayConfig.model || '未填写模型'}</small>
                            </span>
                            <span className={configured ? 'status-ok' : 'status-muted'}>{configured ? '已配置' : '本地回退'}</span>
                            {isActiveConfig && <span className="model-active-pill">当前</span>}
                            <ChevronDown className="model-config-chevron" size={16} />
                          </button>
                          {isExpanded && isActiveConfig && modelDraft && (
                            <div className="model-config-details">
                              <div className="model-config-form">
                                <label className="model-field">
                                  <span>配置名称</span>
                                  <input className="text-input" value={modelDraft.name} onChange={(event) => updateModelDraft({ name: event.target.value })} placeholder="例如 DeepSeek 日常聊天" />
                                </label>
                                <label className="model-field">
                                  <span>服务类型</span>
                                  <select value={modelDraft.provider} onChange={(event) => updateCompanionProvider(event.target.value as CompanionSettings['provider'])}>
                                    {Object.entries(companionProviderPresets).map(([provider, preset]) => <option key={provider} value={provider}>{preset.label}</option>)}
                                  </select>
                                </label>
                                <label className="model-field wide">
                                  <span>API Base URL</span>
                                  <input className="text-input" value={modelDraft.apiBaseUrl} onChange={(event) => updateModelDraft({ apiBaseUrl: event.target.value })} placeholder="https://api.deepseek.com" />
                                </label>
                                <label className="model-field">
                                  <span>模型</span>
                                  <input className="text-input" value={modelDraft.model} onChange={(event) => updateModelDraft({ model: event.target.value })} placeholder="deepseek-chat / glm-4-flash" />
                                </label>
                                <label className="model-field">
                                  <span>API Key</span>
                                  <input className="text-input" type="password" value={modelDraft.apiKey} placeholder="只保存在本机" onChange={(event) => updateModelDraft({ apiKey: event.target.value })} />
                                </label>
                              </div>
                              {snapshot.companion.status.lastError && <p className="error-text">{snapshot.companion.status.lastError}</p>}
                              <div className="model-config-footer">
                                  <div className="model-config-footer-actions">
                                    <button className="secondary-button" disabled={!modelDraftDirty} onClick={() => void saveModelConfig()}>保存配置</button>
                                    <button className="primary-button" disabled={testingProvider || modelDraft.provider === 'disabled'} onClick={() => void testSelectedModelProvider()}><Zap size={16} />{testingProvider ? '测试中' : '测试连接'}</button>
                                    <button className="secondary-button" onClick={() => setExpandedModelConfigId(null)}>收起</button>
                                    <button className="secondary-button danger" disabled={snapshot.settings.companion.modelConfigs.length <= 1} onClick={() => deleteModelConfig(config)}><Trash2 size={15} />删除</button>
                                  </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
            {petTab === 'companion' && companionPage === 'overview' && (
              <>
                <Panel title="智能陪伴">
                  <div className="settings-grid two">
                    <MiniSetting title="聊天功能" caption="开启角色对话">
                      <Switch checked={snapshot.settings.companion.enabled} onChange={(enabled) => updateCompanion({ enabled })} />
                    </MiniSetting>
                    <MiniSetting title="主动说话" caption="空闲时冒泡">
                      <Switch checked={snapshot.settings.companion.proactiveEnabled} onChange={(proactiveEnabled) => updateCompanion({ proactiveEnabled })} />
                    </MiniSetting>
                    <MiniSetting title="主动频率" caption="单位：秒">
                      <IntervalInput minutes={snapshot.settings.companion.replyFrequencyMinutes} onChange={(replyFrequencyMinutes) => updateCompanion({ replyFrequencyMinutes })} />
                    </MiniSetting>
                    <MiniSetting title="气泡模式" caption="文案来源">
                      <select value={snapshot.settings.companion.bubbleMode} onChange={(event) => updateCompanion({ bubbleMode: event.target.value as CompanionSettings['bubbleMode'] })}>
                        <option value="manual">手动气泡</option>
                        <option value="companion">角色回复</option>
                        <option value="mixed">混合展示</option>
                      </select>
                    </MiniSetting>
                  </div>
                </Panel>
                <Panel title="快捷聊天">
                  <div className="settings-chat-log compact">
                    {snapshot.companion.recentMessages.slice(-5).map((message) => (
                      <div key={message.id} className={`settings-chat-message ${message.role}`}>
                        <strong>{message.role === 'user' ? '你' : pet?.displayName ?? '角色'}</strong>
                        <span>{message.content}</span>
                      </div>
                    ))}
                    {snapshot.companion.recentMessages.length === 0 && <div className="settings-chat-empty">开启聊天功能后，可以先在这里测试角色回复。</div>}
                  </div>
                  <form className="settings-chat-form" onSubmit={(event) => { event.preventDefault(); void sendSettingsChatMessage(); }}>
                    <input className="text-input" value={settingsChatText} disabled={!snapshot.settings.companion.enabled || settingsChatBusy} onChange={(event) => setSettingsChatText(event.target.value)} placeholder={snapshot.settings.companion.enabled ? '输入一句话测试角色回复' : '先开启聊天功能'} />
                    <button className="primary-button" disabled={!snapshot.settings.companion.enabled || settingsChatBusy || !settingsChatText.trim()}>{settingsChatBusy ? '回复中' : '发送'}</button>
                  </form>
                </Panel>
                <Panel title="角色设定">
                  <div className="persona-grid">
                    <label><span>称呼</span><input className="text-input" value={personaDraft.nickname} onChange={(event) => setPersonaDraft((current) => ({ ...current, nickname: event.target.value }))} /></label>
                    <label><span>性格</span><textarea className="persona-input" rows={2} value={personaDraft.personality} onChange={(event) => setPersonaDraft((current) => ({ ...current, personality: event.target.value }))} /></label>
                    <label><span>语气</span><textarea className="persona-input" rows={2} value={personaDraft.tone} onChange={(event) => setPersonaDraft((current) => ({ ...current, tone: event.target.value }))} /></label>
                    <label><span>关系感</span><textarea className="persona-input" rows={2} value={personaDraft.relationship} onChange={(event) => setPersonaDraft((current) => ({ ...current, relationship: event.target.value }))} /></label>
                    <label><span>说话风格</span><textarea className="persona-input" rows={2} value={personaDraft.speakingStyle} onChange={(event) => setPersonaDraft((current) => ({ ...current, speakingStyle: event.target.value }))} /></label>
                  </div>
                  <div className="panel-actions"><button className="primary-button" onClick={() => void savePersona()}>保存设定</button></div>
                </Panel>
                <Panel title="角色记忆">
                  <div className="subsection-card memory-module-card">
                    <div className="subsection-head"><strong>长期记忆</strong><Switch checked={snapshot.settings.companion.memoryEnabled} onChange={(memoryEnabled) => updateCompanion({ memoryEnabled })} /></div>
                    <p>{memorySummaryText(snapshot)}</p>
                    <div className="memory-facts compact">{snapshot.companion.currentPetMemory.facts.slice(0, 5).map((fact) => <span key={fact}>{fact}</span>)}</div>
                    <button className="secondary-button" onClick={clearCompanionMemory}><Eraser size={16} />清除记忆</button>
                  </div>
                </Panel>
                <Panel title="模型服务">
                  <div className="model-service-entry">
                    <div>
                      <strong>{activeModelConfig?.name ?? '默认模型'}</strong>
                      <span>{activeModelConfig ? `${modelProviderLabel(activeModelConfig.provider)} · ${activeModelConfig.model || '未填写模型'}` : '暂无模型配置'}</span>
                    </div>
                    <span className={modelConfigured(activeModelConfig ?? fallbackSnapshot.settings.companion.modelConfigs[0]) ? 'status-ok' : 'status-muted'}>{modelConfigured(activeModelConfig ?? fallbackSnapshot.settings.companion.modelConfigs[0]) ? '已配置' : '本地回退'}</span>
                    <button className="primary-button" onClick={() => setCompanionPage('models')}>管理模型</button>
                  </div>
                </Panel>
              </>
            )}
          </>
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
            <SettingRow title="版本" caption="Desk Buddy">
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
      {cloudEditorOpen && (
        <div className="modal-backdrop" onClick={() => setCloudEditorOpen(false)}>
          <div className="cloud-modal" onClick={(event) => event.stopPropagation()}>
            <h3>编辑云朵文案</h3>
            <p>每行一条，宠物会循环播放这些话。</p>
            <textarea
              value={cloudDraft}
              rows={8}
              onChange={(event) => setCloudDraft(event.target.value)}
              placeholder="每行写一条给主人的话"
            />
            <div className="cloud-preview">
              {sanitizeCloudMessages(cloudDraft.split('\n')).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="cloud-modal-actions">
              <button className="secondary-button" onClick={() => setCloudEditorOpen(false)}>取消</button>
              <button className="primary-button" onClick={() => void saveCloudMessages()}>保存文案</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function currentPet(snapshot: AppSnapshot) {
  return snapshot.pets.find((pet) => pet.id === snapshot.settings.currentPetId) ?? snapshot.pets[0];
}

function rowFrames(row: number, count: number, columns: number) {
  return Array.from({ length: count }, (_value, index) => row * columns + index);
}

const defaultActions: { id: PetAction; label: string; row: number; frames: number }[] = [
  { id: 'idle', label: '待机', row: 0, frames: 6 },
  { id: 'running-right', label: '向右奔跑', row: 1, frames: 8 },
  { id: 'running-left', label: '向左奔跑', row: 2, frames: 8 },
  { id: 'waving', label: '挥手', row: 3, frames: 4 },
  { id: 'jumping', label: '跳跃', row: 4, frames: 5 },
  { id: 'failed', label: '沮丧', row: 5, frames: 8 },
  { id: 'waiting', label: '等待', row: 6, frames: 6 },
  { id: 'running', label: '思考', row: 7, frames: 6 },
  { id: 'review', label: '复盘', row: 8, frames: 6 }
];

const legacyActionLabels: { id: PetAction; label: string }[] = [
  { id: 'idle', label: '待机' },
  { id: 'running-right', label: '向右奔跑' },
  { id: 'running-left', label: '向左奔跑' },
  { id: 'waving', label: '挥手' },
  { id: 'jumping', label: '跳跃' },
  { id: 'failed', label: '沮丧' },
  { id: 'waiting', label: '等待' },
  { id: 'running', label: '思考' },
  { id: 'review', label: '复盘' }
];

function customActionDefinitions(pet?: PetLibraryItem) {
  return pet?.manifest.actions
    ?.filter((action) => action.id && action.label && Number.isFinite(action.row));
}

function actionOptions(pet?: PetLibraryItem) {
  const customActions = customActionDefinitions(pet);
  if (customActions?.length) {
    return customActions
      .map((action) => ({
        id: action.id,
        label: action.label
      }));
  }
  return legacyActionLabels.map((action) => ({
    id: action.id,
    label: pet?.manifest.actionLabels?.[action.id] ?? action.label
  }));
}

function selectedActionId(actionId: string, pet?: PetLibraryItem) {
  const options = actionOptions(pet);
  return options.some((action) => action.id === actionId)
    ? actionId
    : options[0]?.id ?? 'idle';
}

function preferredActionId(pet: PetLibraryItem | undefined, preferred: string[]) {
  const options = actionOptions(pet);
  for (const actionId of preferred) {
    if (options.some((action) => action.id === actionId)) return actionId;
  }
  return options[0]?.id ?? preferred[0] ?? 'idle';
}

function actionFrames(action: string, columns: number, manifest?: PetLibraryItem['manifest']) {
  const customActions = manifest?.actions
    ?.filter((item) => item.id && item.label && Number.isFinite(item.row));
  if (customActions?.length) {
    const customAction = customActions.find((item) => item.id === action) ?? customActions[0];
    return rowFrames(
      clampRowIndex(customAction.row, manifest?.rows ?? 9),
      clampFrameCount(customAction.frames ?? columns, columns),
      columns
    );
  }
  const legacyAction = defaultActions.find((item) => item.id === action) ?? defaultActions[0];
  const count = clampFrameCount(manifest?.actionFrameCounts?.[legacyAction.id] ?? legacyAction.frames, columns);
  return rowFrames(legacyAction.row, count, columns);
}

function clampFrameCount(value: number, columns: number) {
  if (!Number.isFinite(value)) return columns;
  return Math.min(columns, Math.max(1, Math.floor(value)));
}

function clampRowIndex(value: number, rows: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(1, rows) - 1, Math.max(0, Math.floor(value)));
}

function sanitizeCloudMessages(values: string[]) {
  const messages = values.map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return messages.length > 0
    ? messages
    : ['人，你真棒！', '人，累了记得休息，我会一直陪着你'];
}

function cloudMessageForMode(mode: CompanionSettings['bubbleMode'], manualMessage: string, companionMessage: string) {
  if (mode === 'companion') return companionMessage;
  if (mode === 'mixed') return companionMessage || manualMessage;
  return manualMessage;
}

function memorySummaryText(snapshot: AppSnapshot) {
  const memory = snapshot.companion.currentPetMemory;
  if (memory.facts.length === 0) return '暂时还没有长期记忆，聊天后会记录成简短标签。';
  return `已记录 ${memory.facts.length} 条记忆标签。`;
}

function petCloudLayout(scale: number) {
  void scale;
  return {
    top: 118,
    right: 168
  };
}

function sectionTitle(section: SectionId) {
  return navItems.find((item) => item.id === section)?.label ?? '设置';
}

function sectionCaption(section: SectionId) {
  return navItems.find((item) => item.id === section)?.caption ?? 'Desk Buddy';
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

function MiniSetting({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="mini-setting">
      <div>
        <strong>{title}</strong>
        <p>{caption}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function StatusTile({ title, text, active }: { title: string; text: string; active: boolean }) {
  return (
    <div className={`status-tile ${active ? 'active' : ''}`}>
      <strong>{title}</strong>
      <span>{text}</span>
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
  onChange,
  formatValue
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void | Promise<void>;
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="range-control">
      <span>{formatValue ? formatValue(value) : `${value.toFixed(1)}${suffix}`}</span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => void onChange(Number(event.target.value))} />
    </div>
  );
}

function IntervalInput({
  minutes,
  onChange
}: {
  minutes: number;
  onChange: (minutes: number) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => String(Math.round(minutes * 60)));
  useEffect(() => {
    setDraft(String(Math.round(minutes * 60)));
  }, [minutes]);
  const commit = (value: string) => {
    if (!value.trim()) return;
    const nextSeconds = Number(value);
    if (!Number.isFinite(nextSeconds)) return;
    void onChange(nextSeconds / 60);
  };
  return (
    <div className="interval-control">
      <input
        type="number"
        step={1}
        value={draft}
        onChange={(event) => {
          const value = event.target.value;
          setDraft(value);
          if (value.trim()) commit(value);
        }}
        onBlur={() => commit(draft)}
      />
      <span>秒</span>
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

function PetAvatarBadge({ pet }: { pet?: PetLibraryItem }) {
  if (!pet) return <div className="brand-mark">Lu</div>;
  return (
    <div className="brand-mark brand-pet-avatar" aria-label={`当前宠物：${pet.displayName}`}>
      <span
        style={{
          backgroundImage: `url("${pet.spritesheetUrl}")`,
          backgroundSize: `${(pet.manifest.columns ?? 8) * 100}% ${(pet.manifest.rows ?? 9) * 100}%`
        }}
      />
    </div>
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
