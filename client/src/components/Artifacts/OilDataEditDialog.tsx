import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogFooter,
  Button,
  Spinner,
  useToastContext,
} from '@librechat/client';
import type { Artifact } from '~/common';
import { useExecuteMCPTool } from '~/data-provider/MCP';
import { buildOilDataDisplayRows, flattenOilDataForSave, MIME_TO_SCHEMA, SCHEMA_LABELS, createBlankRecord, parseCompositeContent } from './oilDataUtils';
import type { OilSingleSchema } from './oilDataUtils';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';

type FlatRecord = Record<string, unknown>;

const SCHEMA_SAVE_CONFIG: Record<OilSingleSchema, { server: string; tool: string }> = {
  'oil-data': { server: 'oilfield-wells', tool: 'save_well_data' },
  'drilling-daily': { server: 'oilfield-dailyreports', tool: 'save_drilling_daily' },
  'pre-daily': { server: 'oilfield-dailyreports', tool: 'save_drilling_pre_daily' },
  'key-well': { server: 'oilfield-dailyreports', tool: 'save_key_well_daily' },
  analysis: { server: 'oilfield-operations', tool: 'save_well_analysis' },
  workover: { server: 'oilfield-operations', tool: 'save_workover_record' },
  perforation: { server: 'oilfield-operations', tool: 'save_perforation_record' },
  diagram: { server: 'oilfield-operations', tool: 'save_wellbore_diagram' },
};

function parseAndFlattenRecords(content: string | undefined): FlatRecord[] {
  if (!content) {
    return [];
  }
  try {
    const trimmed = content.trim();
    const jsonStr = trimmed.startsWith('```')
      ? trimmed.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
      : trimmed;
    const parsed = JSON.parse(jsonStr) as unknown;
    let rawArray: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      rawArray = (parsed as unknown[]).filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      );
    } else if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      rawArray = [parsed as Record<string, unknown>];
    } else {
      rawArray = [];
    }
    return rawArray.map((r) => flattenOilDataForSave(r));
  } catch {
    return [];
  }
}

function getRecordLabel(record: FlatRecord): string {
  const jh = record['jh'] ?? record['well_name'];
  return typeof jh === 'string' && jh ? jh : '记录';
}

