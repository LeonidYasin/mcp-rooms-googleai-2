import { saveRoomEventInDb } from './db';

export interface RoomEvent {
  id: string;
  type: 'init' | 'message' | 'step' | 'turn' | 'agreement' | 'status' | 'typing';
  roomId: string;
  data: any;
  timestamp: number;
}

type Listener = (event: RoomEvent) => void;

class RoomEventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(roomId: string, listener: Listener): () => void {
    if (!this.listeners.has(roomId)) {
      this.listeners.set(roomId, new Set());
    }
    this.listeners.get(roomId)!.add(listener);

    return () => {
      const subs = this.listeners.get(roomId);
      if (subs) {
        subs.delete(listener);
        if (subs.size === 0) {
          this.listeners.delete(roomId);
        }
      }
    };
  }

  broadcast(roomId: string, type: RoomEvent['type'], data: any, eventId?: string): RoomEvent {
    const event: RoomEvent = {
      id: eventId || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      roomId,
      data,
      timestamp: Date.now(),
    };

    // Persist event in SQLite for replay on reconnection
    try {
      saveRoomEventInDb({
        id: event.id,
        roomId,
        eventType: type,
        payload: data,
        createdAt: event.timestamp,
      });
    } catch {
      // Non-blocking fallback if persistence fails
    }

    const subs = this.listeners.get(roomId);
    if (subs) {
      subs.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          // Ignore failing listeners
        }
      });
    }

    return event;
  }

  getSubscriberCount(roomId: string): number {
    return this.listeners.get(roomId)?.size || 0;
  }
}

export const roomEventBus = new RoomEventBus();
