import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Artifact } from '~/common';
import {
  buildOilDataDisplayRows,
  parseCompositeContent,
  MIME_TO_SCHEMA,
  SCHEMA_LABELS,
} from './oilDataUtils';
import type { OilSingleSchema, OilSchema, CompositeData, CompositeGroup } from './oilDataUtils';

type OilRecord = Record<string, unknown>;

interface ParsedOilResult {
  records: OilRecord | OilRecord[];
  truncatedTotal?: number;
}

function isTruncationMarker(item: unknown): item is { _truncated: true; _total: number } {
  return (
    item !== null &&
    typeof item === 'object' &&
    (item as Record<string, unknown>)['_truncated'] === true &&
    typeof (item as Record<string, unknown>)['_total'] === 'number'
  );
}

function parseOilData(content: string | undefined): ParsedOilResult | null {
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
      let truncatedTotal: number | undefined;
      const records = (parsed as unknown[]).filter((item): item is OilRecord => {
        if (isTruncationMarker(item)) {
          truncatedTotal = item._total;
          return false;
        }
        return item !== null && typeof item === 'object' && !Array.isArray(item);
      });
      return records.length > 0 ? { records, truncatedTotal } : null;
    }
    return { records: parsed as OilRecord };
  } catch {
    return null;
  }
}

function RecordLabel(record: OilRecord): string {
  const jh = record['jh'] ?? record['well_name'];
  return typeof jh === 'string' && jh ? jh : '记录';
}

function RecordTable({ record, schema }: { record: OilRecord; schema: OilSingleSchema }) {
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

function PaginatedRecordList({
  records,
  schema,
}: {
  records: OilRecord[];
  schema: OilSingleSchema;
}) {
  const [index, setIndex] = useState(0);
  const total = records.length;
  const current = Math.min(index, total - 1);
  const record = records[current];

  if (total === 1) {
    return (
      <div className="p-4">
        <RecordTable record={record} schema={schema} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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
      <div className="p-4">
        <RecordTable record={record} schema={schema} />
      </div>
    </div>
  );
}

function CompositeViewer({ compositeData }: { compositeData: CompositeData }) {
  const schemas = useMemo(() => [...compositeData.keys()], [compositeData]);
  const [activeSchema, setActiveSchema] = useState<OilSingleSchema>(schemas[0]);
  const group: CompositeGroup = compositeData.get(activeSchema) ?? { records: [] };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-medium bg-surface-secondary px-3 py-1.5">
        {schemas.map((s) => {
          const count = compositeData.get(s)?.records.length ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSchema(s)}
              className={
                'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
                (s === activeSchema
                  ? 'bg-blue-600 text-white'
                  : 'text-text-secondary hover:bg-surface-hover')
              }
            >
              {SCHEMA_LABELS[s]}({count})
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <PaginatedRecordList key={activeSchema} records={group.records} schema={activeSchema} />
      </div>
      {group.truncatedTotal != null && (
        <TruncationNotice shown={group.records.length} total={group.truncatedTotal} />
      )}
    </div>
  );
}

function TruncationNotice({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="shrink-0 border-t border-border-medium bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
      文档共 {total} 条记录，当前显示前 {shown} 条。如需提取剩余数据，请在对话中输入"继续提取剩余记录"。
    </div>
  );
}

function SingleSchemaViewer({
  data,
  schema,
  truncatedTotal,
}: {
  data: OilRecord | OilRecord[];
  schema: OilSingleSchema;
  truncatedTotal?: number;
}) {
  const [index, setIndex] = useState(0);

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
        {truncatedTotal != null && <TruncationNotice shown={total} total={truncatedTotal} />}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <RecordTable record={data} schema={schema} />
    </div>
  );
}

export default function OilDataViewer({ artifact }: { artifact: Artifact }) {
  const schemaRaw: OilSchema = MIME_TO_SCHEMA[artifact.type ?? ''] ?? 'oil-data';

  const compositeData = useMemo(
    () => (schemaRaw === 'composite' && artifact.content ? parseCompositeContent(artifact.content) : null),
    [schemaRaw, artifact.content],
  );

  const singleResult = useMemo(
    () => (schemaRaw !== 'composite' ? parseOilData(artifact.content) : null),
    [schemaRaw, artifact.content],
  );

  if (schemaRaw === 'composite') {
    if (!compositeData) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
          无法解析复合数据，请检查 JSON 格式是否正确。
        </div>
      );
    }
    return <CompositeViewer compositeData={compositeData} />;
  }

  if (!singleResult) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-secondary">
        无法解析数据，请检查 JSON 格式是否正确。
      </div>
    );
  }

  return (
    <SingleSchemaViewer
      data={singleResult.records}
      schema={schemaRaw}
      truncatedTotal={singleResult.truncatedTotal}
    />
  );
}
