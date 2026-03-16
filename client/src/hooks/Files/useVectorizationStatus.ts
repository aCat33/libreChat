import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';

export enum VectorizationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface VectorizationState {
  file_id: string;
  filename: string;
  status: VectorizationStatus;
  progress?: number;
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Hook to monitor vectorization status via SSE
 * @param fileId - The file ID to monitor
 * @param enabled - Whether to enable monitoring
 */
export function useVectorizationStatus(fileId: string | null, enabled = true) {
  const { token } = useAuthContext();
  const [status, setStatus] = useState<VectorizationState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to avoid recreating EventSource on every render
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[useVectorizationStatus] 🔄 useEffect triggered for fileId:', fileId, 'enabled:', enabled, 'hasToken:', !!token);
    
    // 🔍 更严格的 token 验证，排除空字符串
    if (!fileId || !enabled || !token || token.trim() === '') {
      console.log('[useVectorizationStatus] Skipped:', { 
        fileId, 
        enabled, 
        hasToken: !!token, 
        tokenLength: token?.length,
        tokenType: typeof token,
        tokenEmpty: token === '' 
      });
      return;
    }

    console.log('[useVectorizationStatus] ✅ Connecting SSE for:', fileId);
    console.log('[useVectorizationStatus] Token info:', {
      length: token.length,
      preview: token.substring(0, 30) + '...',
      isJWT: token.startsWith('eyJ')
    });

    const connect = () => {
      // Clean up existing connection if any
      if (eventSourceRef.current) {
        console.log('[useVectorizationStatus] Closing existing EventSource before reconnecting');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      try {
        const url = `/api/files/vectorization/status/${fileId}?token=${encodeURIComponent(token)}`;
        console.log('[useVectorizationStatus] Creating EventSource:', url.replace(token, 'TOKEN_HIDDEN'));
        
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => {
          console.log('[useVectorizationStatus] ✅ SSE Connected successfully!');
          console.log('[useVectorizationStatus] FileId:', fileId);
          console.log('[useVectorizationStatus] ReadyState:', es.readyState, '(1=OPEN)');
          console.log('[useVectorizationStatus] URL:', es.url.replace(/token=[^&]+/, 'token=HIDDEN'));
          console.log('[useVectorizationStatus] ⏰ Waiting for messages...');
          setIsConnected(true);
          setError(null);
        };

        es.onmessage = (event) => {
          console.log('[useVectorizationStatus] 📨 ============ MESSAGE RECEIVED ============');
          console.log('[useVectorizationStatus] FileId:', fileId);
          console.log('[useVectorizationStatus] Event.type:', event.type);
          console.log('[useVectorizationStatus] Event.data (raw):', event.data);
          console.log('[useVectorizationStatus] Event.lastEventId:', event.lastEventId);
          console.log('[useVectorizationStatus] ReadyState:', es.readyState);
          
          // 忽略连接确认和心跳消息
          if (event.data === ': connected' || event.data === ': heartbeat') {
            console.log('[useVectorizationStatus] ⏭️  Heartbeat message, skipping');
            return;
          }
          
          // 忽略空消息
          if (!event.data || event.data.trim() === '') {
            console.log('[useVectorizationStatus] ⚠️ Empty message, skipping');
            return;
          }

          try {
            const data = JSON.parse(event.data);
            console.log('[useVectorizationStatus] 📋 Parsed data:', JSON.stringify(data, null, 2));
            
            if (data.event === 'vectorization_status' && data.data) {
              console.log('[useVectorizationStatus] ✅ STATUS UPDATE:', {
                fileId: data.data.file_id,
                status: data.data.status,
                progress: data.data.progress,
                filename: data.data.filename
              });
              setStatus(data.data);

              // Auto-disconnect after completion or failure
              if (
                data.data.status === VectorizationStatus.COMPLETED ||
                data.data.status === VectorizationStatus.FAILED
              ) {
                setTimeout(() => {
                  if (eventSourceRef.current) {
                    console.log('[useVectorizationStatus] Auto-closing after completion');
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                  }
                }, 2000);
              }
            }
          } catch (err) {
            console.error('[useVectorizationStatus] Failed to parse SSE data:', err, event.data);
          }
        };

        es.onerror = (err) => {
          console.error('[useVectorizationStatus] ❌ ============ ERROR ============');
          console.error('[useVectorizationStatus] FileId:', fileId);
          console.error('[useVectorizationStatus] Error object:', err);
          console.error('[useVectorizationStatus] ReadyState:', es.readyState, {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSED'
          }[es.readyState]);
          console.error('[useVectorizationStatus] URL:', es.url.replace(/token=[^&]+/, 'token=HIDDEN'));
          
          setError('Connection error');
          setIsConnected(false);
          
          // EventSource 已关闭，可能是 401 或其他致命错误
          if (es.readyState === EventSource.CLOSED) {
            console.log('[useVectorizationStatus] 🚫 Connection CLOSED (auth error or server rejected)');
            console.log('[useVectorizationStatus] 💡 Hint: Check backend logs for auth errors');
            console.log('[useVectorizationStatus] ❌ Not attempting reconnect');
            es.close();
            eventSourceRef.current = null;
            return;
          }
          
          // 对于其他错误，尝试重连
          if (es.readyState === EventSource.CONNECTING) {
            console.log('[useVectorizationStatus] ⏳ Still CONNECTING, waiting...');
            // 不关闭，让它继续尝试
            return;
          }
          
          es.close();
          eventSourceRef.current = null;
          
          // Reconnect after 5 seconds for network errors
          console.log('[useVectorizationStatus] 🔄 Will attempt reconnect in 5 seconds...');
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('[useVectorizationStatus] ❌ Failed to create EventSource:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    connect();

    return () => {
      console.log('[useVectorizationStatus] 🧹 Cleanup triggered for:', fileId);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        console.log('[useVectorizationStatus] Closing EventSource, readyState:', eventSourceRef.current.readyState);
        eventSourceRef.current.close();
        console.log('[useVectorizationStatus] EventSource closed for:', fileId);
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [fileId, enabled, token]);

  const refresh = useCallback(async () => {
    if (!fileId) {
      return;
    }

    try {
      const response = await fetch(`/api/files/vectorization/status-query/${fileId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('[useVectorizationStatus] Failed to fetch status:', err);
    }
  }, [fileId]);

  return {
    status,
    isConnected,
    error,
    refresh,
    isVectorizing: status?.status === VectorizationStatus.PROCESSING || status?.status === VectorizationStatus.PENDING,
    isCompleted: status?.status === VectorizationStatus.COMPLETED,
    isFailed: status?.status === VectorizationStatus.FAILED,
  };
}

/**
 * Hook to monitor multiple files' vectorization status
 */
export function useMultipleVectorizationStatus(fileIds: string[], enabled = true) {
  const { token } = useAuthContext();
  const [statuses, setStatuses] = useState<Record<string, VectorizationState>>({});

  useEffect(() => {
    if (!enabled || fileIds.length === 0 || !token || token.trim() === '') {
      return;
    }

    const sources: Record<string, EventSource> = {};

    fileIds.forEach((fileId) => {
      const url = `/api/files/vectorization/status/${fileId}?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        if (event.data === ': connected' || event.data === ': heartbeat') {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          if (data.event === 'vectorization_status' && data.data) {
            setStatuses((prev) => ({
              ...prev,
              [fileId]: data.data,
            }));
          }
        } catch (err) {
          console.error(`[useMultipleVectorizationStatus] Failed to parse data for ${fileId}:`, err);
        }
      };

      eventSource.onerror = (err) => {
        console.error(`[useMultipleVectorizationStatus] SSE error for ${fileId}:`, err);
      };

      sources[fileId] = eventSource;
    });

    return () => {
      Object.values(sources).forEach((source) => source.close());
    };
  }, [fileIds.join(','), enabled, token]);

  return {
    statuses,
    getStatus: (fileId: string) => statuses[fileId],
    isAnyVectorizing: Object.values(statuses).some(
      (s) => s.status === VectorizationStatus.PROCESSING || s.status === VectorizationStatus.PENDING,
    ),
  };
}
