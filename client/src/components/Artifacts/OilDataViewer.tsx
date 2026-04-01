import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Artifact } from '~/common';
import { buildOilDataDisplayRows, MIME_TO_SCHEMA } from './oilDataUtils';
import type { OilSchema } from './oilDataUtils';

type OilRecord = Record<string, unknown>;

function parseOilData(content: string | undefined): OilRecord | OilRecord[] | null {
  if (!content) {
    return null;
  }
  try {
    const trimmed = content.trim();
    const jsonStr = trimmed.startsWith('```')
      ? trimmed.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
      : trimmed;
    const parsed = JSON.parse(jsonStr) as unknown;
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    if (Array.isArray(parsed)) {
      const records = (parsed as unknown[]).filter(
        (item): item is OilRecord => item !== null && typeof item === 'object' && !Array.isArray(item),
      );
      return records.length > 0 ? records : null;
    }
    return parsed as OilRecord;
  } catch {
    return null;
  }
}

function RecordLabel(record: OilRecord): string {
  const jh = record['jh'] ?? record['well_name'] ?? record['jh'];
  return typeof jh === 'string' && jh ? jh : '记录';
}

function RecordTable({ record, schema }: { record: OilRecord; schema: OilSchema }) {
  const rows = useMemo(() => buildOilDataDisplayRows(record, schema), [record, schema]);

  const renderedRows: React.ReactNode[] = [];
  let lastGroup = '';
  for (const row of rows) {
    if (row.groupLabel && row.groupLabel !== lastGroup) {
      lastGroup = row.groupLabel;
      renderedRows.push(
        <tr key={`group-${row.groupLabel}`} className="bg-surface-secondary/70">
          <td
            colSpan={3}
            className="px-3 py-1 text-xs font-semibold tracking-wide text-text-secondary"
          >
            {row.groupLabel}
          </td>
        </tr>,
      );
    }
    renderedRows.push(
      <tr key={row.id} className="border-b border-border-light hover:bg-surface-secondary/50">
        <td className="max-w-[200px] break-words px-3 py-2 text-text-primary">{row.fieldLabel}</td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-text-tertiary">
          {row.fieldKey}
        </td>
        <td className="max-w-md break-words px-3 py-2 text-text-primary">{row.valueText}</td>
      </tr>,
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border-medium bg-surface-secondary">
          <th className="px-3 py-2 text-left font-medium text-text-secondary">中文名</th>
          <th className="px-3 py-2 text-left font-medium text-text-secondary">字段名</th>
          <th className="px-3 py-2 text-left font-medium text-text-secondary">值</th>
        </tr>
      </thead>
      <tbody>{renderedRows}</tbody>
      {rows.length === 0 && (
        <tfoot>
          <tr>
            <td colSpan={3} className="py-8 text-center text-sm text-text-secondary">
              未提取到任何字段数据。
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export default function OilDataViewer({ artifact }: { artifact: Artifact }) {
  const schema: OilSchema = MIME_TO_SCHEMA[artifact.type ?? ''] ?? 'oil-data';
  const data = useMemo(() => parseOilData(artifact.content), [artifact.content]);
  const [index, setIndex] = useState(0);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
        无法解析数据，请检查 JSON 格式是否正确。
      </div>
    );
  }

  if (Array.isArray(data)) {
    const total = data.length;
    const current = Math.min(index, total - 1);
    const record = data[current];
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border-medium bg-surface-secondary px-4 py-2">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
            className="rounded p-1 hover:bg-surface-hover disabled:opacity-30"
            aria-label="上一条"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{RecordLabel(record)}</span>
            {'  '}
            {current + 1} / {total}
          </span>
          <button
            type="button"
            disabled={current === total - 1}
            onClick={() => setIndex(current + 1)}
            className="rounded p-1 hover:bg-surface-hover disabled:opacity-30"
            aria-label="下一条"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <RecordTable record={record} schema={schema} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <RecordTable record={data} schema={schema} />
    </div>
  );
}
