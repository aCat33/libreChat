import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useVectorizationStatus, VectorizationStatus } from '~/hooks/Files';

interface VectorizationStatusBadgeProps {
  fileId: string;
  filename?: string;
  compact?: boolean;
}

export default function VectorizationStatusBadge({
  fileId,
  filename,
  compact = false,
}: VectorizationStatusBadgeProps) {
  const { status, isVectorizing, isCompleted, isFailed } = useVectorizationStatus(fileId, true);

  if (!status)  {
    return null;
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case VectorizationStatus.PENDING:
        return <Clock className="h-3 w-3" />;
      case VectorizationStatus.PROCESSING:
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case VectorizationStatus.COMPLETED:
        return <CheckCircle2 className="h-3 w-3" />;
      case VectorizationStatus.FAILED:
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case VectorizationStatus.PENDING:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-800';
      case VectorizationStatus.PROCESSING:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case VectorizationStatus.COMPLETED:
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case VectorizationStatus.FAILED:
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case VectorizationStatus.PENDING:
        return 'Queued';
      case VectorizationStatus.PROCESSING:
        return 'Indexing...';
      case VectorizationStatus.COMPLETED:
        return 'Ready';
      case VectorizationStatus.FAILED:
        return 'Failed';
      default:
        return '';
    }
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor()}`}
        title={`${filename || 'Document'} - ${getStatusText()}`}
      >
        {getStatusIcon()}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${getStatusColor()}`}
    >
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {isVectorizing && status.progress !== undefined && (
        <span className="text-xs opacity-75">
          {status.progress}%
        </span>
      )}
      {isFailed && status.error && (
        <span className="text-xs opacity-75" title={status.error}>
          ({status.error.substring(0, 20)}...)
        </span>
      )}
    </div>
  );
}
