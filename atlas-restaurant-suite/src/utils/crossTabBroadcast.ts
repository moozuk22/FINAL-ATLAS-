/**
 * Cross-tab/cross-window broadcast utility
 * Uses BroadcastChannel when available, falls back to localStorage events for compatibility
 */

export interface BroadcastMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  messageId?: string; // For localStorage deduplication
}

type MessageHandler = (message: BroadcastMessage) => void;

class CrossTabBroadcast {
  private channel: BroadcastChannel | null = null;
  private localStorageKey = 'atlas-restaurant-broadcast';
  private messageId = 0;
  private handlers: Set<MessageHandler> = new Set();
  private localStorageListener: ((e: StorageEvent) => void) | null = null;
  private isUsingLocalStorage = false;
  private processedMessageIds: Set<string> = new Set();
  private maxProcessedIds = 100; // Limit memory usage

  constructor(channelName: string = 'atlas-restaurant-updates') {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        console.log('📡 Using BroadcastChannel for cross-tab communication');
      } catch (error) {
        console.warn('⚠️ BroadcastChannel failed, falling back to localStorage:', error);
        this.setupLocalStorageFallback();
      }
    } else {
      console.log('📡 BroadcastChannel not supported, using localStorage fallback');
      this.setupLocalStorageFallback();
    }
  }

  private setupLocalStorageFallback() {
    this.isUsingLocalStorage = true;
    
    // Listen for storage events from other tabs
    this.localStorageListener = (e: StorageEvent) => {
      // Only process our messages
      if (e.key !== this.localStorageKey || !e.newValue) return;
      
      try {
        const message: BroadcastMessage = JSON.parse(e.newValue);
        
        // Deduplicate: ignore messages we've already processed
        if (message.messageId && this.processedMessageIds.has(message.messageId)) {
          return;
        }
        
        // Mark as processed
        if (message.messageId) {
          this.processedMessageIds.add(message.messageId);
          
          // Limit memory usage by removing old IDs
          if (this.processedMessageIds.size > this.maxProcessedIds) {
            const firstId = this.processedMessageIds.values().next().value;
            this.processedMessageIds.delete(firstId);
          }
        }
        
        // Small delay to ensure message is fully written
        setTimeout(() => {
          this.handleMessage(message);
        }, 0);
      } catch (error) {
        console.error('Error parsing localStorage broadcast message:', error);
      }
    };
    
    window.addEventListener('storage', this.localStorageListener);
    console.log('📡 Using localStorage events for cross-tab communication');
  }

  private handleMessage(message: BroadcastMessage) {
    // Call all registered handlers
    this.handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in broadcast message handler:', error);
      }
    });
  }

  /**
   * Subscribe to broadcast messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Broadcast a message to all tabs/windows
   */
  postMessage(type: string, payload: unknown): void {
    const message: BroadcastMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId: `msg_${Date.now()}_${++this.messageId}_${Math.random().toString(36).substr(2, 9)}`,
    };

    if (this.channel) {
      // Use BroadcastChannel (fastest, most efficient)
      this.channel.postMessage(message);
      console.log(`📡 BroadcastChannel sent: ${type}`);
    } else if (this.isUsingLocalStorage) {
      // Use localStorage fallback
      try {
        const currentMessageId = message.messageId!;
        
        // Mark as processed for current tab (to avoid duplicate processing)
        this.processedMessageIds.add(currentMessageId);
        if (this.processedMessageIds.size > this.maxProcessedIds) {
          const firstId = this.processedMessageIds.values().next().value;
          this.processedMessageIds.delete(firstId);
        }
        
        // Set the message in localStorage (triggers storage event in OTHER tabs)
        localStorage.setItem(this.localStorageKey, JSON.stringify(message));
        
        // Also trigger handler in current tab (storage events don't fire in current tab)
        // Use a small delay to ensure localStorage is set first
        setTimeout(() => {
          this.handleMessage(message);
        }, 0);
        
        // Remove after a short delay to clean up and allow next message
        setTimeout(() => {
          // Only remove if it's still our message (avoid race conditions)
          try {
            const stored = localStorage.getItem(this.localStorageKey);
            if (stored) {
              const storedMsg = JSON.parse(stored);
              if (storedMsg.messageId === currentMessageId) {
                localStorage.removeItem(this.localStorageKey);
              }
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
        }, 100);
        
        console.log(`📡 localStorage broadcast sent: ${type}`);
      } catch (error) {
        // localStorage might be disabled or full
        console.error('Error broadcasting via localStorage:', error);
      }
    }
  }

  /**
   * Close the broadcast channel
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    
    if (this.localStorageListener) {
      window.removeEventListener('storage', this.localStorageListener);
      this.localStorageListener = null;
    }
    
    this.handlers.clear();
    console.log('📡 Cross-tab broadcast closed');
  }

  /**
   * Check if BroadcastChannel is being used
   */
  isUsingBroadcastChannel(): boolean {
    return this.channel !== null;
  }
}

// Create singleton instance
let broadcastInstance: CrossTabBroadcast | null = null;

export function getCrossTabBroadcast(): CrossTabBroadcast {
  if (!broadcastInstance) {
    broadcastInstance = new CrossTabBroadcast('atlas-restaurant-updates');
  }
  return broadcastInstance;
}

// Export type for use in other files
export type { CrossTabBroadcast };

export function closeCrossTabBroadcast(): void {
  if (broadcastInstance) {
    broadcastInstance.close();
    broadcastInstance = null;
  }
}
