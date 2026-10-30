'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  ListTree,
  PanelLeftClose,
  PanelLeft,
  RotateCcw,
  Radio,
  Search,
  AlertCircle,
} from 'lucide-react';
import TopicList from '../topic-viewer/TopicList';
import { DEFAULT_BRIDGE_URL, useBridge } from '@/hooks/useBridge';
import type { StreamMode } from '@/lib/bridge/client';
import { useTopicList } from '@/hooks/useTopicList';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ConnectionStatus from '../connection/ConnectionStatus';
import AddWidgetButton from '../layout/AddWidgetButton';
import ConnectionSettings from '../connection/ConnectionSettings';
import { SettingsSearchContext } from '../layout/WidgetSettingsPortal';

// Drag and drop needs the browser, so the panel layout is not rendered on the server.
const PanelMosaic = dynamic(() => import('../layout/PanelMosaic'), { ssr: false });

const SIDEBAR_TABS = ['Panel', 'Topics', 'Problems', 'Sources'] as const;
const STORAGE_KEY_SIDEBAR_WIDTH = 'miti_sidebar_width';
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_DEFAULT_WIDTH = 380;
type SidebarTab = (typeof SIDEBAR_TABS)[number];

const STORAGE_KEY_BRIDGE_URL = 'miti_bridge_url';
const STORAGE_KEY_STREAM_MODE = 'miti_stream_mode';

/** Carry a saved rosbridge address over to foxglove_bridge's default port on the same host. */
function initialBridgeUrl(): string {
  try {
    const legacy = JSON.parse(localStorage.getItem('miti_rosbridge_url') ?? 'null');
    if (typeof legacy === 'string') return legacy.replace(/:9090(\/?)$/, ':8765$1');
  } catch {
    /* Use the default when the old setting cannot be read. */
  }
  return DEFAULT_BRIDGE_URL;
}

