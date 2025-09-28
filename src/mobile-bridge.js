/**
 * Mobile Bridge Service for ChittyChat
 * Optimized for mobile AI platforms and cross-platform handoff
 */

export class MobileBridgeService {
  constructor(env) {
    this.env = env;
    this.kv = env.CHITTYROUTER_KV;
    this.memoryStore = new Map();
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    const method = request.method;
    const pathParts = url.pathname.split("/").filter(Boolean);

    try {
      // Mobile-optimized routes
      if (pathParts[1] === "quick-start" && method === "POST") {
        return await this.quickStart(request);
      }

      if (pathParts[1] === "handoff" && method === "POST") {
        return await this.createMobileHandoff(request);
      }

      if (pathParts[1] === "continue" && pathParts[2] && method === "GET") {
        return await this.continueMobileSession(pathParts[2]);
      }

      if (pathParts[1] === "status" && method === "GET") {
        return await this.getMobileStatus();
      }

      // Default mobile info
      return await this.getMobileInfo();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Mobile bridge error",
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

  async quickStart(request) {
    const body = await request.json();
    const { platform, sessionHint } = body;

    // Try to find the most recent session or handoff
    let contextData = null;

    if (sessionHint) {
      // Check for existing session or handoff
      const sessionData =
        (await this.get(`session:${sessionHint}`)) ||
        (await this.get(`handoff:${sessionHint}`));

      if (sessionData) {
        contextData = JSON.parse(sessionData);
      }
    }

    const quickStartId = this.generateId();
    const quickStart = {
      id: quickStartId,
      platform: platform || "mobile",
      sessionHint,
      contextData,
      createdAt: new Date().toISOString(),
      status: "ready",
    };

    await this.set(`quickstart:${quickStartId}`, JSON.stringify(quickStart));

    return new Response(
      JSON.stringify({
        success: true,
        quickStartId,
        contextData,
        recommendations: this.getMobileRecommendations(contextData),
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async createMobileHandoff(request) {
    const body = await request.json();
    const { sessionId, mobileContext, targetApp } = body;

    const handoffId = this.generateId();
    const handoff = {
      id: handoffId,
      sessionId,
      targetApp: targetApp || "claude-mobile",
      mobileContext: {
        simplified: true,
        keyPoints: this.extractKeyPoints(mobileContext),
        nextActions: this.suggestNextActions(mobileContext),
        ...mobileContext,
      },
      createdAt: new Date().toISOString(),
      platform: "mobile",
      status: "pending",
    };

    await this.set(`mobile-handoff:${handoffId}`, JSON.stringify(handoff));

    return new Response(
      JSON.stringify({
        success: true,
        handoffId,
        handoff,
        mobileUrl: this.generateMobileUrl(handoffId),
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async continueMobileSession(sessionId) {
    const sessionData =
      (await this.get(`session:${sessionId}`)) ||
      (await this.get(`mobile-handoff:${sessionId}`)) ||
      (await this.get(`quickstart:${sessionId}`));

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

    const session = JSON.parse(sessionData);

    return new Response(
      JSON.stringify({
        success: true,
        session,
        mobileOptimized: {
          summary: this.createMobileSummary(session),
          quickActions: this.suggestMobileActions(session),
          context: this.simplifyContext(session),
        },
        service: "chitty-ultimate-worker",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async getMobileStatus() {
    return new Response(
      JSON.stringify({
        service: "ChittyChat Mobile Bridge",
        status: "operational",
        worker: "chitty-ultimate-worker",
        features: [
          "Quick start for mobile",
          "Context simplification",
          "Cross-app handoff",
          "Mobile-optimized responses",
        ],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async getMobileInfo() {
    return new Response(
      JSON.stringify({
        service: "ChittyChat Mobile Bridge",
        message: "Cross-platform AI session continuity for mobile",
        worker: "chitty-ultimate-worker",
        endpoints: [
          "POST /mobile/quick-start - Start with context hint",
          "POST /mobile/handoff - Create mobile handoff",
          "GET /mobile/continue/{id} - Continue session on mobile",
          "GET /mobile/status - Service status",
        ],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Helper methods
  getMobileRecommendations(contextData) {
    if (!contextData) {
      return [
        "Start a new session",
        "Import from desktop Claude",
        "Quick task creation",
      ];
    }

    return [
      "Continue where you left off",
      "Review recent context",
      "Quick status update",
      "Mobile-optimized summary",
    ];
  }

  extractKeyPoints(context) {
    if (!context || typeof context !== "object") return [];

    // Simple key point extraction for mobile
    const points = [];

    if (context.task) points.push(`Task: ${context.task}`);
    if (context.progress) points.push(`Progress: ${context.progress}`);
    if (context.nextSteps) points.push(`Next: ${context.nextSteps}`);

    return points.slice(0, 3); // Limit to 3 key points for mobile
  }

  suggestNextActions(context) {
    if (!context)
      return ["Continue development", "Review status", "Update progress"];

    return [
      "Continue current task",
      "Review progress",
      "Quick update",
      "Sync changes",
    ];
  }

  createMobileSummary(session) {
    return `${session.platform || "Session"} started at ${new Date(session.createdAt).toLocaleTimeString()}`;
  }

  suggestMobileActions(session) {
    return ["Continue", "Status", "Sync", "Handoff"];
  }

  simplifyContext(session) {
    return {
      id: session.id,
      platform: session.platform,
      status: session.status,
      lastActivity: session.lastActivity,
    };
  }

  generateMobileUrl(handoffId) {
    return `https://chitty.cc/mobile/continue/${handoffId}`;
  }

  // Storage abstraction
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

  generateId() {
    return `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}
