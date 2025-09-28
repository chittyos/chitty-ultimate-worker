/**
 * ChittyOS Property Service Handler
 * Real estate and property management services
 */

export async function propertyHandler(request, env, path) {
  const endpoint = path.replace("/property", "");
  const url = new URL(request.url);

  switch (endpoint) {
    case "/listing/create":
      return await createListing(request, env);
    case "/listing/search":
      return await searchListings(request, env);
    case "/property/value":
      return await getPropertyValuation(request, env);
    case "/deed/register":
      return await registerDeed(request, env);
    case "/lease/create":
      return await createLease(request, env);
    case "/inspection/schedule":
      return await scheduleInspection(request, env);
    case "/title/verify":
      return await verifyTitle(request, env);
    case "/mortgage/calculate":
      return await calculateMortgage(request, env);
    default:
      return new Response(
        JSON.stringify({
          error: "Property endpoint not found",
          available: [
            "/listing/create",
            "/listing/search",
            "/property/value",
            "/deed/register",
            "/lease/create",
            "/inspection/schedule",
            "/title/verify",
            "/mortgage/calculate",
          ],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

async function createListing(request, env) {
  try {
    const payload = await request.json();
    const listingId = `PROP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.address || !payload.price || !payload.type) {
      return Response.json(
        {
          error: "Missing required fields: address, price, type",
        },
        { status: 400 },
      );
    }

    const listing = {
      listingId,
      address: payload.address,
      price: payload.price,
      type: payload.type, // RESIDENTIAL, COMMERCIAL, LAND
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      details: {
        bedrooms: payload.bedrooms,
        bathrooms: payload.bathrooms,
        squareFeet: payload.squareFeet,
        yearBuilt: payload.yearBuilt,
        lot: payload.lot,
        features: payload.features || [],
      },
      location: {
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        coordinates: payload.coordinates,
        neighborhood: payload.neighborhood,
      },
      metadata: {
        mlsNumber: payload.mlsNumber,
        taxId: payload.taxId,
        zoning: payload.zoning,
        caseId: payload.caseId,
      },
      images: payload.images || [],
      documents: [],
    };

    // Store in KV
    await env.KV_NAMESPACE.put(`listing:${listingId}`, JSON.stringify(listing));

    // Store in D1 if available
    if (env.D1_DATABASE) {
      await env.D1_DATABASE.prepare(
        `INSERT INTO properties (listing_id, address, price, type, status, created_at, details, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          listingId,
          payload.address,
          payload.price,
          payload.type,
          "ACTIVE",
          new Date().toISOString(),
          JSON.stringify(listing.details),
          JSON.stringify(listing.location),
        )
        .run();
    }

    // Generate ChittyID
    const chittyId = await generateChittyID("PROPERTY", listingId, env);

    return Response.json({
      success: true,
      listingId,
      chittyId,
      listing,
    });
  } catch (error) {
    console.error("Error creating listing:", error);
    return Response.json(
      {
        error: "Failed to create listing",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function searchListings(request, env) {
  try {
    const url = new URL(request.url);
    const minPrice = parseFloat(url.searchParams.get("minPrice") || "0");
    const maxPrice = parseFloat(
      url.searchParams.get("maxPrice") || "999999999",
    );
    const type = url.searchParams.get("type");
    const city = url.searchParams.get("city");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Search listings from KV
    const list = await env.KV_NAMESPACE.list({
      prefix: "listing:",
      limit: 100, // Get more to filter
    });

    const listings = [];
    for (const key of list.keys) {
      const listingData = await env.KV_NAMESPACE.get(key.name);
      const listing = JSON.parse(listingData);

      // Apply filters
      if (listing.price >= minPrice && listing.price <= maxPrice) {
        if (!type || listing.type === type) {
          if (!city || listing.location.city === city) {
            listings.push(listing);
          }
        }
      }

      if (listings.length >= limit) break;
    }

    return Response.json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Error searching listings:", error);
    return Response.json(
      {
        error: "Failed to search listings",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function getPropertyValuation(request, env) {
  try {
    const payload = await request.json();
    const { address, propertyDetails } = payload;

    if (!address) {
      return Response.json(
        {
          error: "Missing required field: address",
        },
        { status: 400 },
      );
    }

    // AI-powered valuation (simulated)
    const baseValue = propertyDetails?.squareFeet
      ? propertyDetails.squareFeet * 150
      : 300000;
    const marketAdjustment = Math.random() * 0.2 - 0.1; // +/- 10%
    const estimatedValue = baseValue * (1 + marketAdjustment);

    const valuation = {
      valuationId: `VAL-${Date.now()}`,
      address,
      estimatedValue,
      confidence: 0.85,
      valuationDate: new Date().toISOString(),
      methodology: "Comparative Market Analysis",
      comparables: [
        {
          address: "123 Similar St",
          soldPrice: estimatedValue * 0.98,
          soldDate: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          address: "456 Nearby Ave",
          soldPrice: estimatedValue * 1.02,
          soldDate: new Date(
            Date.now() - 45 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ],
      priceRange: {
        low: estimatedValue * 0.9,
        high: estimatedValue * 1.1,
      },
    };

    // Store valuation
    await env.KV_NAMESPACE.put(
      `valuation:${valuation.valuationId}`,
      JSON.stringify(valuation),
      { expirationTtl: 86400 * 7 }, // 7 days
    );

    return Response.json({
      success: true,
      valuation,
    });
  } catch (error) {
    console.error("Error getting property valuation:", error);
    return Response.json(
      {
        error: "Failed to get property valuation",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function registerDeed(request, env) {
  try {
    const payload = await request.json();
    const deedId = `DEED-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.propertyId || !payload.grantor || !payload.grantee) {
      return Response.json(
        {
          error: "Missing required fields: propertyId, grantor, grantee",
        },
        { status: 400 },
      );
    }

    const deed = {
      deedId,
      propertyId: payload.propertyId,
      type: payload.type || "WARRANTY", // WARRANTY, QUITCLAIM, SPECIAL
      grantor: payload.grantor,
      grantee: payload.grantee,
      recordedAt: new Date().toISOString(),
      consideration: payload.consideration,
      legalDescription: payload.legalDescription,
      metadata: {
        recordingNumber: `REC-${Date.now()}`,
        book: Math.floor(Math.random() * 1000),
        page: Math.floor(Math.random() * 500),
        county: payload.county,
        state: payload.state,
      },
      blockchain: {
        anchored: false,
        txHash: null,
      },
    };

    // Store deed
    await env.KV_NAMESPACE.put(`deed:${deedId}`, JSON.stringify(deed));

    // Queue for blockchain anchoring
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "ANCHOR_DEED",
        deedId,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      deedId,
      deed,
    });
  } catch (error) {
    console.error("Error registering deed:", error);
    return Response.json(
      {
        error: "Failed to register deed",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function createLease(request, env) {
  try {
    const payload = await request.json();
    const leaseId = `LEASE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (
      !payload.propertyId ||
      !payload.tenant ||
      !payload.landlord ||
      !payload.monthlyRent
    ) {
      return Response.json(
        {
          error:
            "Missing required fields: propertyId, tenant, landlord, monthlyRent",
        },
        { status: 400 },
      );
    }

    const lease = {
      leaseId,
      propertyId: payload.propertyId,
      tenant: payload.tenant,
      landlord: payload.landlord,
      monthlyRent: payload.monthlyRent,
      securityDeposit: payload.securityDeposit || payload.monthlyRent,
      startDate: payload.startDate || new Date().toISOString(),
      endDate:
        payload.endDate ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: "ACTIVE",
      terms: {
        paymentDue: payload.paymentDue || 1, // Day of month
        lateFee: payload.lateFee || 50,
        utilities: payload.utilities || "TENANT",
        pets: payload.pets || false,
        smoking: payload.smoking || false,
      },
      metadata: {
        caseId: payload.caseId,
        autoRenew: payload.autoRenew || false,
        notes: payload.notes,
      },
    };

    // Store lease
    await env.KV_NAMESPACE.put(`lease:${leaseId}`, JSON.stringify(lease));

    // Generate ChittyID
    const chittyId = await generateChittyID("LEASE", leaseId, env);

    return Response.json({
      success: true,
      leaseId,
      chittyId,
      lease,
    });
  } catch (error) {
    console.error("Error creating lease:", error);
    return Response.json(
      {
        error: "Failed to create lease",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function scheduleInspection(request, env) {
  try {
    const payload = await request.json();
    const inspectionId = `INSP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    if (!payload.propertyId || !payload.type || !payload.scheduledDate) {
      return Response.json(
        {
          error: "Missing required fields: propertyId, type, scheduledDate",
        },
        { status: 400 },
      );
    }

    const inspection = {
      inspectionId,
      propertyId: payload.propertyId,
      type: payload.type, // HOME, PEST, ROOF, FOUNDATION, ELECTRICAL, PLUMBING
      scheduledDate: payload.scheduledDate,
      inspector: payload.inspector,
      status: "SCHEDULED",
      createdAt: new Date().toISOString(),
      contact: {
        name: payload.contactName,
        phone: payload.contactPhone,
        email: payload.contactEmail,
      },
      metadata: {
        caseId: payload.caseId,
        listingId: payload.listingId,
        estimatedDuration: payload.estimatedDuration || "2 hours",
        specialInstructions: payload.specialInstructions,
      },
    };

    // Store inspection
    await env.KV_NAMESPACE.put(
      `inspection:${inspectionId}`,
      JSON.stringify(inspection),
    );

    // Send notification if configured
    if (env.QUEUE) {
      await env.QUEUE.send({
        type: "INSPECTION_REMINDER",
        inspectionId,
        scheduledDate: payload.scheduledDate,
      });
    }

    return Response.json({
      success: true,
      inspectionId,
      inspection,
    });
  } catch (error) {
    console.error("Error scheduling inspection:", error);
    return Response.json(
      {
        error: "Failed to schedule inspection",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function verifyTitle(request, env) {
  try {
    const payload = await request.json();
    const { propertyId, ownerName } = payload;

    if (!propertyId || !ownerName) {
      return Response.json(
        {
          error: "Missing required fields: propertyId, ownerName",
        },
        { status: 400 },
      );
    }

    // Title verification (simulated)
    const verification = {
      verificationId: `TITLE-${Date.now()}`,
      propertyId,
      ownerName,
      verifiedAt: new Date().toISOString(),
      status: "CLEAR", // CLEAR, ENCUMBERED, DISPUTED
      chainOfTitle: [
        {
          owner: ownerName,
          acquiredDate: new Date(
            Date.now() - 365 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          deedType: "WARRANTY",
        },
        {
          owner: "Previous Owner",
          acquiredDate: new Date(
            Date.now() - 730 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          deedType: "WARRANTY",
        },
      ],
      liens: [],
      easements: [],
      restrictions: [],
      insurability: true,
    };

    // Store verification
    await env.KV_NAMESPACE.put(
      `title:${verification.verificationId}`,
      JSON.stringify(verification),
      { expirationTtl: 86400 * 30 }, // 30 days
    );

    return Response.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error("Error verifying title:", error);
    return Response.json(
      {
        error: "Failed to verify title",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

async function calculateMortgage(request, env) {
  try {
    const payload = await request.json();
    const { principal, interestRate, termYears, downPayment } = payload;

    if (!principal || !interestRate || !termYears) {
      return Response.json(
        {
          error: "Missing required fields: principal, interestRate, termYears",
        },
        { status: 400 },
      );
    }

    const loanAmount = principal - (downPayment || 0);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = termYears * 12;

    // Calculate monthly payment using amortization formula
    const monthlyPayment =
      monthlyRate === 0
        ? loanAmount / numPayments
        : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalPayment = monthlyPayment * numPayments;
    const totalInterest = totalPayment - loanAmount;

    const calculation = {
      calculationId: `CALC-${Date.now()}`,
      inputs: {
        propertyPrice: principal,
        downPayment: downPayment || 0,
        loanAmount,
        interestRate,
        termYears,
      },
      results: {
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        loanToValue: ((loanAmount / principal) * 100).toFixed(2) + "%",
      },
      estimatedCosts: {
        propertyTax: Math.round((principal * 0.012) / 12), // 1.2% annually
        homeInsurance: Math.round((principal * 0.004) / 12), // 0.4% annually
        pmi:
          downPayment < principal * 0.2
            ? Math.round((loanAmount * 0.005) / 12)
            : 0,
        hoa: 0,
      },
      totalMonthlyPayment: 0,
    };

    calculation.totalMonthlyPayment =
      calculation.results.monthlyPayment +
      calculation.estimatedCosts.propertyTax +
      calculation.estimatedCosts.homeInsurance +
      calculation.estimatedCosts.pmi +
      calculation.estimatedCosts.hoa;

    return Response.json({
      success: true,
      calculation,
    });
  } catch (error) {
    console.error("Error calculating mortgage:", error);
    return Response.json(
      {
        error: "Failed to calculate mortgage",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Helper function
async function generateChittyID(type, entityId, env) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `CHITTY-${type}-${timestamp}-${random}`.toUpperCase();
}
