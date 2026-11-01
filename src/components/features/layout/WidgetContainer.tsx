'use client';

import { useMemo } from 'react';
import type { WidgetConfig } from '@/types/widget';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { usePanel } from '@/panels';
import PanelErrorBoundary from '@/panels/PanelErrorBoundary';
import MissingPanel from '@/panels/MissingPanel';
import { PanelStatusContext, WidgetSettingsContext } from './WidgetSettingsPortal';
import { widgetStyles } from '@/styles';

interface WidgetContainerProps {
  widget: WidgetConfig;
  client: BridgeClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  settingsTarget: HTMLElement | null;
  /** Slot in the panel's tab bar for live status. */
  statusTarget?: HTMLElement | null;
  onCloseSettings: () => void;
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
}

/** Shows a layout's panel with the component its type is registered with (see `@/panels`). */
export default function WidgetContainer({
  widget,
  client,
  topics,
  topicsLoading,
  onRefreshTopics,
  settingsTarget,
  statusTarget = null,
  onCloseSettings,
  onUpdateWidget,
}: WidgetContainerProps) {
  const panel = usePanel(widget.type);
  const normalize = panel?.normalizeConfig;
  const config = useMemo(
    () => (normalize ? normalize(widget.props) : widget.props),
    [normalize, widget.props]
  );
  const Panel = panel?.component;
  return (
    <WidgetSettingsContext.Provider value={{ target: settingsTarget, close: onCloseSettings }}>
      <PanelStatusContext.Provider value={statusTarget}>
        <div className={widgetStyles.content.inner}>
          {panel && Panel ? (
            // A new version of the panel starts over, even after an error.
            <PanelErrorBoundary key={panel.revision} title={widget.title}>
              <Panel
                id={widget.i}
                config={config}
                updateConfig={(patch: object) =>
                  onUpdateWidget(widget.i, { props: { ...(config as object), ...patch } })
                }
                setConfig={(props: unknown) => onUpdateWidget(widget.i, { props })}
                client={client}
                topics={topics}
                topicsLoading={topicsLoading}
                refreshTopics={onRefreshTopics}
              />
            </PanelErrorBoundary>
          ) : (
            <MissingPanel type={widget.type} />
          )}
        </div>
      </PanelStatusContext.Provider>
    </WidgetSettingsContext.Provider>
  );
}