export default function Dashboard() {
  const [bridgeUrl, setBridgeUrl] = useLocalStorage(STORAGE_KEY_BRIDGE_URL, initialBridgeUrl());
  const [streamMode, setStreamMode] = useLocalStorage<StreamMode>(
    STORAGE_KEY_STREAM_MODE,
    'synchronized'
  );
  const { client, connected, error } = useBridge(bridgeUrl, streamMode);
  // The client object is created before it connects; gating it makes the list load on (re)connect.
  const { topics, loading, refreshTopics } = useTopicList(connected ? client : null);
  const {
    hydrated,
    updateWidget,
    layout,
    addWidget,
    removeWidget,
    updateMosaic,
    resetLayout,
    toggleLock,
  } = useLayoutConfig();
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(
    STORAGE_KEY_SIDEBAR_WIDTH,
    SIDEBAR_DEFAULT_WIDTH
  );
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  /** Drag the sidebar's edge to resize it, as in Foxglove. */
  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setResizingSidebar(true);
    const move = (e: PointerEvent) =>
      setSidebarWidth(
        Math.round(Math.min(window.innerWidth * 0.8, Math.max(SIDEBAR_MIN_WIDTH, e.clientX - left)))
      );
    const stop = () => {
      setResizingSidebar(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('Topics');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsTarget, setSettingsTarget] = useState<HTMLDivElement | null>(null);
  const selectedWidget = layout.widgets.find((widget) => widget.i === selectedWidgetId);
  const sidebarTrigger = useRef<HTMLButtonElement>(null);
  const selectWidget = (id: string) => {
    if (id !== selectedWidgetId) setSettingsSearch('');
    setSelectedWidgetId(id);
    setSidebarOpen(true);
    setActiveTab('Panel');
  };
  const closeSettings = useCallback(() => {
    setSidebarOpen(false);
    requestAnimationFrame(() => {
      const panel = selectedWidgetId ? document.getElementById(`panel-${selectedWidgetId}`) : null;
      const trigger =
        activeTab === 'Panel'
          ? panel?.querySelector<HTMLButtonElement>('.panel-title-button')
          : null;
      (trigger ?? sidebarTrigger.current)?.focus();
    });
  }, [selectedWidgetId, activeTab]);
  useEffect(() => {
    if (selectedWidgetId && !selectedWidget) setSelectedWidgetId(null);
  }, [selectedWidgetId, selectedWidget]);
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 1024);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen && !document.querySelector('.panel-expanded'))
        closeSettings();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [sidebarOpen, closeSettings]);
  const handleUrlChange = (url: string) => setBridgeUrl(url);

  return (
    <SettingsSearchContext.Provider value={settingsSearch}>
      <div className="miti-workspace">
        <header className="workspace-header">
          <div className="workspace-brand">
            <Image
              src="/main_logo.svg"
              alt="MITI"
              width={100}
              height={32}
              priority
              className="h-7 w-auto"
            />
            <span className="brand-divider" />
            <span className="text-xs text-gray-400">Robotics workspace</span>
          </div>
          <ConnectionStatus
            connected={connected}
            url={bridgeUrl}
            onUrlChange={handleUrlChange}
            streamMode={streamMode}
            onStreamModeChange={setStreamMode}
          />
        </header>
        <div className="workspace-toolbar">
          <button
            ref={sidebarTrigger}
            className={`workspace-button ${sidebarOpen ? 'selected' : ''}`}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="workspace-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft size={16} />
            <span>Sidebar</span>
          </button>
          <span className="toolbar-label">
            Workspace <span className="text-gray-600">/</span>{' '}
            <span className="text-gray-200">Live monitoring</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label="Reset layout"
              title="Reset layout"
              className="workspace-button reset-action"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset all panels to the default layout? Your current arrangement will be replaced.'
                  )
                ) {
                  resetLayout();
                  setSelectedWidgetId(null);
                  setSettingsSearch('');
                }
              }}
            >
              <RotateCcw size={14} />
              <span>Reset layout</span>
            </button>
            <AddWidgetButton onAddWidget={(type) => addWidget(type, selectedWidgetId)} />
          </div>
        </div>
        {error && (
          <div role="status" className="connection-notice">
            <Radio size={14} />
            <span>
              Connection unavailable — {error.message}. Check your foxglove_bridge address in
              connection settings.
            </span>
          </div>
        )}
        <div
          className={`workspace-body ${sidebarOpen ? 'settings-open' : ''} ${resizingSidebar ? 'is-resizing' : ''}`}
          style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
        >
          {sidebarOpen && (
            <button
              className="topics-scrim"
              aria-label="Close sidebar overlay"
              onClick={closeSettings}
            />
          )}
          <aside
            ref={sidebarRef}
            id="workspace-sidebar"
            aria-label="Workspace sidebar"
            className={`workspace-sidebar ${sidebarOpen ? 'is-open' : ''}`}
          >
            <div className="inspector-tabs" role="tablist" aria-label="Workspace tools">
              {SIDEBAR_TABS.map((tab, index) => (
                <button
                  key={tab}
                  id={`sidebar-tab-${tab}`}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`sidebar-view-${tab}`}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => setActiveTab(tab)}
                  onKeyDown={(event) => {
                    let next = index;
                    if (event.key === 'ArrowRight') next = (index + 1) % SIDEBAR_TABS.length;
                    else if (event.key === 'ArrowLeft')
                      next = (index + SIDEBAR_TABS.length - 1) % SIDEBAR_TABS.length;
                    else if (event.key === 'Home') next = 0;
                    else if (event.key === 'End') next = SIDEBAR_TABS.length - 1;
                    else return;
                    event.preventDefault();
                    setActiveTab(SIDEBAR_TABS[next]);
                    document.getElementById(`sidebar-tab-${SIDEBAR_TABS[next]}`)?.focus();
                  }}
                >
                  {tab}
                  {tab === 'Problems' && error && <span className="problem-count">1</span>}
                </button>
              ))}
              <button
                className="workspace-icon sidebar-close"
                aria-label="Close sidebar"
                onClick={closeSettings}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            <div
              id="sidebar-view-Panel"
              role="tabpanel"
              aria-labelledby="sidebar-tab-Panel"
              hidden={activeTab !== 'Panel'}
              className="inspector-view"
            >
              {selectedWidget ? (
                <>
                  <div className="inspector-title">
                    {selectedWidget.title || 'Untitled panel'}
                    <span>Panel settings</span>
                  </div>
                  <label className="inspector-search">
                    <Search size={14} />
                    <input
                      aria-label="Search panel settings"
                      placeholder="Search panel settings…"
                      value={settingsSearch}
                      onChange={(event) => setSettingsSearch(event.target.value)}
                    />
                  </label>
                  <div className="inspector-scroll">
                    {(!settingsSearch ||
                      'title panel name'.includes(settingsSearch.toLowerCase().trim())) && (
                      <label className="inspector-property">
                        Title
                        <input
                          value={selectedWidget.title}
                          onChange={(event) =>
                            updateWidget(selectedWidget.i, { title: event.target.value })
                          }
                        />
                      </label>
                    )}
                    <div
                      key={selectedWidget.i}
                      ref={setSettingsTarget}
                      className="widget-settings-content"
                    />
                    {settingsSearch && (
                      <p className="settings-no-results">
                        No matching settings. Try another search.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  <PanelLeft size={24} />
                  <strong>No panel selected</strong>
                  <p>Select a panel in the workspace to edit its settings.</p>
                </div>
              )}
            </div>
            <div
              id="sidebar-view-Topics"
              role="tabpanel"
              aria-labelledby="sidebar-tab-Topics"
              hidden={activeTab !== 'Topics'}
              className="inspector-view"
            >
              <div className="min-h-0 flex-1 p-2">
                <TopicList
                  topics={topics}
                  loading={loading}
                  onRefresh={refreshTopics}
                  client={connected ? client : null}
                />
              </div>
              <div className="sidebar-footer">
                {connected ? `${topics.length} topics · ROS 2` : 'Disconnected · Waiting for ROS'}
              </div>
            </div>
            <div
              id="sidebar-view-Problems"
              role="tabpanel"
              aria-labelledby="sidebar-tab-Problems"
              hidden={activeTab !== 'Problems'}
              className="inspector-view"
            >
              {error ? (
                <details className="inspector-problem" open>
                  <summary>
                    <AlertCircle size={14} />
                    Connection failed
                  </summary>
                  <p>{error.message}</p>
                  <p>
                    Check that foxglove_bridge at <code>{bridgeUrl}</code> is reachable.
                  </p>
                </details>
              ) : (
                <div className="inspector-empty">
                  <AlertCircle size={24} />
                  <strong>No reported errors</strong>
                  <p>
                    {connected
                      ? 'The ROS connection is active.'
                      : 'Disconnected. Waiting for a connection.'}
                  </p>
                </div>
              )}
            </div>
            <div
              id="sidebar-view-Sources"
              role="tabpanel"
              aria-labelledby="sidebar-tab-Sources"
              hidden={activeTab !== 'Sources'}
              className="inspector-view"
            >
              <details className="source-details" open>
                <summary>
                  <Radio size={14} />
                  <span>{bridgeUrl}</span>
                </summary>
                <dl>
                  <dt>Protocol</dt>
                  <dd>ROS bridge / WebSocket</dd>
                  <dt>Status</dt>
                  <dd>{connected ? 'Connected' : 'Disconnected'}</dd>
                  <dt>Topics</dt>
                  <dd>{connected ? topics.length : 'Unavailable'}</dd>
                </dl>
                <div className="source-settings">
                  <span>Connection settings</span>
                  <ConnectionSettings
                    currentUrl={bridgeUrl}
                    onUrlChange={handleUrlChange}
                    currentMode={streamMode}
                    onModeChange={setStreamMode}
                  />
                </div>
              </details>
            </div>
            <div
              className="sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={sidebarWidth}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              tabIndex={0}
              onPointerDown={startSidebarResize}
              onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 48 : 16;
                if (event.key === 'ArrowLeft')
                  setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, sidebarWidth - step));
                else if (event.key === 'ArrowRight')
                  setSidebarWidth(Math.min(window.innerWidth * 0.8, sidebarWidth + step));
              }}
            />
          </aside>
          <main className="workspace-canvas" aria-label="Visualization workspace">
            {hydrated && (
              <PanelMosaic
                widgets={layout.widgets}
                mosaic={layout.mosaic ?? null}
                onMosaicChange={updateMosaic}
                onRemoveWidget={removeWidget}
                onToggleLock={toggleLock}
                client={connected ? client : null}
                topics={topics}
                topicsLoading={loading}
                onRefreshTopics={refreshTopics}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={selectWidget}
                settingsTarget={settingsTarget}
                onCloseSettings={closeSettings}
                onUpdateWidget={updateWidget}
              />
            )}
            {layout.widgets.length === 0 && (
              <div className="workspace-empty">
                <ListTree size={28} />
                <h1>Your workspace is clear</h1>
                <p>Choose Add panel to start visualizing your robot.</p>
              </div>
            )}
          </main>
        </div>
        <footer className="workspace-footer">
          <span className="flex items-center gap-2">
            <Radio size={12} />
            {connected ? 'Connected to ROS' : 'Disconnected'}
          </span>
          <span>{layout.widgets.length} panels · ROS 2</span>
        </footer>
      </div>
    </SettingsSearchContext.Provider>
  );
}
