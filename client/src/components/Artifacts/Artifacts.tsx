import { useRef, useState, useEffect, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Code, Play, RefreshCw, X, Save } from 'lucide-react';
import { useSetRecoilState, useResetRecoilState } from 'recoil';
import { Button, Spinner, useMediaQuery, Radio, useToastContext } from '@librechat/client';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react';
import { useShareContext, useMutationState } from '~/Providers';
import { useExecuteMCPTool } from '~/data-provider/MCP';
import useArtifacts from '~/hooks/Artifacts/useArtifacts';
import DownloadArtifact from './DownloadArtifact';
import ArtifactVersion from './ArtifactVersion';
import ArtifactTabs from './ArtifactTabs';
import { CopyCodeButton } from './Code';
import { flattenOilDataForSave, parseCompositeContent, isSingleSchema, SCHEMA_LABELS } from './oilDataUtils';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const OIL_SAVE_CONFIG: Record<string, { server: string; tool: string }> = {
  'application/vnd.oil-data': { server: 'oilfield-wells', tool: 'save_well_data' },
  'application/vnd.oil-drilling-daily': {
    server: 'oilfield-dailyreports',
    tool: 'save_drilling_daily',
  },
  'application/vnd.oil-pre-daily': {
    server: 'oilfield-dailyreports',
    tool: 'save_drilling_pre_daily',
  },
  'application/vnd.oil-key-well': {
    server: 'oilfield-dailyreports',
    tool: 'save_key_well_daily',
  },
  'application/vnd.oil-analysis': { server: 'oilfield-operations', tool: 'save_well_analysis' },
  'application/vnd.oil-workover': { server: 'oilfield-operations', tool: 'save_workover_record' },
  'application/vnd.oil-perforation': {
    server: 'oilfield-operations',
    tool: 'save_perforation_record',
  },
  'application/vnd.oil-diagram': {
    server: 'oilfield-operations',
    tool: 'save_wellbore_diagram',
  },
};

const SCHEMA_TO_MIME: Record<string, string> = {
  'oil-data': 'application/vnd.oil-data',
  'drilling-daily': 'application/vnd.oil-drilling-daily',
  'pre-daily': 'application/vnd.oil-pre-daily',
  'key-well': 'application/vnd.oil-key-well',
  analysis: 'application/vnd.oil-analysis',
  workover: 'application/vnd.oil-workover',
  perforation: 'application/vnd.oil-perforation',
  diagram: 'application/vnd.oil-diagram',
};

const MAX_BLUR_AMOUNT = 32;
const MAX_BACKDROP_OPACITY = 0.3;

