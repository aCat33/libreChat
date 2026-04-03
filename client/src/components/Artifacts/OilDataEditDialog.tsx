import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Button,
  Spinner,
  useToastContext,
} from '@librechat/client';
import type { Artifact } from '~/common';
import { useExecuteMCPTool } from '~/data-provider/MCP';
import { buildOilDataDisplayRows, flattenOilDataForSave, MIME_TO_SCHEMA } from './oilDataUtils';
import type { OilSchema } from './oilDataUtils';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';

type FlatRecord = Record<string, unknown>;

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
}: {
  record: FlatRecord;
  schema: OilSchema;
  onChange: (updated: FlatRecord) => void;
  localize: (key: TranslationKeys) => string;
}) {
  const rows = buildOilDataDisplayRows(record, schema);
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

  const renderedRows: React.ReactNode[] = [];
  let lastGroup = '';
  for (const row of rows) {
    if (row.groupLabel && row.groupLabel !== lastGroup) {
      lastGroup = row.groupLabel;
      renderedRows.push(
        <tr key={`group-${row.groupLabel}`}>
          <td colSpan={2} className="pb-1 pl-4 pr-4 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-400/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {row.groupLabel}
              </span>
            </div>
          </td>
        </tr>,
      );
    }
    const isEditing = editingKey === row.fieldKey;
    renderedRows.push(
      <tr key={row.id} className="group border-b border-border-light/50 hover:bg-surface-secondary/30">
        <td className="w-[44%] py-2.5 pl-5 pr-2 align-middle">
          <span className="text-sm leading-snug text-text-primary">{row.fieldLabel}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-text-tertiary/70">
            {row.fieldKey}
          </span>
        </td>
        <td
          className="cursor-pointer py-1.5 pl-2 pr-3 align-middle"
          onClick={() => !isEditing && startEdit(row.fieldKey)}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              className="w-full rounded border border-blue-400 bg-surface-primary px-2 py-1 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <div className="flex items-center justify-between gap-1 rounded px-1 py-1 transition-colors group-hover:bg-surface-hover">
              <span className="text-sm text-text-primary">
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
          <th className="py-2 pl-5 text-left text-xs font-medium text-text-secondary">
            {localize('com_ui_oil_field_label')}
          </th>
          <th className="py-2 pl-3 pr-4 text-left text-xs font-medium text-text-secondary">
            {localize('com_ui_oil_field_value_click')}
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
  saveConfig: { server: string; tool: string };
}

export default function OilDataEditDialog({
  open,
  onClose,
  artifact,
  saveConfig,
}: OilDataEditDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const schema: OilSchema = MIME_TO_SCHEMA[artifact.type ?? ''] ?? 'oil-data';

  const [records, setRecords] = useState<FlatRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const recordsRef = useRef<FlatRecord[]>(records);
  recordsRef.current = records;

  const saveProgressRef = useRef({ ok: 0, err: 0, total: 0 });

  useEffect(() => {
    if (open) {
      const parsed = parseAndFlattenRecords(artifact.content);
      setRecords(parsed);
      setCurrentIndex(0);
      setSavedCount(0);
      setIsSaving(false);
      saveProgressRef.current = { ok: 0, err: 0, total: 0 };
    }
  }, [open, artifact.content]);

  const total = records.length;
  const current = Math.min(currentIndex, Math.max(0, total - 1));
  const currentRecord = records[current];

  const updateCurrentRecord = useCallback(
    (updated: FlatRecord) => {
      setRecords((prev) => prev.map((r, i) => (i === current ? updated : r)));
    },
    [current],
  );

  const addRecord = useCallback(() => {
    const template = records[0] ?? {};
    const blank: FlatRecord = Object.fromEntries(Object.keys(template).map((k) => [k, null]));
    setRecords((prev) => [...prev, blank]);
    setCurrentIndex(records.length);
  }, [records]);

  const deleteCurrentRecord = useCallback(() => {
    if (total <= 1) {
      showToast({ message: localize('com_ui_delete_record_min'), status: 'warning' });
      return;
    }
    setRecords((prev) => prev.filter((_, i) => i !== current));
    setCurrentIndex(Math.max(0, current - 1));
  }, [current, total, showToast, localize]);

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
    for (const record of records) {
      executeSave({
        serverName: saveConfig.server,
        toolName: saveConfig.tool,
        toolArguments: record,
      });
    }
  }, [records, isSaving, executeSave, saveConfig]);

  return (
    <OGDialog open={open} onOpenChange={(isOpen) => !isOpen && !isSaving && onClose()}>
      <OGDialogContent className="flex max-h-[90vh] w-[90vw] max-w-3xl flex-col overflow-hidden bg-surface-primary dark:border-gray-700">
        <OGDialogHeader className="flex-shrink-0 px-4 pt-4">
          <OGDialogTitle className="flex items-center justify-between">
            <span>{localize('com_ui_edit_and_save_data')}</span>
            {total > 0 && currentRecord != null && (
              <span className="text-sm font-normal text-text-secondary">
                {getRecordLabel(currentRecord)}&nbsp;&nbsp;{current + 1} / {total}
              </span>
            )}
          </OGDialogTitle>
        </OGDialogHeader>

        {/* 记录导航 & 操作 */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrentIndex(current - 1)}
              className="rounded p-1 hover:bg-surface-hover disabled:opacity-30"
              aria-label="上一条"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={current >= total - 1}
              onClick={() => setCurrentIndex(current + 1)}
              className="rounded p-1 hover:bg-surface-hover disabled:opacity-30"
              aria-label="下一条"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={addRecord}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {localize('com_ui_add_record')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={deleteCurrentRecord}
              disabled={total <= 1 || isSaving}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {localize('com_ui_delete_record')}
            </Button>
          </div>
        </div>

        {/* 可编辑表格 */}
        <div className="min-h-0 flex-1 overflow-auto">
          {currentRecord != null ? (
            <EditableTable
              key={current}
              record={currentRecord}
              schema={schema}
              onChange={updateCurrentRecord}
              localize={localize}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
              {localize('com_ui_oil_no_data')}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border-light px-4 py-3">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {localize('com_ui_cancel')}
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={isSaving || records.length === 0}
            className="flex items-center gap-1.5"
          >
            {isSaving && <Spinner size={14} />}
            {isSaving
              ? `${localize('com_ui_saving')} ${savedCount}/${total}`
              : localize('com_ui_save_and_download')}
          </Button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
