import type { TFile } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { getFileType, cn } from '~/utils';
import { useVectorizationStatus } from '~/hooks/Files';
import VectorizationStatusBadge from '~/components/Files/VectorizationStatusBadge';
import FilePreview from './FilePreview';
import RemoveFile from './RemoveFile';

const FileContainer = ({
  file,
  overrideType,
  buttonClassName,
  containerClassName,
  onDelete,
  onClick,
}: {
  file: Partial<ExtendedFile | TFile>;
  overrideType?: string;
  buttonClassName?: string;
  containerClassName?: string;
  onDelete?: () => void;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  const fileType = getFileType(overrideType ?? file.type);
  const fileId = 'file_id' in file ? file.file_id : undefined;
  
  // Monitor vectorization status for this file
  const { isVectorizing, isCompleted, isFailed } = useVectorizationStatus(
    fileId ?? null, 
    !!fileId,
  );

  return (
    <div
      className={cn('group relative inline-block text-sm text-text-primary', containerClassName)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={file.filename}
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-border-light bg-surface-hover-alt',
          isVectorizing && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/50',
          isCompleted && 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg shadow-green-500/50',
          isFailed && 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-lg shadow-red-500/50',
          buttonClassName,
        )}
      >
        <div className="w-56 p-1.5">
          <div className="flex flex-row items-center gap-2">
            <FilePreview file={file} fileType={fileType} className="relative" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-medium" title={file.filename}>
                {file.filename}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="truncate text-text-secondary" title={fileType.title}>
                  {fileType.title}
                </div>
                {/* Show vectorization status badge */}
                {fileId && (
                  <VectorizationStatusBadge 
                    fileId={fileId} 
                    filename={file.filename}
                    compact 
                  />
                )}
              </div>
            </div>
          </div>
          {/* Show status message for large documents */}
          {isVectorizing && (
            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              ⏳ Indexing document for intelligent search...
            </div>
          )}
          {isCompleted && (
            <div className="mt-1 text-xs text-green-600 dark:text-green-400">
              ✅ Ready for vector search
            </div>
          )}
          {isFailed && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">
              ⚠️ Indexing failed, using full-text search
            </div>
          )}
        </div>
      </button>
      {onDelete && <RemoveFile onRemove={onDelete} />}
    </div>
  );
};

export default FileContainer;
