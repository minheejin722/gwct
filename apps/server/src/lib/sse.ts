import type { ServerResponse } from "node:http";

export interface SseClient {
  id: string;
  response: ServerResponse;
}

export class SseHub {
  private readonly clients = new Map<string, SseClient>();

  add(client: SseClient): void {
    this.clients.set(client.id, client);
  }

  remove(clientId: string): void {
    this.clients.delete(clientId);
  }

  count(): number {
    return this.clients.size;
  }

  broadcast(eventName: string, payload: unknown): void {
    const eventBlock = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients) {
      try {
        client.response.write(eventBlock);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}
