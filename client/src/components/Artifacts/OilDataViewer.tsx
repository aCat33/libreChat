import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Artifact } from '~/common';
import { buildOilDataDisplayRows, MIME_TO_SCHEMA } from './oilDataUtils';
import type { OilSchema } from './oilDataUtils';

type OilRecord = Record<string, unknown>;

const GAS_COMP_GROUP = '气样组分';

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

function recordLabel(record: OilRecord): string {
  const jh = record['jh'] ?? record['well_name'];
  return typeof jh === 'string' && jh ? jh : '记录';
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pb-1 pl-4 pr-4 pt-3">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-0.5 rounded-full bg-blue-400/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {label}
          </span>
        </div>
      </td>
    </tr>
  );
}

function RecordTable({ record, schema }: { record: OilRecord; schema: OilSchema }) {
  const rows = useMemo(() => buildOilDataDisplayRows(record, schema), [record, schema]);

  const renderedRows: React.ReactNode[] = [];
  let lastGroup = '';
  for (const row of rows) {
    if (row.groupLabel && row.groupLabel !== lastGroup) {
      lastGroup = row.groupLabel;
      renderedRows.push(<GroupHeader key={`group-${row.groupLabel}`} label={row.groupLabel} />);
    }
    const pct = row.groupLabel === GAS_COMP_GROUP ? parseFloat(row.valueText) : NaN;
    const showBar = !isNaN(pct) && pct >= 0;
    renderedRows.push(
      <tr
        key={row.id}
        className="border-b border-border-light/50 transition-colors hover:bg-surface-secondary/30"
      >
        <td className="w-[44%] py-2.5 pl-5 pr-2 align-middle">
          <span className="text-[15px] leading-snug text-text-primary">{row.fieldLabel}</span>
          <span className="mt-0.5 block font-mono text-[12px] text-text-tertiary/70">
            {row.fieldKey}
          </span>
        </td>
        <td className="py-2 pl-2 pr-4 align-middle">
          {showBar ? (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-[15px] font-medium tabular-nums text-text-primary">
                {row.valueText}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-blue-400/70"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[15px] font-medium text-text-primary">
              {row.valueText !== '' ? (
                row.valueText
              ) : (
                <span className="font-normal text-text-tertiary">—</span>
              )}
            </span>
          )}
        </td>
      </tr>,
    );
  }

  return (
    <table className="w-full border-collapse">
      <tbody>{renderedRows}</tbody>
      {rows.length === 0 && (
        <tfoot>
          <tr>
            <td colSpan={2} className="py-8 text-center text-sm text-text-secondary">
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
        <div className="flex shrink-0 items-center justify-between border-b border-border-medium bg-surface-secondary/60 px-3 py-2">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
            className="rounded p-1 hover:bg-surface-hover disabled:opacity-30"
            aria-label="上一条"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-center">
            <span className="text-sm font-semibold text-text-primary">{recordLabel(record)}</span>
            <span className="ml-2 text-xs text-text-tertiary">
              {current + 1} / {total}
            </span>
          </div>
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
