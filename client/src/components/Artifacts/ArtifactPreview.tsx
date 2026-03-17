import React, { memo, useMemo, useState, type MutableRefObject } from 'react';
import { SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react/unstyled';
import type {
  SandpackProviderProps,
  SandpackPreviewRef,
} from '@codesandbox/sandpack-react/unstyled';
import type { TStartupConfig } from 'librechat-data-provider';
import type { ArtifactFiles } from '~/common';
import ArtifactErrorBoundary from './ArtifactErrorBoundary';
import { sharedFiles, sharedOptions } from '~/utils/artifacts';

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
  artifactId,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: TStartupConfig;
  artifactId?: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    return {
      ...files,
      [fileKey]: { code },
    };
  }, [currentCode, files, fileKey]);

  const options: typeof sharedOptions = useMemo(() => {
    if (!startupConfig) {
      return sharedOptions;
    }
    return {
      ...sharedOptions,
      bundlerURL: template === 'static' ? startupConfig.staticBundlerURL : startupConfig.bundlerURL,
    };
  }, [startupConfig, template]);

  const handleRetry = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  return (
    <ArtifactErrorBoundary artifactId={artifactId} onRetry={handleRetry}>
      <SandpackProvider
        key={refreshKey}
        files={{ ...artifactFiles, ...sharedFiles }}
        options={options}
        {...sharedProps}
        template={template}
      >
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          tabIndex={0}
          ref={previewRef}
        />
      </SandpackProvider>
    </ArtifactErrorBoundary>
  );
});