function downloadJson(data: FlatRecord[], title: string) {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${(title || 'oil-data').replace(/\s+/g, '_')}_${date}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function EditableTable({
  record,
  schema,
  onChange,
  localize,
  alwaysEdit = false,
}: {
  record: FlatRecord;
  schema: OilSingleSchema;
  onChange: (updated: FlatRecord) => void;
  localize: (key: TranslationKeys) => string;
  alwaysEdit?: boolean;
}) {
  const rows = buildOilDataDisplayRows(record, schema, { includeEmpty: true });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (fieldKey: string) => {
    const raw = record[fieldKey];
    setDraft(raw !== null && raw !== undefined ? String(raw) : '');
    setEditingKey(fieldKey);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const commitEdit = useCallback(() => {
    if (editingKey === null) {
      return;
    }
    const original = record[editingKey];
    let newValue: unknown = draft === '' ? null : draft;
    if (typeof original === 'number' && draft !== '') {
      const n = Number(draft);
      if (!isNaN(n)) {
        newValue = n;
      }
    }
    onChange({ ...record, [editingKey]: newValue });
    setEditingKey(null);
  }, [editingKey, draft, record, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingKey(null);
    }
  };

  const handleDirectChange = useCallback(
    (fieldKey: string, value: string) => {
      const original = record[fieldKey];
      let newValue: unknown = value === '' ? null : value;
      if (typeof original === 'number' && value !== '') {
        const n = Number(value);
        if (!isNaN(n)) newValue = n;
      }
      onChange({ ...record, [fieldKey]: newValue });
    },
    [record, onChange],
  );

  const renderedRows: React.ReactNode[] = [];
  let lastGroup = '';
  for (const row of rows) {
    if (row.groupLabel && row.groupLabel !== lastGroup) {
      lastGroup = row.groupLabel;
      renderedRows.push(
        <tr key={`group-${row.groupLabel}`}>
          <td colSpan={2} className="pb-1 pt-3">
            <div className="mx-3 flex items-center gap-2 rounded-md bg-blue-50/70 px-2.5 py-1.5 dark:bg-blue-900/30">
              <div className="h-3 w-[3px] rounded-full bg-blue-500 dark:bg-blue-400" />
              <span className="text-base font-semibold text-blue-600/80 dark:text-blue-300">
                {row.groupLabel}
              </span>
            </div>
          </td>
        </tr>,
      );
    }
    const isEditing = editingKey === row.fieldKey;
    const rawValue = record[row.fieldKey];
    const currentVal = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';
    renderedRows.push(
      <tr key={row.id} className="group border-b border-border-light/50 hover:bg-surface-secondary/30 dark:border-border-medium/40 dark:hover:bg-surface-secondary/50">
        <td className="w-[44%] py-2.5 pl-5 pr-2 align-middle">
          <span className="text-[15px] leading-snug text-text-primary">{row.fieldLabel}</span>
          <span className="mt-0.5 block font-mono text-[14px] text-blue-500 dark:text-blue-400">
            {row.fieldKey}
          </span>
        </td>
        <td className="py-1.5 pl-2 pr-3 align-middle" onClick={() => !alwaysEdit && !isEditing && startEdit(row.fieldKey)}>
          {alwaysEdit ? (
            <input
              className="w-full rounded border border-border-light bg-white/5 px-2 py-1 text-[15px] text-text-primary outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 dark:border-white/30 dark:bg-white/5 dark:text-white dark:placeholder-white/30 dark:focus:border-blue-400 dark:focus:bg-white/8 dark:focus:ring-blue-400/30"
              value={currentVal}
              placeholder="—"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              onChange={(e) => handleDirectChange(row.fieldKey, e.target.value)}
            />
          ) : isEditing ? (
            <input
              ref={inputRef}
              className="w-full rounded border border-blue-400 bg-white/5 px-2 py-1 text-[15px] text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 dark:border-blue-400 dark:bg-white/5 dark:text-white dark:focus:border-blue-400 dark:focus:bg-white/8 dark:focus:ring-blue-400/30"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <div className="flex cursor-pointer items-center justify-between gap-1 rounded px-1 py-1 transition-colors group-hover:bg-surface-hover">
              <span className="text-[15px] text-text-primary">
                {row.valueText !== '' ? (
                  row.valueText
                ) : (
                  <span className="italic text-text-tertiary">—</span>
                )}
              </span>
              <Pencil className="size-3 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-60" />
            </div>
          )}
        </td>
      </tr>,
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border-medium bg-surface-secondary/60">
          <th className="py-2.5 pl-5 text-left text-sm font-semibold text-text-primary">
            {localize('com_ui_oil_field_label')}
          </th>
          <th className="py-2.5 pl-3 pr-4 text-left text-sm font-semibold text-text-primary">
            {alwaysEdit ? '值' : localize('com_ui_oil_field_value_click')}
          </th>
        </tr>
      </thead>
      <tbody>{renderedRows}</tbody>
      {rows.length === 0 && (
        <tfoot>
          <tr>
            <td colSpan={2} className="py-8 text-center text-sm text-text-secondary">
              {localize('com_ui_oil_no_fields')}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export interface OilDataEditDialogProps {
  open: boolean;
  onClose: () => void;
  artifact: Artifact;
}

export default function OilDataEditDialog({
  open,
  onClose,
  artifact,
}: OilDataEditDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const schemaRaw = MIME_TO_SCHEMA[artifact.type ?? ''] ?? 'oil-data';
  const isComposite = schemaRaw === 'composite';
  const schema: OilSingleSchema = isComposite ? 'oil-data' : schemaRaw;

  const [records, setRecords] = useState<FlatRecord[]>([]);
  const [recordSchemas, setRecordSchemas] = useState<OilSingleSchema[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [newRecordIndices, setNewRecordIndices] = useState<Set<number>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const recordsRef = useRef<FlatRecord[]>(records);
  recordsRef.current = records;

  const saveProgressRef = useRef({ ok: 0, err: 0, total: 0 });

  useEffect(() => {
    if (open) {
      if (isComposite) {
        const compositeData = parseCompositeContent(artifact.content ?? '');
        const flatRecords: FlatRecord[] = [];
        const schemas: OilSingleSchema[] = [];
        if (compositeData) {
          for (const [schemaKey, group] of compositeData) {
            for (const record of group.records) {
              flatRecords.push(flattenOilDataForSave(record));
              schemas.push(schemaKey);
            }
          }
        }
        setRecords(flatRecords);
        setRecordSchemas(schemas);
      } else {
        const parsed = parseAndFlattenRecords(artifact.content);
        setRecords(parsed);
        setRecordSchemas(parsed.map(() => schema));
      }
      setCurrentIndex(0);
      setSavedCount(0);
      setIsSaving(false);
      setNewRecordIndices(new Set());
      setConfirmingDelete(false);
      saveProgressRef.current = { ok: 0, err: 0, total: 0 };
    }
  }, [open, artifact.content, isComposite, schema]);

  const total = records.length;
  const current = Math.min(currentIndex, Math.max(0, total - 1));
  const currentRecord = records[current];

  const currentSchema = recordSchemas[current] ?? schema;

  const updateCurrentRecord = useCallback(
    (updated: FlatRecord) => {
      setRecords((prev) => prev.map((r, i) => (i === current ? updated : r)));
    },
    [current],
  );

  const addRecord = useCallback(() => {
    const blank: FlatRecord = createBlankRecord(currentSchema);
    const newIdx = records.length;
    setRecords((prev) => [...prev, blank]);
    setRecordSchemas((prev) => [...prev, currentSchema]);
    setCurrentIndex(newIdx);
    setNewRecordIndices((prev) => new Set([...prev, newIdx]));
  }, [records, currentSchema]);

  const discardNewRecord = useCallback(() => {
    setRecords((prev) => prev.filter((_, i) => i !== current));
    setRecordSchemas((prev) => prev.filter((_, i) => i !== current));
    setNewRecordIndices((prev) => { const next = new Set(prev); next.delete(current); return next; });
    setCurrentIndex(Math.max(0, current - 1));
  }, [current]);

  const confirmNewRecord = useCallback(() => {
    setNewRecordIndices((prev) => { const next = new Set(prev); next.delete(current); return next; });
  }, [current]);

  const deleteCurrentRecord = useCallback(() => {
    if (total <= 1) {
      showToast({ message: localize('com_ui_delete_record_min'), status: 'warning' });
      return;
    }
    setRecords((prev) => prev.filter((_, i) => i !== current));
    setRecordSchemas((prev) => prev.filter((_, i) => i !== current));
    setCurrentIndex(Math.max(0, current - 1));
    setConfirmingDelete(false);
  }, [current, total, showToast, localize]);

  const recordSchemasRef = useRef<OilSingleSchema[]>(recordSchemas);
  recordSchemasRef.current = recordSchemas;

  const { mutate: executeSave } = useExecuteMCPTool({
    onSuccess: (data) => {
      saveProgressRef.current.ok++;
      setSavedCount(saveProgressRef.current.ok + saveProgressRef.current.err);
      const { ok, err, total: t } = saveProgressRef.current;
      if (ok + err >= t) {
        setIsSaving(false);
        if (err === 0) {
          showToast({
            message: data.result || localize('com_ui_save_to_database_success'),
            status: 'success',
          });
          downloadJson(recordsRef.current, artifact.title ?? 'oil-data');
          onClose();
        }
      }
    },
    onError: (error) => {
      saveProgressRef.current.err++;
      setSavedCount(saveProgressRef.current.ok + saveProgressRef.current.err);
      showToast({
        message: error.message || localize('com_ui_save_to_database_error'),
        status: 'error',
      });
      const { ok, err, total: t } = saveProgressRef.current;
      if (ok + err >= t) {
        setIsSaving(false);
      }
    },
  });

  const handleSave = useCallback(() => {
    if (records.length === 0 || isSaving) {
      return;
    }
    saveProgressRef.current = { ok: 0, err: 0, total: records.length };
    setSavedCount(0);
    setIsSaving(true);
    for (let i = 0; i < records.length; i++) {
      const recSchema = recordSchemasRef.current[i] ?? schema;
      const saveConfig = SCHEMA_SAVE_CONFIG[recSchema];
      executeSave({
        serverName: saveConfig.server,
        toolName: saveConfig.tool,
        toolArguments: records[i],
      });
    }
  }, [records, isSaving, executeSave, schema]);

  const isNewRecord = newRecordIndices.has(current);

  return (
    <>
      <OGDialog open={open} onOpenChange={(isOpen) => !isOpen && !isSaving && onClose()}>
        <OGDialogContent
          className="flex max-h-[90vh] w-[90vw] max-w-3xl flex-col overflow-hidden bg-surface-primary dark:border-gray-700"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
        <OGDialogHeader className="flex-shrink-0 px-4 pt-4">
          <OGDialogTitle className="flex items-center justify-between">
            <span>{isNewRecord ? '新增记录' : localize('com_ui_edit_and_save_data')}</span>
            {!isNewRecord && total > 0 && currentRecord != null && (
              <span className="text-sm font-normal text-text-secondary">
                {isComposite && SCHEMA_LABELS[currentSchema] ? `[${SCHEMA_LABELS[currentSchema]}] ` : ''}
                {getRecordLabel(currentRecord)}&nbsp;&nbsp;{current + 1} / {total}
              </span>
            )}
          </OGDialogTitle>
        </OGDialogHeader>

        {/* 记录导航 & 操作 */}
        {!isNewRecord && (
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light px-4 py-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="上一条"
                disabled={current === 0}
                onClick={() => { setCurrentIndex(current - 1); }}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-surface-hover dark:text-gray-200 dark:hover:bg-surface-hover disabled:opacity-30"
                aria-label="上一条"
              >
                <ChevronLeft className="size-5" />
                上一条
              </button>
              <button
                type="button"
                title="下一条"
                disabled={current >= total - 1}
                onClick={() => { setCurrentIndex(current + 1); }}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-surface-hover dark:text-gray-200 dark:hover:bg-surface-hover disabled:opacity-30"
                aria-label="下一条"
              >
                下一条
                <ChevronRight className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={addRecord}
                disabled={isSaving}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
              >
                <Plus className="size-4" aria-hidden="true" />
                {localize('com_ui_add_record')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                disabled={total <= 1 || isSaving}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-30"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {localize('com_ui_delete_record')}
              </Button>
            </div>
          </div>
        )}

        {/* 可编辑表格 */}
        <div className="min-h-0 flex-1 overflow-auto">
          {currentRecord != null ? (
            <EditableTable
              key={current}
              record={currentRecord}
              schema={currentSchema}
              onChange={updateCurrentRecord}
              localize={localize}
              alwaysEdit={isNewRecord}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
              {localize('com_ui_oil_no_data')}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border-light px-4 py-3">
          {isNewRecord ? (
            <>
              <Button variant="ghost" onClick={discardNewRecord} disabled={isSaving}>
                取消
              </Button>
              <Button
                variant="default"
                onClick={confirmNewRecord}
                className="flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              >
                确认新增
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                {localize('com_ui_cancel')}
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving || records.length === 0}
                className="flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-green-600/50"
              >
                {isSaving && <Spinner size={14} />}
                {isSaving
                  ? `${localize('com_ui_saving')} ${savedCount}/${total}`
                  : localize('com_ui_save_and_download')}
              </Button>
            </>
          )}
        </div>
      </OGDialogContent>
    </OGDialog>

    <OGDialog open={confirmingDelete} onOpenChange={(open) => !open && setConfirmingDelete(false)}>
      <OGDialogContent className="w-80 bg-surface-primary dark:border-gray-700" showCloseButton={false}>
        <OGDialogHeader>
          <OGDialogTitle className="flex items-center gap-2 text-base">
            <Trash2 className="size-4 text-red-500" aria-hidden="true" />
            删除记录
          </OGDialogTitle>
        </OGDialogHeader>
        <p className="text-sm text-text-secondary">
          确认要删除当前记录「{currentRecord != null ? getRecordLabel(currentRecord) : ''}」？删除后无法恢复。
        </p>
        <OGDialogFooter className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
            取消
          </Button>
          <Button
            variant="default"
            onClick={deleteCurrentRecord}
            className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
          >
            确认删除
          </Button>
        </OGDialogFooter>
      </OGDialogContent>
    </OGDialog>
    </>
  );
}
