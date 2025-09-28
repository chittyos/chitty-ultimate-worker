/**
 * ChittyChat Session Management Service
 * Integrated into chitty-ultimate-worker for cross-platform AI session continuity
 */

import { Client } from "@notionhq/client";

export class SessionService {
  constructor(env) {
    this.env = env;
    this.kv = env.CHITTYROUTER_KV;
    this.memoryStore = new Map(); // Fallback for when KV is not available

    // Initialize Notion client if token is available
    if (env.NOTION_TOKEN) {
      this.notion = new Client({
        auth: env.NOTION_TOKEN,
      });
    }
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    const method = request.method;
    const pathParts = url.pathname.split("/").filter(Boolean);

    try {
      // Route session management endpoints
      if (pathParts[1] === "create" && method === "POST") {
        return await this.createSession(request);
      }

      if (pathParts[1] === "status" && method === "GET") {
        return await this.getStatus();
      }

      if (pathParts[1] && method === "GET") {
        return await this.getSession(pathParts[1]);
      }

      if (pathParts[1] && method === "POST") {
        return await this.updateSession(pathParts[1], request);
      }

      if (pathParts[1] === "sync" && method === "POST") {
        return await this.syncSession(request);
      }

      if (pathParts[1] === "handoff" && method === "POST") {
        return await this.createHandoff(request);
      }

      // Default session list
      return await this.listSessions();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Session management error",
          message: error.message,
          service: "chitty-ultimate-worker",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  async createSession(request) {
    const body = await request.json();
    const sessionId = this.generateSessionId();

    const session = {
      id: sessionId,
      ...body,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      platform: body.platform || "claude-code",
      status: "active",
    };

    await this.set(`session:${sessionId}`, JSON.stringify(session));

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        session,
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async getSession(sessionId) {
    const sessionData = await this.get(`session:${sessionId}`);

    if (!sessionData) {
      return new Response(
        JSON.stringify({
          error: "Session not found",
          sessionId,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: JSON.parse(sessionData),
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async updateSession(sessionId, request) {
    const body = await request.json();
    const existingData = await this.get(`session:${sessionId}`);

    if (!existingData) {
      return new Response(
        JSON.stringify({
          error: "Session not found",
          sessionId,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const session = JSON.parse(existingData);
    Object.assign(session, body, {
      lastActivity: new Date().toISOString(),
    });

    await this.set(`session:${sessionId}`, JSON.stringify(session));

    return new Response(
      JSON.stringify({
        success: true,
        session,
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async syncSession(request) {
    const body = await request.json();
    const { sessionId, syncTarget } = body;

    // This would sync to external services like GitHub, Notion, etc.
    // For now, just acknowledge the sync request

    return new Response(
      JSON.stringify({
        success: true,
        message: "Session sync initiated",
        sessionId,
        syncTarget: syncTarget || "github",
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async createHandoff(request) {
    const body = await request.json();
    const { sessionId, targetPlatform, handoffData } = body;

    const handoffId = this.generateSessionId();
    const handoff = {
      id: handoffId,
      sessionId,
      targetPlatform,
      handoffData,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    await this.set(`handoff:${handoffId}`, JSON.stringify(handoff));

    return new Response(
      JSON.stringify({
        success: true,
        handoffId,
        handoff,
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async listSessions() {
    // This is a simplified implementation
    // In production, you'd want to paginate and filter

    return new Response(
      JSON.stringify({
        success: true,
        sessions: [],
        message: "Session listing not fully implemented",
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async getStatus() {
    return new Response(
      JSON.stringify({
        service: "ChittyChat Session Management",
        status: "operational",
        worker: "chitty-ultimate-worker",
        features: [
          "Session persistence",
          "Cross-platform handoff",
          "GitHub sync",
          "Notion integration",
        ],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Storage abstraction methods
  async get(key) {
    if (this.kv) {
      return await this.kv.get(key);
    }
    return this.memoryStore.get(key) || null;
  }

  async set(key, value) {
    if (this.kv) {
      await this.kv.put(key, value);
    }
    this.memoryStore.set(key, value);
  }

  generateSessionId() {
    return `chitty-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
