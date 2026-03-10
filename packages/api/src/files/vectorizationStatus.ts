/**
 * Vectorization Status Manager
 * Tracks the vectorization progress of files using in-memory storage
 * Sends SSE events to connected clients
 */

import { logger } from '@librechat/data-schemas';
import type { Response as ServerResponse } from 'express';

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
  progress?: number; // 0-100
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Manager for tracking vectorization status
 */
class VectorizationStatusManager {
  private states: Map<string, VectorizationState> = new Map();
  private listeners: Map<string, Set<ServerResponse>> = new Map();

  /**
   * Update vectorization status and notify listeners
   */
  updateStatus(fileId: string, update: Partial<VectorizationState>): void {
    console.log(`[VectorizationStatusManager] 🔄 updateStatus called for ${fileId}:`, update);
    
    const current = this.states.get(fileId) || {
      file_id: fileId,
      filename: update.filename || 'Unknown',
      status: VectorizationStatus.PENDING,
      startTime: Date.now(),
    };

    const newState: VectorizationState = {
      ...current,
      ...update,
    };

    if (update.status === VectorizationStatus.COMPLETED || update.status === VectorizationStatus.FAILED) {
      newState.endTime = Date.now();
    }

    this.states.set(fileId, newState);
    console.log(`[VectorizationStatusManager] ✅ Updated state for ${fileId}:`, newState);
    console.log(`[VectorizationStatusManager] Number of listeners for ${fileId}:`, this.listeners.get(fileId)?.size || 0);
    logger.debug(`[VectorizationStatusManager] Updated status for ${fileId}: ${newState.status}`);

    // Notify all listeners for this file
    this.notifyListeners(fileId, newState);

    // Clean up old states after 5 minutes
    if (newState.endTime) {
      setTimeout(() => {
        this.states.delete(fileId);
        logger.debug(`[VectorizationStatusManager] Cleaned up state for ${fileId}`);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Get current status of a file
   */
  getStatus(fileId: string): VectorizationState | undefined {
    return this.states.get(fileId);
  }

  /**
   * Register SSE listener for a file
   */
  addListener(fileId: string, res: ServerResponse): void {
    if (!this.listeners.has(fileId)) {
      this.listeners.set(fileId, new Set());
    }
    this.listeners.get(fileId)!.add(res);
    logger.debug(`[VectorizationStatusManager] Added listener for ${fileId}`);

    // Send current state immediately if available
    const state = this.states.get(fileId);
    if (state) {
      this.sendEvent(res, state);
    }

    // Clean up on connection close
    res.on('close', () => {
      this.removeListener(fileId, res);
    });
  }

  /**
   * Remove SSE listener
   */
  removeListener(fileId: string, res: ServerResponse): void {
    const listeners = this.listeners.get(fileId);
    if (listeners) {
      listeners.delete(res);
      if (listeners.size === 0) {
        this.listeners.delete(fileId);
      }
    }
    logger.debug(`[VectorizationStatusManager] Removed listener for ${fileId}`);
  }

  /**
   * Notify all listeners for a file
   */
  private notifyListeners(fileId: string, state: VectorizationState): void {
    const listeners = this.listeners.get(fileId);
    console.log(`[VectorizationStatusManager] 📡 notifyListeners for ${fileId}, listeners count: ${listeners?.size || 0}`);
    
    if (!listeners || listeners.size === 0) {
      console.log(`[VectorizationStatusManager] ⚠️ No listeners for ${fileId}, skipping notification`);
      return;
    }

    logger.debug(`[VectorizationStatusManager] Notifying ${listeners.size} listener(s) for ${fileId}`);

    for (const res of listeners) {
      try {
        console.log(`[VectorizationStatusManager] ✉️ Sending event to listener for ${fileId}`);
        this.sendEvent(res, state);
      } catch (error) {
        logger.error(`[VectorizationStatusManager] Failed to send event:`, error);
        this.removeListener(fileId, res);
      }
    }
  }

  /**
   * Send SSE event to a response
   */
  private sendEvent(res: ServerResponse, state: VectorizationState): void {
    if (res.writableEnded) {
      console.log('[VectorizationStatusManager] ⚠️ Response already ended, cannot send event');
      return;
    }

    const payload = JSON.stringify({
      event: 'vectorization_status',
      data: state,
    });

    console.log('[VectorizationStatusManager] 📤 Sending SSE message:', payload.substring(0, 100) + '...');
    
    // Standard SSE format: data: {...}\n\n
    const message = `data: ${payload}\n\n`;
    console.log('[VectorizationStatusManager] 📤 Raw SSE message length:', message.length);
    
    try {
      res.write(message);
      console.log('[VectorizationStatusManager] ✅ Message sent successfully');
    } catch (error) {
      console.error('[VectorizationStatusManager] ❌ Failed to write message:', error);
    }
  }

  /**
   * Get all active vectorization tasks
   */
  getAllActive(): VectorizationState[] {
    return Array.from(this.states.values()).filter(
      (state) => state.status === VectorizationStatus.PENDING || state.status === VectorizationStatus.PROCESSING,
    );
  }
}

// Singleton instance
export const vectorizationStatusManager = new VectorizationStatusManager();
