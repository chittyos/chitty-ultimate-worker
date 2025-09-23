// Neon Database Module for ChittyOS - Optimized for Cloudflare Workers
import { neon } from "@neondatabase/serverless";

export class NeonDatabase {
  constructor(env) {
    // Use either Hyperdrive or direct Neon connection
    if (env.HYPERDRIVE) {
      // Hyperdrive for connection pooling and caching
      this.sql = neon(env.HYPERDRIVE.connectionString);
    } else {
      // Direct Neon serverless driver
      this.sql = neon(env.NEON_DATABASE_URL);
    }
  }

  async query(text, params = []) {
    // Neon serverless driver handles everything
    const result = await this.sql(text, params);
    return result;
  }

  // AI agent memory storage
  async storeAgentMemory(agentId, conversation) {
    const sql = `
      INSERT INTO agent_memories (agent_id, conversation, embedding, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `;

    const embedding = await this.generateEmbedding(conversation);
    return await this.query(sql, [agentId, conversation, embedding]);
  }

  // Vector similarity search for RAG
  async semanticSearch(queryVector, limit = 10) {
    const sql = `
      SELECT id, conversation, 1 - (embedding <=> $1::vector) as similarity
      FROM agent_memories
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    return await this.query(sql, [queryVector, limit]);
  }

  // Multi-tenant data isolation
  async getTenantData(tenantId, table) {
    const sql = `
      SELECT * FROM ${table}
      WHERE tenant_id = $1
    `;

    return await this.query(sql, [tenantId]);
  }

  // Database branching for testing
  async createBranch(branchName) {
    // This would use Neon API to create a branch
    // Branches are managed through Neon console or API
    return {
      branch: branchName,
      status: "Branch creation requires Neon API",
      note: "Use Neon console or API to manage branches",
    };
  }

  // Generate embeddings for vector search
  async generateEmbedding(text) {
    // This would integrate with Workers AI or Neon's pg_embedding
    // Placeholder for embedding generation
    return Array(1536)
      .fill(0)
      .map(() => Math.random());
  }
}

// Database handler for the worker
export async function handleDatabase(request, env) {
  const db = new NeonDatabase(env);
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Query endpoint
    if (pathname === "/db/query") {
      const { sql, params } = await request.json();
      const results = await db.query(sql, params);
      return new Response(JSON.stringify({ results }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Agent memory endpoint
    if (pathname === "/db/agent/memory") {
      const { agentId, conversation } = await request.json();
      const result = await db.storeAgentMemory(agentId, conversation);
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Semantic search endpoint
    if (pathname === "/db/search") {
      const { query, limit } = await request.json();
      const embedding = await db.generateEmbedding(query);
      const results = await db.semanticSearch(embedding, limit);
      return new Response(JSON.stringify({ results }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Database endpoint not found", { status: 404 });
  } catch (error) {
    return new Response(`Database error: ${error.message}`, {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }
}