export default function Artifacts() {
  const localize = useLocalize();
  const { isMutating } = useMutationState();
  const { isSharedConvo } = useShareContext();
  const isMobile = useMediaQuery('(max-width: 868px)');
  const previewRef = useRef<SandpackPreviewRef>();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [height, setHeight] = useState(90);
  const [isDragging, setIsDragging] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(90);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);
  const resetCurrentArtifactId = useResetRecoilState(store.currentArtifactId);

  const tabOptions = [
    {
      value: 'code',
      label: localize('com_ui_code'),
      icon: <Code className="size-4" />,
    },
    {
      value: 'preview',
      label: localize('com_ui_preview'),
      icon: <Play className="size-4" />,
    },
  ];

  useEffect(() => {
    setIsMounted(true);
    const delay = isMobile ? 50 : 30;
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => {
      clearTimeout(timer);
      setIsMounted(false);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setBlurAmount(0);
      return;
    }

    const minHeightForBlur = 50;
    const maxHeightForBlur = 100;

    if (height <= minHeightForBlur) {
      setBlurAmount(0);
    } else if (height >= maxHeightForBlur) {
      setBlurAmount(MAX_BLUR_AMOUNT);
    } else {
      const progress = (height - minHeightForBlur) / (maxHeightForBlur - minHeightForBlur);
      setBlurAmount(Math.round(progress * MAX_BLUR_AMOUNT));
    }
  }, [height, isMobile]);

  const { showToast } = useToastContext();

  const {
    activeTab,
    setActiveTab,
    currentIndex,
    currentArtifact,
    orderedArtifactIds,
    setCurrentArtifactId,
  } = useArtifacts();

  const isOilData =
    currentArtifact?.type != null &&
    (currentArtifact.type in OIL_SAVE_CONFIG ||
      currentArtifact.type === 'application/vnd.oil-composite');

  const { mutate: executeOilSave, isLoading: isSaving } = useExecuteMCPTool({
    onSuccess: (data) => {
      showToast({
        message: data.result || localize('com_ui_save_to_database_success'),
        status: 'success',
      });
    },
    onError: (error) => {
      showToast({
        message: error.message || localize('com_ui_save_to_database_error'),
        status: 'error',
      });
    },
  });

  const handleSaveToDatabase = useCallback(() => {
    if (!currentArtifact?.content || !currentArtifact.type) {
      return;
    }

    const isComposite = currentArtifact.type === 'application/vnd.oil-composite';

    if (isComposite) {
      const compositeData = parseCompositeContent(currentArtifact.content);
      if (!compositeData) {
        showToast({ message: localize('com_ui_save_to_database_error'), status: 'error' });
        return;
      }
      const parts: string[] = [];
      for (const [schema, group] of compositeData) {
        const mime = SCHEMA_TO_MIME[schema];
        const saveConfig = mime ? OIL_SAVE_CONFIG[mime] : undefined;
        if (!saveConfig) {
          continue;
        }
        for (const record of group.records) {
          executeOilSave({
            serverName: saveConfig.server,
            toolName: saveConfig.tool,
            toolArguments: flattenOilDataForSave(record),
          });
        }
        if (isSingleSchema(schema)) {
          parts.push(`${SCHEMA_LABELS[schema]} ×${group.records.length}`);
        }
      }
      if (parts.length > 0) {
        showToast({
          message: `${localize('com_ui_save_all_started')}：${parts.join('、')}`,
          status: 'success',
        });
      }
      return;
    }

    const saveConfig = OIL_SAVE_CONFIG[currentArtifact.type];
    if (!saveConfig) {
      return;
    }
    try {
      const trimmed = currentArtifact.content.trim();
      const jsonStr = trimmed.startsWith('```')
        ? trimmed.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
        : trimmed;
      const raw = JSON.parse(jsonStr) as unknown;
      if (raw === null || typeof raw !== 'object') {
        showToast({ message: localize('com_ui_save_to_database_error'), status: 'error' });
        return;
      }
      const records: Array<Record<string, unknown>> = Array.isArray(raw)
        ? (raw as unknown[]).filter(
            (item): item is Record<string, unknown> =>
              item !== null && typeof item === 'object' && !Array.isArray(item),
          )
        : [raw as Record<string, unknown>];
      for (const record of records) {
        executeOilSave({
          serverName: saveConfig.server,
          toolName: saveConfig.tool,
          toolArguments: flattenOilDataForSave(record),
        });
      }
    } catch {
      showToast({ message: localize('com_ui_save_to_database_error'), status: 'error' });
      return;
    }
  }, [currentArtifact, executeOilSave, localize, showToast]);

  const handleDragStart = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }

    const deltaY = dragStartY.current - e.clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercentage = (deltaY / viewportHeight) * 100;
    const newHeight = Math.max(10, Math.min(100, dragStartHeight.current + deltaPercentage));

    setHeight(newHeight);
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Snap to positions based on final height
    if (height < 30) {
      closeArtifacts();
    } else if (height > 95) {
      setHeight(100);
    } else if (height < 60) {
      setHeight(50);
    } else {
      setHeight(90);
    }
  };

  if (!currentArtifact || !isMounted) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    const client = previewRef.current?.getClient();
    if (client) {
      client.dispatch({ type: 'refresh' });
    }
    setTimeout(() => setIsRefreshing(false), 750);
  };

  const closeArtifacts = () => {
    if (isMobile) {
      setIsClosing(true);
      setIsVisible(false);
      setTimeout(() => {
        setArtifactsVisible(false);
        setIsClosing(false);
        setHeight(90);
      }, 250);
    } else {
      resetCurrentArtifactId();
      setArtifactsVisible(false);
    }
  };

  const backdropOpacity =
    blurAmount > 0
      ? (Math.min(blurAmount, MAX_BLUR_AMOUNT) / MAX_BLUR_AMOUNT) * MAX_BACKDROP_OPACITY
      : 0;

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} asChild>
      <div className="flex h-full w-full flex-col">
        {/* Mobile backdrop with dynamic blur */}
        {isMobile && (
          <div
            className={cn(
              'fixed inset-0 z-[99] bg-black will-change-[opacity,backdrop-filter]',
              isVisible && !isClosing
                ? 'transition-all duration-300'
                : 'pointer-events-none opacity-0 backdrop-blur-none transition-opacity duration-150',
              blurAmount < 8 && isVisible && !isClosing ? 'pointer-events-none' : '',
            )}
            style={{
              opacity: isVisible && !isClosing ? backdropOpacity : 0,
              backdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
              WebkitBackdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
            }}
            onClick={blurAmount >= 8 ? closeArtifacts : undefined}
            aria-hidden="true"
          />
        )}
        <div
          className={cn(
            'flex w-full flex-col bg-surface-primary text-xl text-text-primary',
            isMobile
              ? cn(
                  'fixed inset-x-0 bottom-0 z-[100] rounded-t-[20px] shadow-[0_-10px_60px_rgba(0,0,0,0.35)]',
                  isVisible && !isClosing
                    ? 'translate-y-0 opacity-100'
                    : 'duration-250 translate-y-full opacity-0 transition-all',
                  isDragging ? '' : 'transition-all duration-300',
                )
              : cn(
                  'h-full shadow-2xl',
                  isVisible && !isClosing
                    ? 'duration-350 translate-x-0 opacity-100 transition-all'
                    : 'translate-x-5 opacity-0 transition-all duration-300',
                ),
          )}
          style={isMobile ? { height: `${height}vh` } : { overflow: 'hidden' }}
        >
          {isMobile && (
            <div
              className="flex flex-shrink-0 cursor-grab items-center justify-center bg-surface-primary-alt pb-1.5 pt-2.5 active:cursor-grabbing"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="h-1 w-12 rounded-full bg-border-xheavy opacity-40 transition-all duration-200 active:opacity-60" />
            </div>
          )}

          {/* Header */}
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between gap-2 border-b border-border-light bg-surface-primary-alt px-3 py-2 transition-all duration-300',
              isMobile ? 'justify-center' : 'overflow-hidden',
            )}
          >
            {!isMobile && (
              <div
                className={cn(
                  'flex items-center transition-all duration-500',
                  isVisible && !isClosing
                    ? 'translate-x-0 opacity-100'
                    : '-translate-x-2 opacity-0',
                )}
              >
                <Radio
                  options={tabOptions}
                  value={activeTab}
                  onChange={setActiveTab}
                  disabled={isMutating && activeTab !== 'code'}
                />
              </div>
            )}

            <div
              className={cn(
                'flex items-center gap-2 transition-all duration-500',
                isMobile ? 'min-w-max' : '',
                isVisible && !isClosing ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0',
              )}
            >
              {activeTab === 'preview' && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label={localize('com_ui_refresh')}
                >
                  {isRefreshing ? (
                    <Spinner size={16} />
                  ) : (
                    <RefreshCw
                      size={16}
                      className="transition-transform duration-200"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              )}
              {activeTab !== 'preview' && isMutating && (
                <RefreshCw size={16} className="animate-spin text-text-secondary" />
              )}
              {orderedArtifactIds.length > 1 && (
                <ArtifactVersion
                  currentIndex={currentIndex}
                  totalVersions={orderedArtifactIds.length}
                  onVersionChange={(index) => {
                    const target = orderedArtifactIds[index];
                    if (target) {
                      setCurrentArtifactId(target);
                    }
                  }}
                />
              )}
              <CopyCodeButton content={currentArtifact.content ?? ''} />
              <DownloadArtifact artifact={currentArtifact} />
              {isOilData && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  aria-label={localize('com_ui_save_to_database')}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {isSaving ? (
                    <Spinner size={14} />
                  ) : (
                    <Save size={14} aria-hidden="true" />
                  )}
                  {isSaving
                    ? localize('com_ui_saving')
                    : currentArtifact?.type === 'application/vnd.oil-composite'
                      ? localize('com_ui_save_all')
                      : localize('com_ui_save_to_database')}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={closeArtifacts}
                aria-label={localize('com_ui_close')}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-primary">
            <div className="absolute inset-0 flex flex-col">
              <ArtifactTabs
                artifact={currentArtifact}
                previewRef={previewRef as React.MutableRefObject<SandpackPreviewRef>}
                isSharedConvo={isSharedConvo}
              />
            </div>

            <div
              className={cn(
                'absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
                isRefreshing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
              )}
              aria-hidden={!isRefreshing}
              role="status"
            >
              <div
                className={cn(
                  'transition-transform duration-300 ease-in-out',
                  isRefreshing ? 'scale-100' : 'scale-95',
                )}
              >
                <Spinner size={24} />
              </div>
            </div>
          </div>

          {isMobile && (
            <div className="flex-shrink-0 border-t border-border-light bg-surface-primary-alt p-2">
              <Radio
                fullWidth
                options={tabOptions}
                value={activeTab}
                onChange={setActiveTab}
                disabled={isMutating && activeTab !== 'code'}
              />
            </div>
          )}
        </div>
      </div>
    </Tabs.Root>
  );
}
