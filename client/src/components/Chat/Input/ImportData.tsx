import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { Database, FileUp, CheckCircle2, Loader2 } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { EToolResources } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useChatContext } from '~/Providers';
import { useFileHandling, useSubmitMessage, useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ImportType {
  id: string;
  labelKey: TranslationKeys;
  prompt: string;
}

const ARTIFACT_FORMAT_HINT =
  '必须使用以下格式输出，不要有其他文字：\n:::artifact{identifier="oil-data-import" type="TYPE_PLACEHOLDER" title="TITLE_PLACEHOLDER"}\n```json\n[...数据数组...]\n```\n:::';

const IMPORT_TYPES: ImportType[] = [
  {
    id: 'gas',
    labelKey: 'com_ui_import_gas_analysis',
    prompt:
      '从上传文档提取气样化验数据，yplx 字段填写"气样"。' +
      ARTIFACT_FORMAT_HINT.replace('TYPE_PLACEHOLDER', 'application/vnd.oil-analysis').replace(
        'TITLE_PLACEHOLDER',
        '气样化验数据',
      ),
  },
  {
    id: 'water',
    labelKey: 'com_ui_import_water_analysis',
    prompt:
      '从上传文档提取水样化验数据，yplx 字段填写"水样"。' +
      ARTIFACT_FORMAT_HINT.replace('TYPE_PLACEHOLDER', 'application/vnd.oil-analysis').replace(
        'TITLE_PLACEHOLDER',
        '水样化验数据',
      ),
  },
  {
    id: 'workover',
    labelKey: 'com_ui_import_workover',
    prompt:
      '从上传文档提取修井记录。' +
      ARTIFACT_FORMAT_HINT.replace('TYPE_PLACEHOLDER', 'application/vnd.oil-workover').replace(
        'TITLE_PLACEHOLDER',
        '修井记录',
      ),
  },
  {
    id: 'perforation',
    labelKey: 'com_ui_import_perforation',
    prompt:
      '从上传文档提取射孔记录。' +
      ARTIFACT_FORMAT_HINT.replace('TYPE_PLACEHOLDER', 'application/vnd.oil-perforation').replace(
        'TITLE_PLACEHOLDER',
        '射孔记录',
      ),
  },
  {
    id: 'diagram',
    labelKey: 'com_ui_import_wellbore_diagram',
    prompt:
      '从上传文档提取井身结构信息。' +
      ARTIFACT_FORMAT_HINT.replace('TYPE_PLACEHOLDER', 'application/vnd.oil-diagram').replace(
        'TITLE_PLACEHOLDER',
        '井身结构',
      ),
  },
];

function ImportData() {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [pendingFileKey, setPendingFileKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFileKeysRef = useRef<Set<string>>(new Set());

  const { files } = useChatContext();
  const { handleFileChange } = useFileHandling();
  const { submitMessage } = useSubmitMessage();

  const pendingFile = pendingFileKey != null ? files.get(pendingFileKey) : null;
  const isFileReady = pendingFile != null && pendingFile.progress === 1;
  const isUploading = pendingFile != null && pendingFile.progress < 1;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        initialFileKeysRef.current = new Set(files.keys());
      } else {
        setSelectedTypeId(null);
        setPendingFileKey(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [files],
  );

  useEffect(() => {
    if (!open) return;
    for (const [key] of files) {
      if (!initialFileKeysRef.current.has(key)) {
        setPendingFileKey(key);
        return;
      }
    }
  }, [files, open]);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleTypeSelect = useCallback((typeId: string) => {
    setSelectedTypeId(typeId);
    setPendingFileKey(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleExtract = useCallback(() => {
    const selectedType = IMPORT_TYPES.find((t) => t.id === selectedTypeId);
    if (!selectedType || !isFileReady) return;
    setOpen(false);
    submitMessage({ text: selectedType.prompt });
  }, [selectedTypeId, isFileReady, submitMessage]);

  const canPickFile = selectedTypeId != null && !isUploading;

  return (
    <>
      <button
        type="button"
        aria-label={localize('com_ui_import_data')}
        onClick={() => handleOpenChange(true)}
        className={cn(
          'group relative inline-flex items-center justify-center gap-1.5',
          'rounded-full border border-border-medium text-sm font-medium',
          'size-9 p-2 transition-all md:w-full md:p-3',
          'bg-transparent shadow-sm hover:bg-surface-hover hover:shadow-md active:shadow-inner',
        )}
      >
        <span className="icon-md text-text-primary">
          <Database className="icon-md" aria-hidden="true" />
        </span>
        <span className="hidden truncate md:block">{localize('com_ui_import_data')}</span>
      </button>

      <OGDialog open={open} onOpenChange={handleOpenChange}>
        <OGDialogContent className="w-[90vw] max-w-md bg-white dark:border-gray-700 dark:bg-gray-850 dark:text-gray-300">
          <OGDialogHeader>
            <OGDialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Database className="size-4" aria-hidden="true" />
              {localize('com_ui_import_data')}
            </OGDialogTitle>
          </OGDialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <p className="mb-2 text-sm text-text-secondary">
                {localize('com_ui_import_data_select_type')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {IMPORT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeSelect(type.id)}
                    className={cn(
                      'rounded-lg border px-2 py-3 text-center text-xs font-medium transition-all',
                      'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                      selectedTypeId === type.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-border-medium bg-surface-secondary text-text-primary',
                    )}
                  >
                    {localize(type.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={canPickFile ? handlePickFile : undefined}
              disabled={!canPickFile}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-all',
                canPickFile
                  ? 'cursor-pointer border-border-medium hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                  : 'cursor-not-allowed border-border-light opacity-40',
              )}
            >
              {isUploading && (
                <>
                  <Loader2 className="size-6 animate-spin text-blue-500" />
                  <span className="text-sm text-text-secondary">上传中…</span>
                </>
              )}
              {isFileReady && (
                <>
                  <CheckCircle2 className="size-6 text-green-500" />
                  <span className="max-w-full truncate text-sm text-green-600 dark:text-green-400">
                    {pendingFile?.filename ?? pendingFile?.file?.name ?? '文件已上传'}
                  </span>
                  <span className="text-xs text-text-secondary">点击重新选择</span>
                </>
              )}
              {!isUploading && !isFileReady && (
                <>
                  <FileUp className="size-6 text-text-secondary" />
                  <span className="text-sm text-text-secondary">
                    {localize('com_ui_import_upload_file')}
                  </span>
                  <span className="text-xs text-text-secondary opacity-70">
                    PDF / 图片 / WPS
                  </span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.wps,.et,.doc,.docx"
              onChange={(e) => handleFileChange(e, EToolResources.context)}
            />

            <button
              type="button"
              onClick={handleExtract}
              disabled={!isFileReady || selectedTypeId == null}
              className={cn(
                'w-full rounded-lg py-2.5 text-sm font-medium transition-all',
                isFileReady && selectedTypeId != null
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'cursor-not-allowed bg-surface-tertiary text-text-secondary opacity-50',
              )}
            >
              {localize('com_ui_import_start_extract')}
            </button>
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}

export default memo(ImportData);
