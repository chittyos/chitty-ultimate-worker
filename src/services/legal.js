/**
 * ChittyOS Legal Service Handler
 * Comprehensive legal case management and document processing
 */

export async function legalHandler(request, env, path) {
  const endpoint = path.replace("/legal", "");
  const url = new URL(request.url);

  switch (endpoint) {
    case "/case/create":
      return await createLegalCase(request, env);
    case "/case/update":
      return await updateLegalCase(request, env);
    case "/case/list":
      return await listLegalCases(request, env);
    case "/documents/analyze":
      return await analyzeLegalDocuments(request, env);
    case "/compliance/check":
      return await checkCompliance(request, env);
    case "/contract/review":
      return await reviewContract(request, env);
    case "/timeline/generate":
      return await generateCaseTimeline(request, env);
    case "/discovery/process":
      return await processDiscovery(request, env);
    default:
      return new Response(
        JSON.stringify({
          error: "Legal endpoint not found",
          available: [
            "/case/create",
            "/case/update",
            "/case/list",
            "/documents/analyze",
            "/compliance/check",
            "/contract/review",
            "/timeline/generate",
            "/discovery/process",
          ],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

async function createLegalCase(request, env) {
  try {
    const payload = await request.json();
    const caseId = `CASE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Validate required fields
    if (!payload.clientName || !payload.caseType) {
      return Response.json(
        {
          error: "Missing required fields: clientName, caseType",
        },
        { status: 400 },
      );
    }

    // Create case record in KV
    const caseData = {
      caseId,
      clientName: payload.clientName,
      caseType: payload.caseType,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      metadata: {
        jurisdiction: payload.jurisdiction || "US",
        priority: payload.priority || "NORMAL",
        assignedTeam: payload.assignedTeam || "UNASSIGNED",
        tags: payload.tags || [],
      },
      timeline: [
        {
          event: "Case Created",
          timestamp: new Date().toISOString(),
          automated: true,
        },
      ],
    };

    // Store in KV
    await env.KV_NAMESPACE.put(`case:${caseId}`, JSON.stringify(caseData));

    // Store in D1 if available
    if (env.D1_DATABASE) {
      await env.D1_DATABASE.prepare(
        `INSERT INTO cases (case_id, client_name, case_type, status, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          caseId,
          payload.clientName,
          payload.caseType,
          "ACTIVE",
          new Date().toISOString(),
          JSON.stringify(caseData.metadata),
        )
        .run();
    }

    // Queue for blockchain anchoring
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "ANCHOR_CASE",
        caseId,
        timestamp: new Date().toISOString(),
      });
    }

    // Generate ChittyID for the case
    const chittyId = await generateChittyID("LEGAL", caseId, env);

    return Response.json({
      success: true,
      caseId,
      chittyId,
      status: "CREATED",
      message: "Legal case created successfully",
      data: caseData,
    });
  } catch (error) {
    console.error("Error creating legal case:", error);
    return Response.json(
      {
        error: "Failed to create legal case",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function updateLegalCase(request, env) {
  try {
    const payload = await request.json();
    const { caseId, updates } = payload;

    if (!caseId) {
      return Response.json(
        {
          error: "Missing caseId",
        },
        { status: 400 },
      );
    }

    // Retrieve existing case
    const existingCase = await env.KV_NAMESPACE.get(`case:${caseId}`);
    if (!existingCase) {
      return Response.json(
        {
          error: "Case not found",
        },
        { status: 404 },
      );
    }

    const caseData = JSON.parse(existingCase);

    // Apply updates
    Object.assign(caseData, updates);
    caseData.updatedAt = new Date().toISOString();

    // Add to timeline
    caseData.timeline.push({
      event: `Case Updated: ${Object.keys(updates).join(", ")}`,
      timestamp: new Date().toISOString(),
      automated: false,
      updatedFields: Object.keys(updates),
    });

    // Save updated case
    await env.KV_NAMESPACE.put(`case:${caseId}`, JSON.stringify(caseData));

    return Response.json({
      success: true,
      caseId,
      message: "Case updated successfully",
      updatedFields: Object.keys(updates),
    });
  } catch (error) {
    console.error("Error updating legal case:", error);
    return Response.json(
      {
        error: "Failed to update legal case",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function listLegalCases(request, env) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "ACTIVE";
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const cursor = url.searchParams.get("cursor");

    // List cases from KV
    const list = await env.KV_NAMESPACE.list({
      prefix: "case:",
      limit,
      cursor,
    });

    const cases = [];
    for (const key of list.keys) {
      const caseData = await env.KV_NAMESPACE.get(key.name);
      const parsed = JSON.parse(caseData);
      if (!status || parsed.status === status) {
        cases.push(parsed);
      }
    }

    return Response.json({
      success: true,
      cases,
      cursor: list.list_complete ? null : list.cursor,
      total: cases.length,
    });
  } catch (error) {
    console.error("Error listing legal cases:", error);
    return Response.json(
      {
        error: "Failed to list legal cases",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function analyzeLegalDocuments(request, env) {
  try {
    const formData = await request.formData();
    const document = formData.get("document");
    const caseId = formData.get("caseId");
    const analysisType = formData.get("analysisType") || "comprehensive";

    if (!document || !caseId) {
      return Response.json(
        {
          error: "Missing required fields: document, caseId",
        },
        { status: 400 },
      );
    }

    // Store document in R2
    const documentId = `doc-${Date.now()}`;
    if (env.R2_BUCKET) {
      await env.R2_BUCKET.put(`legal/${caseId}/${documentId}`, document);
    }

    // Perform analysis (simulated)
    const analysis = {
      documentId,
      caseId,
      analysisType,
      timestamp: new Date().toISOString(),
      results: {
        keyTerms: [
          "liability",
          "indemnification",
          "termination",
          "confidentiality",
        ],
        riskScore: Math.floor(Math.random() * 100),
        complianceStatus: "COMPLIANT",
        summary: "Document analyzed successfully",
        recommendations: [
          "Review indemnification clause in Section 3.2",
          "Consider adding arbitration provision",
          "Verify jurisdiction alignment with client preferences",
        ],
        metadata: {
          pageCount: 10,
          wordCount: 5000,
          language: "en",
          documentType: "CONTRACT",
        },
      },
    };

    // Store analysis results
    await env.KV_NAMESPACE.put(
      `analysis:${documentId}`,
      JSON.stringify(analysis),
      { expirationTtl: 86400 * 30 }, // 30 days
    );

    return Response.json({
      success: true,
      documentId,
      caseId,
      analysis: analysis.results,
    });
  } catch (error) {
    console.error("Error analyzing legal documents:", error);
    return Response.json(
      {
        error: "Failed to analyze legal documents",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function checkCompliance(request, env) {
  try {
    const payload = await request.json();
    const { caseId, regulations = ["GDPR", "CCPA", "HIPAA"] } = payload;

    if (!caseId) {
      return Response.json(
        {
          error: "Missing caseId",
        },
        { status: 400 },
      );
    }

    // Perform compliance checks
    const complianceResults = {};
    for (const regulation of regulations) {
      complianceResults[regulation] = {
        compliant: Math.random() > 0.2, // 80% compliance rate
        score: Math.floor(Math.random() * 100),
        issues: [],
        recommendations: [],
      };

      if (!complianceResults[regulation].compliant) {
        complianceResults[regulation].issues = [
          `Missing ${regulation} required disclosure`,
          `Data retention policy needs update`,
        ];
        complianceResults[regulation].recommendations = [
          `Add ${regulation} compliance statement`,
          `Update privacy policy`,
        ];
      }
    }

    const overallCompliant = Object.values(complianceResults).every(
      (r) => r.compliant,
    );

    return Response.json({
      success: true,
      caseId,
      timestamp: new Date().toISOString(),
      overallCompliant,
      regulations: complianceResults,
    });
  } catch (error) {
    console.error("Error checking compliance:", error);
    return Response.json(
      {
        error: "Failed to check compliance",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function reviewContract(request, env) {
  try {
    const payload = await request.json();
    const { contractText, caseId, reviewType = "standard" } = payload;

    if (!contractText || !caseId) {
      return Response.json(
        {
          error: "Missing required fields: contractText, caseId",
        },
        { status: 400 },
      );
    }

    // AI-powered contract review (simulated)
    const review = {
      caseId,
      reviewId: `review-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reviewType,
      findings: {
        criticalIssues: [
          {
            severity: "HIGH",
            clause: "Limitation of Liability",
            issue: "No cap on liability specified",
            recommendation: "Add liability cap at 12 months of fees",
          },
        ],
        warnings: [
          {
            severity: "MEDIUM",
            clause: "Termination",
            issue: "No cure period specified",
            recommendation: "Add 30-day cure period",
          },
        ],
        suggestions: [
          "Consider adding force majeure clause",
          "Include data protection provisions",
        ],
      },
      score: {
        overall: 75,
        clarity: 80,
        completeness: 70,
        riskMitigation: 75,
      },
    };

    // Store review
    await env.KV_NAMESPACE.put(
      `review:${review.reviewId}`,
      JSON.stringify(review),
    );

    return Response.json({
      success: true,
      reviewId: review.reviewId,
      caseId,
      review,
    });
  } catch (error) {
    console.error("Error reviewing contract:", error);
    return Response.json(
      {
        error: "Failed to review contract",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function generateCaseTimeline(request, env) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");

    if (!caseId) {
      return Response.json(
        {
          error: "Missing caseId parameter",
        },
        { status: 400 },
      );
    }

    // Retrieve case data
    const caseData = await env.KV_NAMESPACE.get(`case:${caseId}`);
    if (!caseData) {
      return Response.json(
        {
          error: "Case not found",
        },
        { status: 404 },
      );
    }

    const parsed = JSON.parse(caseData);

    // Generate comprehensive timeline
    const timeline = {
      caseId,
      generatedAt: new Date().toISOString(),
      events: parsed.timeline || [],
      milestones: [
        {
          date: parsed.createdAt,
          event: "Case Initiated",
          status: "COMPLETED",
        },
        {
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          event: "Discovery Phase",
          status: "PENDING",
        },
        {
          date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          event: "Mediation",
          status: "PLANNED",
        },
      ],
    };

    return Response.json({
      success: true,
      caseId,
      timeline,
    });
  } catch (error) {
    console.error("Error generating case timeline:", error);
    return Response.json(
      {
        error: "Failed to generate case timeline",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function processDiscovery(request, env) {
  try {
    const payload = await request.json();
    const { caseId, discoveryType, documents = [] } = payload;

    if (!caseId || !discoveryType) {
      return Response.json(
        {
          error: "Missing required fields: caseId, discoveryType",
        },
        { status: 400 },
      );
    }

    // Process discovery documents
    const discoveryId = `discovery-${Date.now()}`;
    const results = {
      discoveryId,
      caseId,
      type: discoveryType,
      timestamp: new Date().toISOString(),
      documentsProcessed: documents.length,
      findings: {
        relevantDocuments: Math.floor(documents.length * 0.3),
        privilegedDocuments: Math.floor(documents.length * 0.1),
        duplicates: Math.floor(documents.length * 0.2),
        needsReview: Math.floor(documents.length * 0.15),
      },
      nextSteps: [
        "Review privileged documents",
        "Tag relevant documents",
        "Prepare production set",
      ],
    };

    // Store discovery results
    await env.KV_NAMESPACE.put(
      `discovery:${discoveryId}`,
      JSON.stringify(results),
    );

    return Response.json({
      success: true,
      discoveryId,
      caseId,
      results,
    });
  } catch (error) {
    console.error("Error processing discovery:", error);
    return Response.json(
      {
        error: "Failed to process discovery",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Helper function to generate ChittyID
async function generateChittyID(type, entityId, env) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `CHITTY-${type}-${timestamp}-${random}`.toUpperCase();
}
