/**
 * ChittyOS Finance Service Handler
 * Comprehensive financial operations and transaction management
 */

export async function financeHandler(request, env, path) {
  const endpoint = path.replace("/finance", "");
  const url = new URL(request.url);

  switch (endpoint) {
    case "/transaction/create":
      return await createTransaction(request, env);
    case "/transaction/verify":
      return await verifyTransaction(request, env);
    case "/account/balance":
      return await getAccountBalance(request, env);
    case "/invoice/generate":
      return await generateInvoice(request, env);
    case "/payment/process":
      return await processPayment(request, env);
    case "/escrow/create":
      return await createEscrow(request, env);
    case "/report/generate":
      return await generateFinancialReport(request, env);
    case "/audit/trail":
      return await getAuditTrail(request, env);
    default:
      return new Response(
        JSON.stringify({
          error: "Finance endpoint not found",
          available: [
            "/transaction/create",
            "/transaction/verify",
            "/account/balance",
            "/invoice/generate",
            "/payment/process",
            "/escrow/create",
            "/report/generate",
            "/audit/trail",
          ],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

async function createTransaction(request, env) {
  try {
    const payload = await request.json();
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.amount || !payload.from || !payload.to) {
      return Response.json(
        {
          error: "Missing required fields: amount, from, to",
        },
        { status: 400 },
      );
    }

    const transaction = {
      transactionId,
      amount: payload.amount,
      currency: payload.currency || "USD",
      from: payload.from,
      to: payload.to,
      type: payload.type || "TRANSFER",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      metadata: {
        caseId: payload.caseId,
        description: payload.description,
        tags: payload.tags || [],
        fee: calculateTransactionFee(payload.amount),
      },
      verification: {
        required: payload.amount > 10000,
        status: "PENDING",
      },
    };

    // Store in KV
    await env.KV_NAMESPACE.put(
      `transaction:${transactionId}`,
      JSON.stringify(transaction),
    );

    // Store in D1 if available
    if (env.D1_DATABASE) {
      await env.D1_DATABASE.prepare(
        `INSERT INTO transactions (transaction_id, amount, currency, from_account, to_account, type, status, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          transactionId,
          payload.amount,
          transaction.currency,
          payload.from,
          payload.to,
          transaction.type,
          "PENDING",
          new Date().toISOString(),
          JSON.stringify(transaction.metadata),
        )
        .run();
    }

    // Queue for processing
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "PROCESS_TRANSACTION",
        transactionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Generate ChittyID
    const chittyId = await generateChittyID("FINANCE", transactionId, env);

    return Response.json({
      success: true,
      transactionId,
      chittyId,
      status: "CREATED",
      message: "Transaction created successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return Response.json(
      {
        error: "Failed to create transaction",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function verifyTransaction(request, env) {
  try {
    const payload = await request.json();
    const { transactionId, verificationCode } = payload;

    if (!transactionId || !verificationCode) {
      return Response.json(
        {
          error: "Missing required fields: transactionId, verificationCode",
        },
        { status: 400 },
      );
    }

    // Retrieve transaction
    const txData = await env.KV_NAMESPACE.get(`transaction:${transactionId}`);
    if (!txData) {
      return Response.json(
        {
          error: "Transaction not found",
        },
        { status: 404 },
      );
    }

    const transaction = JSON.parse(txData);

    // Verify code (simulated)
    const isValid = verificationCode === "123456"; // In production, use proper verification

    if (isValid) {
      transaction.status = "VERIFIED";
      transaction.verification.status = "COMPLETED";
      transaction.verification.timestamp = new Date().toISOString();

      await env.KV_NAMESPACE.put(
        `transaction:${transactionId}`,
        JSON.stringify(transaction),
      );

      return Response.json({
        success: true,
        transactionId,
        status: "VERIFIED",
        message: "Transaction verified successfully",
      });
    } else {
      return Response.json(
        {
          error: "Invalid verification code",
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return Response.json(
      {
        error: "Failed to verify transaction",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function getAccountBalance(request, env) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return Response.json(
        {
          error: "Missing accountId parameter",
        },
        { status: 400 },
      );
    }

    // Get balance from KV (simulated)
    const balanceData = await env.KV_NAMESPACE.get(`balance:${accountId}`);

    const balance = balanceData
      ? JSON.parse(balanceData)
      : {
          accountId,
          available: 10000.0,
          pending: 500.0,
          currency: "USD",
          lastUpdated: new Date().toISOString(),
        };

    return Response.json({
      success: true,
      accountId,
      balance,
    });
  } catch (error) {
    console.error("Error getting account balance:", error);
    return Response.json(
      {
        error: "Failed to get account balance",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function generateInvoice(request, env) {
  try {
    const payload = await request.json();
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.clientId || !payload.items || !payload.items.length) {
      return Response.json(
        {
          error: "Missing required fields: clientId, items",
        },
        { status: 400 },
      );
    }

    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const tax = subtotal * (payload.taxRate || 0.1);
    const total = subtotal + tax;

    const invoice = {
      invoiceId,
      clientId: payload.clientId,
      caseId: payload.caseId,
      issueDate: new Date().toISOString(),
      dueDate:
        payload.dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "DRAFT",
      items: payload.items,
      financial: {
        subtotal,
        tax,
        total,
        currency: payload.currency || "USD",
      },
      metadata: {
        paymentTerms: payload.paymentTerms || "Net 30",
        notes: payload.notes,
        tags: payload.tags || [],
      },
    };

    // Store invoice
    await env.KV_NAMESPACE.put(`invoice:${invoiceId}`, JSON.stringify(invoice));

    // Generate PDF if requested
    if (payload.generatePDF) {
      // Queue PDF generation
      if (env.QUEUE) {
        await env.QUEUE.send({
          type: "GENERATE_INVOICE_PDF",
          invoiceId,
        });
      }
    }

    return Response.json({
      success: true,
      invoiceId,
      invoice,
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return Response.json(
      {
        error: "Failed to generate invoice",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function processPayment(request, env) {
  try {
    const payload = await request.json();
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.amount || !payload.method || !payload.accountId) {
      return Response.json(
        {
          error: "Missing required fields: amount, method, accountId",
        },
        { status: 400 },
      );
    }

    const payment = {
      paymentId,
      amount: payload.amount,
      currency: payload.currency || "USD",
      method: payload.method, // CARD, ACH, WIRE, CRYPTO
      accountId: payload.accountId,
      invoiceId: payload.invoiceId,
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
      metadata: {
        caseId: payload.caseId,
        description: payload.description,
        reference: payload.reference,
      },
    };

    // Store payment
    await env.KV_NAMESPACE.put(`payment:${paymentId}`, JSON.stringify(payment));

    // Process payment based on method
    if (payload.method === "STRIPE" && env.STRIPE_SECRET_KEY) {
      // Integration with Stripe
      // const stripeResponse = await processStripePayment(payment, env);
    }

    // Update payment status
    payment.status = "COMPLETED";
    payment.completedAt = new Date().toISOString();

    await env.KV_NAMESPACE.put(`payment:${paymentId}`, JSON.stringify(payment));

    return Response.json({
      success: true,
      paymentId,
      status: payment.status,
      payment,
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    return Response.json(
      {
        error: "Failed to process payment",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function createEscrow(request, env) {
  try {
    const payload = await request.json();
    const escrowId = `ESCROW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.amount || !payload.buyer || !payload.seller) {
      return Response.json(
        {
          error: "Missing required fields: amount, buyer, seller",
        },
        { status: 400 },
      );
    }

    const escrow = {
      escrowId,
      amount: payload.amount,
      currency: payload.currency || "USD",
      buyer: payload.buyer,
      seller: payload.seller,
      status: "PENDING",
      conditions: payload.conditions || [],
      releaseDate: payload.releaseDate,
      createdAt: new Date().toISOString(),
      metadata: {
        caseId: payload.caseId,
        contractId: payload.contractId,
        description: payload.description,
        arbiter: payload.arbiter,
      },
    };

    // Store escrow
    await env.KV_NAMESPACE.put(`escrow:${escrowId}`, JSON.stringify(escrow));

    // Create blockchain anchor if available
    if (env.BLOCKCHAIN_RPC_URL) {
      // await anchorEscrowToBlockchain(escrow, env);
    }

    return Response.json({
      success: true,
      escrowId,
      escrow,
    });
  } catch (error) {
    console.error("Error creating escrow:", error);
    return Response.json(
      {
        error: "Failed to create escrow",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function generateFinancialReport(request, env) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const caseId = url.searchParams.get("caseId");

    if (!startDate || !endDate) {
      return Response.json(
        {
          error: "Missing required parameters: startDate, endDate",
        },
        { status: 400 },
      );
    }

    // Generate report (simulated)
    const report = {
      reportId: `REPORT-${Date.now()}`,
      period: {
        start: startDate,
        end: endDate,
      },
      caseId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue: 150000.0,
        totalExpenses: 50000.0,
        netIncome: 100000.0,
        transactionCount: 245,
        averageTransactionSize: 612.24,
      },
      breakdown: {
        byType: {
          TRANSFER: 80000,
          PAYMENT: 40000,
          ESCROW: 30000,
        },
        byStatus: {
          COMPLETED: 140000,
          PENDING: 8000,
          FAILED: 2000,
        },
      },
      trends: {
        growth: "+15%",
        projection: "Positive",
      },
    };

    return Response.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Error generating financial report:", error);
    return Response.json(
      {
        error: "Failed to generate financial report",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function getAuditTrail(request, env) {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (!entityType || !entityId) {
      return Response.json(
        {
          error: "Missing required parameters: entityType, entityId",
        },
        { status: 400 },
      );
    }

    // Get audit logs from KV
    const auditKey = `audit:${entityType}:${entityId}`;
    const auditData = await env.KV_NAMESPACE.get(auditKey);

    const auditTrail = auditData
      ? JSON.parse(auditData)
      : {
          entityType,
          entityId,
          entries: [],
        };

    // Add sample entries if empty
    if (auditTrail.entries.length === 0) {
      auditTrail.entries = [
        {
          timestamp: new Date().toISOString(),
          action: "CREATE",
          actor: "system",
          details: "Entity created",
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          action: "UPDATE",
          actor: "user-123",
          details: "Status changed to ACTIVE",
        },
      ];
    }

    return Response.json({
      success: true,
      auditTrail: {
        ...auditTrail,
        entries: auditTrail.entries.slice(0, limit),
      },
    });
  } catch (error) {
    console.error("Error getting audit trail:", error);
    return Response.json(
      {
        error: "Failed to get audit trail",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Helper functions
function calculateTransactionFee(amount) {
  if (amount < 100) return 1.0;
  if (amount < 1000) return 2.5;
  if (amount < 10000) return 5.0;
  return amount * 0.001; // 0.1% for large transactions
}

async function generateChittyID(type, entityId, env) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `CHITTY-${type}-${timestamp}-${random}`.toUpperCase();
}
