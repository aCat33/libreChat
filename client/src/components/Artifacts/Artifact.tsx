import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import throttle from 'lodash/throttle';
import { visit } from 'unist-util-visit';
import { useSetRecoilState } from 'recoil';
import { useLocation } from 'react-router-dom';
import type { Pluggable } from 'unified';
import type { Artifact } from '~/common';
import { useMessageContext, useArtifactContext } from '~/Providers';
import { logger, extractContent, isArtifactRoute } from '~/utils';
import { artifactsState } from '~/store/artifacts';
import ArtifactButton from './ArtifactButton';

export const artifactPlugin: Pluggable = () => {
  return (tree) => {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], (node, index, parent) => {
      if (node.type === 'textDirective') {
        const replacementText = `:${node.name}`;
        if (parent && Array.isArray(parent.children) && typeof index === 'number') {
          parent.children[index] = {
            type: 'text',
            value: replacementText,
          };
        }
      }
      if (node.name !== 'artifact') {
        return;
      }
      node.data = {
        hName: node.name,
        hProperties: node.attributes,
        ...node.data,
      };
      return node;
    });
  };
};

const defaultTitle = 'untitled';
const defaultType = 'unknown';
const defaultIdentifier = 'lc-no-identifier';

type SplitArtifactPart = {
  identifier: string;
  title: string;
  content: string;
};

const RECHARTS_CHART_TAGS = [
  'BarChart',
  'LineChart',
  'PieChart',
  'AreaChart',
  'ScatterChart',
  'ComposedChart',
] as const;

function countRechartsCharts(code: string): number {
  const matches = code.match(
    new RegExp(`<\\s*(?:${RECHARTS_CHART_TAGS.join('|')})\\b`, 'g'),
  );
  return matches?.length ?? 0;
}

function splitRechartsTabsArtifact(params: {
  code: string;
  identifier: string;
  title: string;
}): SplitArtifactPart[] | null {
  const { code, identifier, title } = params;

  const tabsContentRegex =
    /<TabsContent\b[^>]*\bvalue=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/TabsContent>/g;

  const contents: Array<{ value: string; inner: string }> = [];
  for (const match of code.matchAll(tabsContentRegex)) {
    const value = match[2];
    const inner = match[3] ?? '';
    if (!value) {
      continue;
    }
    const hasChart = RECHARTS_CHART_TAGS.some((tag) => new RegExp(`<\\s*${tag}\\b`).test(inner));
    if (!hasChart) {
      continue;
    }
    contents.push({ value, inner });
  }

  if (contents.length <= 1) {
    return null;
  }

  const tabsTriggerRegex =
    /<TabsTrigger\b[^>]*\bvalue=(["'])([^"']+)\1[^>]*>[\s\S]*?<\/TabsTrigger>/g;

  const allTriggers = Array.from(code.matchAll(tabsTriggerRegex)).map((m) => ({
    value: m[2],
    raw: m[0],
  }));

  const parts: SplitArtifactPart[] = contents.map((c, idx) => {
    const keepValues = new Set([c.value]);

    const nextCode = (() => {
      let out = code;

      // Remove other <TabsContent ...> blocks
      out = out.replace(tabsContentRegex, (_m, _q, v, inner) => {
        if (!keepValues.has(String(v))) {
          return '';
        }
        return `<TabsContent value="${String(v)}">${String(inner)}</TabsContent>`;
      });

      // If triggers exist, remove non-matching triggers to keep UI consistent
      if (allTriggers.length > 0) {
        out = out.replace(tabsTriggerRegex, (raw, _q, v) => {
          return keepValues.has(String(v)) ? raw : '';
        });
      }

      return out;
    })();

    return {
      identifier: `${identifier}-part-${idx + 1}`,
      title: `${title}（${c.value}）`,
      content: nextCode,
    };
  });

  return parts;
}

function splitReactArtifactIfNeeded(params: {
  type: string;
  code: string;
  identifier: string;
  title: string;
}): SplitArtifactPart[] {
  const { type, code, identifier, title } = params;
  if (type !== 'application/vnd.react') {
    return [{ identifier, title, content: code }];
  }

  if (countRechartsCharts(code) <= 1) {
    return [{ identifier, title, content: code }];
  }

  return (
    splitRechartsTabsArtifact({ code, identifier, title }) ?? [{ identifier, title, content: code }]
  );
}

export function Artifact({
  node: _node,
  ...props
}: Artifact & {
  children: React.ReactNode | { props: { children: React.ReactNode } };
  node: unknown;
}) {
  const location = useLocation();
  const { messageId } = useMessageContext();
  const { getNextIndex, resetCounter } = useArtifactContext();

  const setArtifacts = useSetRecoilState(artifactsState);
  const [artifactsForNode, setArtifactsForNode] = useState<Artifact[] | null>(null);
  const indicesRef = useRef<number[]>([]);

  const throttledUpdateRef = useRef(
    throttle((updateFn: () => void) => {
      updateFn();
    }, 100),
  );

  const updateArtifact = useCallback(() => {
    const content = extractContent(props.children);
    logger.log('artifacts', 'updateArtifact: content.length', content.length);

    const title = props.title ?? defaultTitle;
    const type = props.type ?? defaultType;
    const identifier = props.identifier ?? defaultIdentifier;

    throttledUpdateRef.current(() => {
      const now = Date.now();
      const splitParts = splitReactArtifactIfNeeded({ type, code: content, identifier, title });

      while (indicesRef.current.length < splitParts.length) {
        indicesRef.current.push(getNextIndex(false));
      }

      const nextArtifacts: Artifact[] = splitParts
        .map((part, idx) => {
          const partKey = `${part.identifier}_${type}_${part.title}_${messageId}`
            .replace(/\s+/g, '_')
            .toLowerCase();

          if (partKey === `${defaultIdentifier}_${defaultType}_${defaultTitle}_${messageId}`) {
            return null;
          }

          return {
            id: partKey,
            identifier: part.identifier,
            title: part.title,
            type,
            content: part.content,
            messageId,
            index: indicesRef.current[idx] ?? 0,
            lastUpdateTime: now,
          } satisfies Artifact;
        })
        .filter((a): a is Artifact => a != null);

      if (nextArtifacts.length === 0) {
        return;
      }

      if (!isArtifactRoute(location.pathname)) {
        setArtifactsForNode(nextArtifacts);
        return;
      }

      setArtifacts((prevArtifacts) => {
        const prev = prevArtifacts ?? {};
        const nextMap = { ...prev };

        for (const art of nextArtifacts) {
          if (prev[art.id]?.content === art.content) {
            continue;
          }
          nextMap[art.id] = art;
        }

        return nextMap;
      });

      setArtifactsForNode(nextArtifacts);
    });
  }, [
    props.type,
    props.title,
    setArtifacts,
    props.children,
    props.identifier,
    messageId,
    location.pathname,
    getNextIndex,
  ]);

  useEffect(() => {
    resetCounter();
    updateArtifact();
  }, [updateArtifact, resetCounter]);

  const renderedArtifacts = useMemo(() => artifactsForNode ?? [], [artifactsForNode]);

  if (renderedArtifacts.length === 0) {
    return null;
  }

  return (
    <>
      {renderedArtifacts.map((a) => (
        <ArtifactButton key={a.id} artifact={a} />
      ))}
    </>
  );
}
