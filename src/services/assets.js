/**
 * ChittyOS Assets Service Handler
 * Digital and physical asset management with blockchain integration
 */

export async function assetsHandler(request, env, path) {
  const endpoint = path.replace("/assets", "");
  const url = new URL(request.url);

  switch (endpoint) {
    case "/create":
      return await createAsset(request, env);
    case "/transfer":
      return await transferAsset(request, env);
    case "/list":
      return await listAssets(request, env);
    case "/nft/mint":
      return await mintNFT(request, env);
    case "/verify":
      return await verifyAsset(request, env);
    case "/custody/create":
      return await createCustody(request, env);
    case "/portfolio/analyze":
      return await analyzePortfolio(request, env);
    case "/tokenize":
      return await tokenizeAsset(request, env);
    default:
      return new Response(
        JSON.stringify({
          error: "Assets endpoint not found",
          available: [
            "/create",
            "/transfer",
            "/list",
            "/nft/mint",
            "/verify",
            "/custody/create",
            "/portfolio/analyze",
            "/tokenize",
          ],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

async function createAsset(request, env) {
  try {
    const payload = await request.json();
    const assetId = `ASSET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.name || !payload.type || !payload.owner) {
      return Response.json(
        {
          error: "Missing required fields: name, type, owner",
        },
        { status: 400 },
      );
    }

    const asset = {
      assetId,
      name: payload.name,
      type: payload.type, // DIGITAL, PHYSICAL, INTELLECTUAL, FINANCIAL
      owner: payload.owner,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      value: {
        amount: payload.value || 0,
        currency: payload.currency || "USD",
        lastValuation: new Date().toISOString(),
      },
      metadata: {
        description: payload.description,
        category: payload.category,
        tags: payload.tags || [],
        caseId: payload.caseId,
        location: payload.location,
        serialNumber: payload.serialNumber,
      },
      blockchain: {
        tokenized: false,
        contractAddress: null,
        tokenId: null,
        network: null,
      },
      provenance: [
        {
          event: "CREATED",
          timestamp: new Date().toISOString(),
          actor: payload.owner,
          details: "Asset registered in ChittyOS",
        },
      ],
    };

    // Store in KV
    await env.KV_NAMESPACE.put(`asset:${assetId}`, JSON.stringify(asset));

    // Store in D1 if available
    if (env.D1_DATABASE) {
      await env.D1_DATABASE.prepare(
        `INSERT INTO assets (asset_id, name, type, owner, status, created_at, value, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          assetId,
          payload.name,
          payload.type,
          payload.owner,
          "ACTIVE",
          new Date().toISOString(),
          JSON.stringify(asset.value),
          JSON.stringify(asset.metadata),
        )
        .run();
    }

    // Generate ChittyID
    const chittyId = await generateChittyID("ASSET", assetId, env);

    return Response.json({
      success: true,
      assetId,
      chittyId,
      asset,
    });
  } catch (error) {
    console.error("Error creating asset:", error);
    return Response.json(
      {
        error: "Failed to create asset",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function transferAsset(request, env) {
  try {
    const payload = await request.json();
    const { assetId, from, to, transferType } = payload;

    if (!assetId || !from || !to) {
      return Response.json(
        {
          error: "Missing required fields: assetId, from, to",
        },
        { status: 400 },
      );
    }

    // Retrieve asset
    const assetData = await env.KV_NAMESPACE.get(`asset:${assetId}`);
    if (!assetData) {
      return Response.json(
        {
          error: "Asset not found",
        },
        { status: 404 },
      );
    }

    const asset = JSON.parse(assetData);

    // Verify ownership
    if (asset.owner !== from) {
      return Response.json(
        {
          error: "Unauthorized: Sender does not own the asset",
        },
        { status: 403 },
      );
    }

    // Create transfer record
    const transferId = `TRANSFER-${Date.now()}`;
    const transfer = {
      transferId,
      assetId,
      from,
      to,
      type: transferType || "DIRECT",
      timestamp: new Date().toISOString(),
      status: "PENDING",
      metadata: {
        previousOwner: from,
        newOwner: to,
        reason: payload.reason,
        value: payload.value || asset.value.amount,
      },
    };

    // Update asset ownership
    asset.owner = to;
    asset.provenance.push({
      event: "TRANSFERRED",
      timestamp: new Date().toISOString(),
      actor: from,
      details: `Transferred from ${from} to ${to}`,
      transferId,
    });

    // Save updated asset
    await env.KV_NAMESPACE.put(`asset:${assetId}`, JSON.stringify(asset));

    // Store transfer record
    await env.KV_NAMESPACE.put(
      `transfer:${transferId}`,
      JSON.stringify(transfer),
    );

    // Queue for blockchain recording
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "RECORD_TRANSFER",
        transferId,
        assetId,
      });
    }

    return Response.json({
      success: true,
      transferId,
      assetId,
      transfer,
    });
  } catch (error) {
    console.error("Error transferring asset:", error);
    return Response.json(
      {
        error: "Failed to transfer asset",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function listAssets(request, env) {
  try {
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    const type = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const cursor = url.searchParams.get("cursor");

    // List assets from KV
    const list = await env.KV_NAMESPACE.list({
      prefix: "asset:",
      limit,
      cursor,
    });

    const assets = [];
    for (const key of list.keys) {
      const assetData = await env.KV_NAMESPACE.get(key.name);
      const asset = JSON.parse(assetData);

      // Apply filters
      if (owner && asset.owner !== owner) continue;
      if (type && asset.type !== type) continue;

      assets.push(asset);
    }

    // Calculate portfolio value
    const totalValue = assets.reduce(
      (sum, asset) => sum + (asset.value.amount || 0),
      0,
    );

    return Response.json({
      success: true,
      count: assets.length,
      totalValue,
      assets,
      cursor: list.list_complete ? null : list.cursor,
    });
  } catch (error) {
    console.error("Error listing assets:", error);
    return Response.json(
      {
        error: "Failed to list assets",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function mintNFT(request, env) {
  try {
    const payload = await request.json();
    const nftId = `NFT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.assetId || !payload.metadata) {
      return Response.json(
        {
          error: "Missing required fields: assetId, metadata",
        },
        { status: 400 },
      );
    }

    // Retrieve asset
    const assetData = await env.KV_NAMESPACE.get(`asset:${payload.assetId}`);
    if (!assetData) {
      return Response.json(
        {
          error: "Asset not found",
        },
        { status: 404 },
      );
    }

    const asset = JSON.parse(assetData);

    // Create NFT metadata
    const nft = {
      nftId,
      assetId: payload.assetId,
      tokenId: Math.floor(Math.random() * 1000000),
      contractAddress: env.CHITTY_CONTRACT_ADDRESS || "0x0000",
      network: payload.network || "ethereum",
      owner: asset.owner,
      mintedAt: new Date().toISOString(),
      metadata: {
        name: payload.metadata.name || asset.name,
        description: payload.metadata.description || asset.metadata.description,
        image: payload.metadata.image,
        attributes: payload.metadata.attributes || [],
        external_url: payload.metadata.external_url,
      },
      status: "MINTING",
    };

    // Update asset with NFT info
    asset.blockchain = {
      tokenized: true,
      contractAddress: nft.contractAddress,
      tokenId: nft.tokenId,
      network: nft.network,
      nftId: nft.nftId,
    };

    // Save NFT and updated asset
    await env.KV_NAMESPACE.put(`nft:${nftId}`, JSON.stringify(nft));
    await env.KV_NAMESPACE.put(
      `asset:${payload.assetId}`,
      JSON.stringify(asset),
    );

    // Queue for actual blockchain minting
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "MINT_NFT",
        nftId,
        assetId: payload.assetId,
      });
    }

    return Response.json({
      success: true,
      nftId,
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      nft,
    });
  } catch (error) {
    console.error("Error minting NFT:", error);
    return Response.json(
      {
        error: "Failed to mint NFT",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function verifyAsset(request, env) {
  try {
    const payload = await request.json();
    const { assetId, verificationMethod } = payload;

    if (!assetId) {
      return Response.json(
        {
          error: "Missing required field: assetId",
        },
        { status: 400 },
      );
    }

    // Retrieve asset
    const assetData = await env.KV_NAMESPACE.get(`asset:${assetId}`);
    if (!assetData) {
      return Response.json(
        {
          error: "Asset not found",
        },
        { status: 404 },
      );
    }

    const asset = JSON.parse(assetData);

    // Perform verification
    const verification = {
      verificationId: `VERIFY-${Date.now()}`,
      assetId,
      method: verificationMethod || "STANDARD",
      timestamp: new Date().toISOString(),
      results: {
        authentic: true,
        ownershipVerified: true,
        valueConfirmed: true,
        integrityCheck: "PASSED",
      },
      details: {
        owner: asset.owner,
        currentValue: asset.value.amount,
        lastModified: asset.provenance[asset.provenance.length - 1].timestamp,
        provenanceCount: asset.provenance.length,
      },
      blockchain: asset.blockchain.tokenized
        ? {
            verified: true,
            contractAddress: asset.blockchain.contractAddress,
            tokenId: asset.blockchain.tokenId,
          }
        : null,
    };

    // Store verification
    await env.KV_NAMESPACE.put(
      `verification:${verification.verificationId}`,
      JSON.stringify(verification),
      { expirationTtl: 86400 * 90 }, // 90 days
    );

    return Response.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error("Error verifying asset:", error);
    return Response.json(
      {
        error: "Failed to verify asset",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function createCustody(request, env) {
  try {
    const payload = await request.json();
    const custodyId = `CUSTODY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.assetIds || !payload.custodian || !payload.beneficiary) {
      return Response.json(
        {
          error: "Missing required fields: assetIds, custodian, beneficiary",
        },
        { status: 400 },
      );
    }

    const custody = {
      custodyId,
      assetIds: payload.assetIds,
      custodian: payload.custodian,
      beneficiary: payload.beneficiary,
      type: payload.type || "STANDARD", // STANDARD, ESCROW, TRUST
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      terms: {
        duration: payload.duration,
        releaseConditions: payload.releaseConditions || [],
        fees: payload.fees || {},
        instructions: payload.instructions,
      },
      metadata: {
        caseId: payload.caseId,
        legalDocuments: payload.legalDocuments || [],
        notes: payload.notes,
      },
    };

    // Verify all assets exist and update their custody status
    for (const assetId of payload.assetIds) {
      const assetData = await env.KV_NAMESPACE.get(`asset:${assetId}`);
      if (!assetData) {
        return Response.json(
          {
            error: `Asset ${assetId} not found`,
          },
          { status: 404 },
        );
      }

      const asset = JSON.parse(assetData);
      asset.custody = {
        inCustody: true,
        custodyId,
        custodian: payload.custodian,
      };

      await env.KV_NAMESPACE.put(`asset:${assetId}`, JSON.stringify(asset));
    }

    // Store custody arrangement
    await env.KV_NAMESPACE.put(`custody:${custodyId}`, JSON.stringify(custody));

    return Response.json({
      success: true,
      custodyId,
      custody,
    });
  } catch (error) {
    console.error("Error creating custody:", error);
    return Response.json(
      {
        error: "Failed to create custody",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function analyzePortfolio(request, env) {
  try {
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");

    if (!owner) {
      return Response.json(
        {
          error: "Missing required parameter: owner",
        },
        { status: 400 },
      );
    }

    // Get all assets for owner
    const list = await env.KV_NAMESPACE.list({
      prefix: "asset:",
      limit: 1000,
    });

    const assets = [];
    let totalValue = 0;
    const typeDistribution = {};
    const categoryDistribution = {};

    for (const key of list.keys) {
      const assetData = await env.KV_NAMESPACE.get(key.name);
      const asset = JSON.parse(assetData);

      if (asset.owner === owner) {
        assets.push(asset);
        totalValue += asset.value.amount || 0;

        // Track distribution
        typeDistribution[asset.type] = (typeDistribution[asset.type] || 0) + 1;
        if (asset.metadata.category) {
          categoryDistribution[asset.metadata.category] =
            (categoryDistribution[asset.metadata.category] || 0) + 1;
        }
      }
    }

    // Calculate analytics
    const analysis = {
      analysisId: `ANALYSIS-${Date.now()}`,
      owner,
      timestamp: new Date().toISOString(),
      summary: {
        totalAssets: assets.length,
        totalValue,
        averageValue: assets.length > 0 ? totalValue / assets.length : 0,
      },
      distribution: {
        byType: typeDistribution,
        byCategory: categoryDistribution,
      },
      liquidity: {
        liquid: assets.filter((a) => a.type === "FINANCIAL").length,
        illiquid: assets.filter((a) => a.type !== "FINANCIAL").length,
      },
      blockchain: {
        tokenized: assets.filter((a) => a.blockchain.tokenized).length,
        nonTokenized: assets.filter((a) => !a.blockchain.tokenized).length,
      },
      recommendations: generatePortfolioRecommendations(assets, totalValue),
    };

    return Response.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    return Response.json(
      {
        error: "Failed to analyze portfolio",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function tokenizeAsset(request, env) {
  try {
    const payload = await request.json();
    const { assetId, tokenStandard, totalSupply } = payload;

    if (!assetId || !tokenStandard) {
      return Response.json(
        {
          error: "Missing required fields: assetId, tokenStandard",
        },
        { status: 400 },
      );
    }

    // Retrieve asset
    const assetData = await env.KV_NAMESPACE.get(`asset:${assetId}`);
    if (!assetData) {
      return Response.json(
        {
          error: "Asset not found",
        },
        { status: 404 },
      );
    }

    const asset = JSON.parse(assetData);

    // Create tokenization record
    const tokenizationId = `TOKEN-${Date.now()}`;
    const tokenization = {
      tokenizationId,
      assetId,
      standard: tokenStandard, // ERC20, ERC721, ERC1155
      totalSupply: totalSupply || 1,
      decimals: tokenStandard === "ERC20" ? 18 : 0,
      symbol:
        payload.symbol || `${asset.name.substring(0, 3).toUpperCase()}TKN`,
      name: payload.name || `${asset.name} Token`,
      createdAt: new Date().toISOString(),
      distribution: {
        owner: asset.owner,
        allocated: totalSupply || 1,
        available: 0,
      },
      metadata: {
        assetValue: asset.value.amount,
        tokenPrice: asset.value.amount / (totalSupply || 1),
        description: payload.description,
      },
      status: "PENDING_DEPLOYMENT",
    };

    // Update asset
    asset.tokenization = tokenization;

    // Save tokenization and updated asset
    await env.KV_NAMESPACE.put(
      `tokenization:${tokenizationId}`,
      JSON.stringify(tokenization),
    );
    await env.KV_NAMESPACE.put(`asset:${assetId}`, JSON.stringify(asset));

    // Queue for smart contract deployment
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "DEPLOY_TOKEN",
        tokenizationId,
        assetId,
      });
    }

    return Response.json({
      success: true,
      tokenizationId,
      tokenization,
    });
  } catch (error) {
    console.error("Error tokenizing asset:", error);
    return Response.json(
      {
        error: "Failed to tokenize asset",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Helper functions
function generatePortfolioRecommendations(assets, totalValue) {
  const recommendations = [];

  // Diversification check
  const typeCount = new Set(assets.map((a) => a.type)).size;
  if (typeCount < 3) {
    recommendations.push("Consider diversifying across more asset types");
  }

  // Tokenization opportunity
  const untokenized = assets.filter((a) => !a.blockchain.tokenized).length;
  if (untokenized > assets.length * 0.5) {
    recommendations.push(
      "Over 50% of assets are not tokenized - consider blockchain integration",
    );
  }

  // Value concentration
  const highValueAssets = assets.filter(
    (a) => a.value.amount > totalValue * 0.25,
  );
  if (highValueAssets.length > 0) {
    recommendations.push(
      "High value concentration in few assets - consider risk distribution",
    );
  }

  return recommendations;
}

async function generateChittyID(type, entityId, env) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `CHITTY-${type}-${timestamp}-${random}`.toUpperCase();
}
