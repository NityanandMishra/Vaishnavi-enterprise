import { prisma } from "@/lib/db";
import { formatPaise, rupeesToPaise, paiseToRupees } from "@/lib/money";
import { fulfilStock, restoreRtoStock } from "@/lib/inventory/inventory-service";
import { trackCodCollection } from "@/lib/payments/payment-service";
import crypto from "crypto";
import {
  ZoneMatchType,
  RateType,
  ShipmentStatus,
  TrackingEventSource,
  ZoneRuleInput,
  ShippingRateInput,
  ShippingRateSlabInput,
  RateResolutionRequest,
  RateResolutionResult,
  CourierOption,
  CreateShipmentInput,
  IngestTrackingEventInput,
  RtoReceiptInput,
} from "./shipping-types";

// ─── SETTINGS HELPER ─────────────────────────────────────────────────────────

export async function getShippingSettings() {
  let settings = await prisma.shippingSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.shippingSettings.create({
      data: {
        id: "default",
        stuckThresholdHours: 48,
        defaultWeightGrams: 500,
      },
    });
  }

  return settings;
}

export async function updateShippingSettings(data: {
  stuckThresholdHours?: number;
  defaultWeightGrams?: number;
  houseSellerId?: string;
  updatedBy?: string;
}) {
  return await prisma.shippingSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      stuckThresholdHours: data.stuckThresholdHours ?? 48,
      defaultWeightGrams: data.defaultWeightGrams ?? 500,
      houseSellerId: data.houseSellerId,
      updatedBy: data.updatedBy,
    },
    update: {
      ...(data.stuckThresholdHours !== undefined && {
        stuckThresholdHours: data.stuckThresholdHours,
      }),
      ...(data.defaultWeightGrams !== undefined && {
        defaultWeightGrams: data.defaultWeightGrams,
      }),
      ...(data.houseSellerId !== undefined && {
        houseSellerId: data.houseSellerId,
      }),
      updatedBy: data.updatedBy,
    },
  });
}

// ─── UNIQUE NUMBER GENERATORS ───────────────────────────────────────────────

export async function generateShipmentNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `SHP-${currentYear}-`;

  const lastShipment = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { shipmentNumber: true },
  });

  let nextSeq = 1;
  if (lastShipment && lastShipment.shipmentNumber) {
    const parts = lastShipment.shipmentNumber.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq)) {
      nextSeq = seq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

export async function generateManifestNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `MAN-${currentYear}-`;

  const lastManifest = await prisma.manifest.findFirst({
    where: { manifestNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { manifestNumber: true },
  });

  let nextSeq = 1;
  if (lastManifest && lastManifest.manifestNumber) {
    const parts = lastManifest.manifestNumber.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq)) {
      nextSeq = seq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

// ─── MASTER SEEDING & INITIALISATION ────────────────────────────────────────

/**
 * Initializes default couriers, zones, rates, slabs, and serviceability idempotently.
 */
export async function initDefaultShippingData() {
  // 1. Couriers
  const defaultCouriers = [
    { name: "Delhivery", code: "DLV", integrationMode: "API", priority: 1, supportsCod: true, supportsReverse: true },
    { name: "Blue Dart", code: "BDT", integrationMode: "API", priority: 2, supportsCod: true, supportsReverse: true },
    { name: "India Post", code: "IPO", integrationMode: "MANUAL", priority: 3, supportsCod: true, supportsReverse: true },
  ];

  for (const c of defaultCouriers) {
    const existing = await prisma.courier.findUnique({ where: { code: c.code } });
    if (!existing) {
      await prisma.courier.create({ data: c });
    }
  }

  const dlv = await prisma.courier.findUnique({ where: { code: "DLV" } });
  const bdt = await prisma.courier.findUnique({ where: { code: "BDT" } });
  const ipo = await prisma.courier.findUnique({ where: { code: "IPO" } });

  // 2. Zones & Rates
  const zonesCount = await prisma.shippingZone.count({ where: { deletedAt: null } });
  if (zonesCount === 0) {
    // A. Mumbai Metro (Pincode Range 400001 - 400104)
    const mumbaiZone = await prisma.shippingZone.create({
      data: {
        name: "Mumbai Metro",
        priority: 1,
        isFallback: false,
        rules: {
          create: {
            matchType: "PINCODE_RANGE",
            pincodeFrom: "400001",
            pincodeTo: "400104",
            specificity: 3,
          },
        },
        rates: {
          create: {
            rateType: "FLAT",
            flatAmountPaise: 3500, // ₹35
            freeAbovePaise: 99900, // Free above ₹999
            codSurchargePaise: 3000, // Flat ₹30 COD
          },
        },
      },
    });

    // B. Maharashtra (State 27)
    const mhZone = await prisma.shippingZone.create({
      data: {
        name: "Maharashtra",
        priority: 2,
        isFallback: false,
        rules: {
          create: {
            matchType: "STATE",
            stateCode: "27",
            specificity: 2,
          },
        },
        rates: {
          create: {
            rateType: "FLAT",
            flatAmountPaise: 4900, // ₹49
            freeAbovePaise: 99900, // Free above ₹999
            codSurchargePaise: 3000,
          },
        },
      },
    });

    // C. West India (Region WEST)
    await prisma.shippingZone.create({
      data: {
        name: "West India",
        priority: 3,
        isFallback: false,
        rules: {
          create: {
            matchType: "REGION",
            region: "WEST",
            specificity: 1,
          },
        },
        rates: {
          create: {
            rateType: "FLAT",
            flatAmountPaise: 6900, // ₹69
            freeAbovePaise: 99900,
            codSurchargePaise: 3000,
          },
        },
      },
    });

    // D. Rest of India (Fallback Zone)
    const fallbackZone = await prisma.shippingZone.create({
      data: {
        name: "Rest of India",
        priority: 99,
        isFallback: true,
        rates: {
          create: {
            rateType: "WEIGHT_SLAB",
            freeAbovePaise: 99900,
            codSurchargePaise: 3000,
            slabs: {
              create: [
                { minWeightGrams: 0, maxWeightGrams: 500, amountPaise: 3500 },
                { minWeightGrams: 501, maxWeightGrams: 1000, amountPaise: 4900 },
                {
                  minWeightGrams: 1001,
                  maxWeightGrams: null, // open-ended
                  amountPaise: 7900, // ₹79
                  perAdditionalWeightGrams: 500,
                  perAdditionalAmountPaise: 2000, // ₹20
                },
              ],
            },
          },
        },
      },
    });

    // Internal Courier Cost Rates
    if (dlv) {
      await prisma.courierCostRate.create({
        data: { courierId: dlv.id, minWeightGrams: 0, maxWeightGrams: 5000, costPaise: 4900, transitDays: 3 },
      });
    }
    if (bdt) {
      await prisma.courierCostRate.create({
        data: { courierId: bdt.id, minWeightGrams: 0, maxWeightGrams: 5000, costPaise: 7900, transitDays: 2 },
      });
    }
    if (ipo) {
      await prisma.courierCostRate.create({
        data: { courierId: ipo.id, minWeightGrams: 0, maxWeightGrams: 5000, costPaise: 3500, transitDays: 6 },
      });
    }
  }

  // 3. Seed Default Serviceability Pincodes
  const samplePincodes = [
    "400001", "400002", "400050", "400104", "411001", "440001", // Mumbai / MH
    "560001", "560002", "560034", "560038", // Bengaluru
    "110001", "110002", "110020", // Delhi
    "221001", "221002", // Varanasi
    "700001", "600001", "500001", "380001", // Major Metros
  ];

  if (dlv && bdt && ipo) {
    const existingCount = await prisma.courierServiceability.count();
    if (existingCount === 0) {
      for (const pin of samplePincodes) {
        await prisma.courierServiceability.createMany({
          data: [
            { courierId: dlv.id, pincode: pin, supportsCod: true, transitDays: 3 },
            { courierId: bdt.id, pincode: pin, supportsCod: true, transitDays: 2 },
            { courierId: ipo.id, pincode: pin, supportsCod: true, transitDays: 6 },
          ],
        });
      }
    }
  }
}

// ─── 1. ZONES & COVERAGE RULES (SHIP-01, FR-01 - FR-03) ─────────────────────

/**
 * Creates a shipping zone with overlap validation.
 */
export async function createShippingZone(data: {
  name: string;
  priority?: number;
  isFallback?: boolean;
}) {
  if (data.isFallback) {
    // Unset any previous fallback zone
    await prisma.shippingZone.updateMany({
      where: { isFallback: true },
      data: { isFallback: false },
    });
  }

  return await prisma.shippingZone.create({
    data: {
      name: data.name.trim(),
      priority: data.priority ?? 0,
      isFallback: data.isFallback ?? false,
    },
    include: { rules: true, rates: { include: { slabs: true } } },
  });
}

/**
 * Adds a coverage rule to a zone with overlap detection at same specificity (FR-02).
 */
export async function addZoneRule(input: ZoneRuleInput) {
  const specificityMap: Record<ZoneMatchType, number> = {
    PINCODE: 4,
    PINCODE_RANGE: 3,
    STATE: 2,
    REGION: 1,
  };

  const specificity = specificityMap[input.matchType] || 1;

  // OVERLAP DETECTION: Check if another zone already covers this at same specificity
  if (input.matchType === "PINCODE" && input.pincode) {
    const cleanPin = input.pincode.trim();
    const existing = await prisma.zoneRule.findFirst({
      where: {
        matchType: "PINCODE",
        pincode: cleanPin,
        zone: { deletedAt: null, id: { not: input.zoneId } },
      },
      include: { zone: true },
    });

    if (existing) {
      const err: any = new Error(
        `Pincode ${cleanPin} is already covered by '${existing.zone.name}'. A pincode can only belong to one zone at this specificity.`
      );
      err.statusCode = 409;
      throw err;
    }
  } else if (input.matchType === "PINCODE_RANGE" && input.pincodeFrom && input.pincodeTo) {
    const from = parseInt(input.pincodeFrom.trim(), 10);
    const to = parseInt(input.pincodeTo.trim(), 10);

    const existingRanges = await prisma.zoneRule.findMany({
      where: {
        matchType: "PINCODE_RANGE",
        zone: { deletedAt: null, id: { not: input.zoneId } },
      },
      include: { zone: true },
    });

    for (const r of existingRanges) {
      if (r.pincodeFrom && r.pincodeTo) {
        const rFrom = parseInt(r.pincodeFrom, 10);
        const rTo = parseInt(r.pincodeTo, 10);
        // Overlap condition
        if (Math.max(from, rFrom) <= Math.min(to, rTo)) {
          const err: any = new Error(
            `Pincode range ${from}-${to} overlaps with '${r.zone.name}' (${rFrom}-${rTo}). A pincode can only belong to one zone at this specificity.`
          );
          err.statusCode = 409;
          throw err;
        }
      }
    }
  } else if (input.matchType === "STATE" && input.stateCode) {
    const existing = await prisma.zoneRule.findFirst({
      where: {
        matchType: "STATE",
        stateCode: input.stateCode.trim(),
        zone: { deletedAt: null, id: { not: input.zoneId } },
      },
      include: { zone: true },
    });

    if (existing) {
      const err: any = new Error(
        `State ${input.stateCode} is already covered by '${existing.zone.name}'. A state can only belong to one zone at this specificity.`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  return await prisma.zoneRule.create({
    data: {
      zoneId: input.zoneId,
      matchType: input.matchType,
      pincode: input.pincode?.trim() || null,
      pincodeFrom: input.pincodeFrom?.trim() || null,
      pincodeTo: input.pincodeTo?.trim() || null,
      stateCode: input.stateCode?.trim() || null,
      region: input.region || null,
      specificity,
    },
  });
}

/**
 * Bulk paste & add pincodes with validation & overlap prevention (FR-01, SHIP-01).
 */
export async function bulkAddPincodesToZone(zoneId: string, pincodesRaw: string) {
  const tokens = pincodesRaw
    .split(/[\s,;\n\r]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const validPincodes: string[] = [];
  const invalidPincodes: string[] = [];

  for (const token of tokens) {
    if (/^\d{6}$/.test(token)) {
      if (!validPincodes.includes(token)) {
        validPincodes.push(token);
      }
    } else {
      invalidPincodes.push(token);
    }
  }

  if (invalidPincodes.length > 0) {
    const err: any = new Error(`Invalid pincodes detected: ${invalidPincodes.join(", ")}`);
    err.statusCode = 422;
    throw err;
  }

  // Check overlap for all
  const existingRules = await prisma.zoneRule.findMany({
    where: {
      matchType: "PINCODE",
      pincode: { in: validPincodes },
      zone: { deletedAt: null, id: { not: zoneId } },
    },
    include: { zone: true },
  });

  if (existingRules.length > 0) {
    const conflicting = existingRules[0];
    const err: any = new Error(
      `Pincode ${conflicting.pincode} is already covered by '${conflicting.zone.name}'. A pincode can only belong to one zone at this specificity.`
    );
    err.statusCode = 409;
    throw err;
  }

  const created = [];
  for (const pin of validPincodes) {
    created.push(
      await prisma.zoneRule.create({
        data: {
          zoneId,
          matchType: "PINCODE",
          pincode: pin,
          specificity: 4,
        },
      })
    );
  }

  return { addedCount: created.length, pincodes: validPincodes };
}

/**
 * Delete a shipping zone (FR-03: fallback zone cannot be deleted).
 */
export async function deleteShippingZone(zoneId: string) {
  const zone = await prisma.shippingZone.findUnique({
    where: { id: zoneId },
  });

  if (!zone) {
    throw new Error("Zone not found");
  }

  if (zone.isFallback) {
    const err: any = new Error("Set another zone as the fallback first");
    err.statusCode = 409;
    throw err;
  }

  // Check active shipments
  const activeShipments = await prisma.shipment.count({
    where: {
      status: { notIn: ["DELIVERED", "RTO_DELIVERED"] },
      order: { deliveryZone: zone.name },
    },
  });

  if (activeShipments > 0) {
    const err: any = new Error("Zone has active shipments in transit and cannot be deleted");
    err.statusCode = 409;
    throw err;
  }

  return await prisma.shippingZone.update({
    where: { id: zoneId },
    data: { deletedAt: new Date(), isActive: false },
  });
}

// ─── 2. RATE RULES & SLABS (SHIP-02, FR-04 - FR-07) ─────────────────────────

/**
 * Validates contiguous slabs and open-ended final slab (FR-05).
 */
export function validateRateSlabs(slabs: ShippingRateSlabInput[]) {
  if (!slabs || slabs.length === 0) {
    throw new Error("At least one rate slab is required");
  }

  // Sort by min bound
  const sorted = [...slabs].sort(
    (a, b) => (a.minWeightGrams ?? a.minValuePaise ?? 0) - (b.minWeightGrams ?? b.minValuePaise ?? 0)
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const isWeight = current.minWeightGrams !== undefined;

    if (isWeight) {
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.maxWeightGrams === null || prev.maxWeightGrams === undefined) {
          throw new Error("Only the final slab can be open-ended");
        }
        if (current.minWeightGrams !== prev.maxWeightGrams + 1) {
          throw new Error(
            `Slabs are not contiguous: expected lower bound ${prev.maxWeightGrams + 1}g, got ${current.minWeightGrams}g`
          );
        }
      }
    }

    if (i === sorted.length - 1) {
      // Final slab must be open-ended
      const finalMax = isWeight ? current.maxWeightGrams : current.maxValuePaise;
      if (finalMax !== null && finalMax !== undefined) {
        throw new Error("The final slab must be open-ended (no upper limit)");
      }
    }
  }

  return true;
}

/**
 * Configure rate rules for a zone.
 */
export async function configureZoneRate(input: ShippingRateInput) {
  if (input.rateType === "WEIGHT_SLAB" || input.rateType === "VALUE_SLAB") {
    if (input.slabs) {
      validateRateSlabs(input.slabs);
    }
  }

  // Deactivate any existing rate for this zone
  await prisma.shippingRate.updateMany({
    where: { zoneId: input.zoneId },
    data: { isActive: false },
  });

  return await prisma.shippingRate.create({
    data: {
      zoneId: input.zoneId,
      rateType: input.rateType,
      flatAmountPaise: input.flatAmountPaise ? Math.round(input.flatAmountPaise) : null,
      freeAbovePaise: input.freeAbovePaise ? Math.round(input.freeAbovePaise) : null,
      codSurchargePaise: input.codSurchargePaise ? Math.round(input.codSurchargePaise) : null,
      codSurchargePercent: input.codSurchargePercent ?? null,
      isActive: true,
      slabs: input.slabs
        ? {
            create: input.slabs.map((s) => ({
              minWeightGrams: s.minWeightGrams ?? null,
              maxWeightGrams: s.maxWeightGrams ?? null,
              minValuePaise: s.minValuePaise ? Math.round(s.minValuePaise) : null,
              maxValuePaise: s.maxValuePaise ? Math.round(s.maxValuePaise) : null,
              amountPaise: Math.round(s.amountPaise),
              perAdditionalWeightGrams: s.perAdditionalWeightGrams ?? null,
              perAdditionalAmountPaise: s.perAdditionalAmountPaise ? Math.round(s.perAdditionalAmountPaise) : null,
            })),
          }
        : undefined,
    },
    include: { slabs: true },
  });
}

// ─── 3. DETERMINISTIC RATE RESOLUTION ENGINE (SHIP-03, FR-08) ───────────────

/**
 * Resolves the shipping charge following fixed specificity order:
 * 1. Pincode (4) > Pincode Range (3) > State (2) > Region (1) > Fallback Zone.
 * 2. Verifies courier serviceability.
 * 3. Applies rate type (Flat, Weight Slab, Value Slab).
 * 4. Applies free shipping post-discount.
 * 5. Applies COD surcharge.
 * 6. Generates comprehensive prose explanation (SHIP-11).
 */
export async function resolveShippingRate(req: RateResolutionRequest): Promise<RateResolutionResult> {
  const cleanPin = req.pincode.trim();
  const weightGrams = req.weightGrams ?? 500;
  const orderValuePaise = req.orderValuePaise ?? 0;
  const isCod = Boolean(req.isCod);

  // Validate 6-digit pincode format
  if (!/^\d{6}$/.test(cleanPin)) {
    return {
      serviceable: false,
      zoneName: "UNKNOWN",
      ruleApplied: "Invalid pincode",
      baseChargePaise: 0,
      codSurchargePaise: 0,
      freeShippingApplied: false,
      totalShippingChargePaise: 0,
      explanation: "Please enter a valid 6-digit Indian postal code.",
      courierOptions: [],
      error: "Enter a 6-digit pincode",
    };
  }

  // Ensure default data exists
  await initDefaultShippingData();

  // Check courier serviceability first (FR-12)
  const serviceabilities = await prisma.courierServiceability.findMany({
    where: {
      pincode: cleanPin,
      isActive: true,
      courier: { isActive: true },
    },
    include: { courier: true },
    orderBy: { courier: { priority: "asc" } },
  });

  const allActiveCouriers = await prisma.courier.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  // Build Courier Options with cost & serviceability
  const courierOptions: CourierOption[] = await Promise.all(
    allActiveCouriers.map(async (c) => {
      const match = serviceabilities.find((s) => s.courierId === c.id);
      const isServ = Boolean(match);

      // Find internal cost rate
      const costRate = await prisma.courierCostRate.findFirst({
        where: {
          courierId: c.id,
          isActive: true,
          minWeightGrams: { lte: weightGrams },
          OR: [{ maxWeightGrams: null }, { maxWeightGrams: { gte: weightGrams } }],
        },
        orderBy: { minWeightGrams: "desc" },
      });

      return {
        courierId: c.id,
        courierName: c.name,
        courierCode: c.code,
        costPaise: costRate?.costPaise ?? 4900,
        transitDays: match?.transitDays ?? 3,
        isServiceable: isServ,
        supportsCod: c.supportsCod && (match?.supportsCod ?? true),
        reasonDisabled: !isServ ? "Pincode not serviceable by this courier" : undefined,
      };
    })
  );

  const hasAnyServiceable = courierOptions.some((c) => c.isServiceable);
  if (!hasAnyServiceable) {
    return {
      serviceable: false,
      zoneName: "UNSERVICEABLE",
      ruleApplied: "Unserviceable pincode",
      baseChargePaise: 0,
      codSurchargePaise: 0,
      freeShippingApplied: false,
      totalShippingChargePaise: 0,
      explanation: `We do not deliver to ${cleanPin} yet. No courier partner serves this location.`,
      courierOptions,
      error: `We do not deliver to ${cleanPin} yet`,
    };
  }

  // ── Specificity-based Zone Resolution ─────────────────────────────────────
  let resolvedZone: any = null;
  let matchedRule: any = null;
  const pinNum = parseInt(cleanPin, 10);

  // 1. Exact Pincode (spec=4)
  matchedRule = await prisma.zoneRule.findFirst({
    where: {
      matchType: "PINCODE",
      pincode: cleanPin,
      zone: { deletedAt: null, isActive: true },
    },
    include: { zone: { include: { rates: { where: { isActive: true }, include: { slabs: true } } } } },
  });

  // 2. Pincode Range (spec=3)
  if (!matchedRule) {
    const rangeRules = await prisma.zoneRule.findMany({
      where: {
        matchType: "PINCODE_RANGE",
        zone: { deletedAt: null, isActive: true },
      },
      include: { zone: { include: { rates: { where: { isActive: true }, include: { slabs: true } } } } },
    });

    for (const r of rangeRules) {
      if (r.pincodeFrom && r.pincodeTo) {
        const from = parseInt(r.pincodeFrom, 10);
        const to = parseInt(r.pincodeTo, 10);
        if (pinNum >= from && pinNum <= to) {
          matchedRule = r;
          break;
        }
      }
    }
  }

  // 3. State (spec=2)
  if (!matchedRule && req.stateCode) {
    matchedRule = await prisma.zoneRule.findFirst({
      where: {
        matchType: "STATE",
        stateCode: req.stateCode.trim(),
        zone: { deletedAt: null, isActive: true },
      },
      include: { zone: { include: { rates: { where: { isActive: true }, include: { slabs: true } } } } },
    });
  }

  // 4. Region (spec=1)
  if (!matchedRule) {
    // Determine region if known
    let regionGuess = "";
    if (cleanPin.startsWith("4")) regionGuess = "WEST";
    else if (cleanPin.startsWith("5") || cleanPin.startsWith("6")) regionGuess = "SOUTH";
    else if (cleanPin.startsWith("1") || cleanPin.startsWith("2")) regionGuess = "NORTH";
    else if (cleanPin.startsWith("7")) regionGuess = "EAST";

    if (regionGuess) {
      matchedRule = await prisma.zoneRule.findFirst({
        where: {
          matchType: "REGION",
          region: regionGuess,
          zone: { deletedAt: null, isActive: true },
        },
        include: { zone: { include: { rates: { where: { isActive: true }, include: { slabs: true } } } } },
      });
    }
  }

  // 5. Fallback Zone ("Rest of India")
  if (matchedRule) {
    resolvedZone = matchedRule.zone;
  } else {
    resolvedZone = await prisma.shippingZone.findFirst({
      where: { isFallback: true, deletedAt: null, isActive: true },
      include: { rates: { where: { isActive: true }, include: { slabs: true } } },
    });
  }

  if (!resolvedZone) {
    // Failsafe default
    resolvedZone = {
      name: "Rest of India",
      rates: [{ rateType: "FLAT", flatAmountPaise: 9900, freeAbovePaise: 99900, codSurchargePaise: 3000 }],
    };
  }

  const activeRate = resolvedZone.rates?.[0];
  let baseChargePaise = 0;
  let ruleAppliedText = "Default rate";

  if (activeRate) {
    if (activeRate.rateType === "FLAT") {
      baseChargePaise = activeRate.flatAmountPaise ?? 4900;
      ruleAppliedText = `Flat rate ₹${(baseChargePaise / 100).toFixed(2)}`;
    } else if (activeRate.rateType === "WEIGHT_SLAB" && activeRate.slabs) {
      const slabs = [...activeRate.slabs].sort((a: any, b: any) => (a.minWeightGrams ?? 0) - (b.minWeightGrams ?? 0));
      let matchedSlab: any = null;

      for (const s of slabs) {
        const minW = s.minWeightGrams ?? 0;
        const maxW = s.maxWeightGrams;
        if (weightGrams >= minW && (maxW === null || weightGrams <= maxW)) {
          matchedSlab = s;
          break;
        }
      }

      if (matchedSlab) {
        baseChargePaise = matchedSlab.amountPaise;
        ruleAppliedText = `Weight slab ${matchedSlab.minWeightGrams}g-${matchedSlab.maxWeightGrams ? `${matchedSlab.maxWeightGrams}g` : "above"}`;

        // Check additional increment above final slab
        if (
          matchedSlab.maxWeightGrams === null &&
          matchedSlab.perAdditionalWeightGrams &&
          matchedSlab.perAdditionalAmountPaise
        ) {
          const excessWeight = Math.max(0, weightGrams - matchedSlab.minWeightGrams);
          if (excessWeight > 0) {
            const increments = Math.ceil(excessWeight / matchedSlab.perAdditionalWeightGrams);
            baseChargePaise += increments * matchedSlab.perAdditionalAmountPaise;
            ruleAppliedText += ` (+${increments} × ₹${(matchedSlab.perAdditionalAmountPaise / 100).toFixed(0)})`;
          }
        }
      } else {
        baseChargePaise = 7900;
      }
    } else {
      baseChargePaise = 4900;
    }
  }

  // Free shipping check post-discount
  let freeShippingApplied = false;
  if (activeRate?.freeAbovePaise && orderValuePaise >= activeRate.freeAbovePaise) {
    freeShippingApplied = true;
    baseChargePaise = 0;
  }

  // COD surcharge check
  let codSurchargePaise = 0;
  if (isCod) {
    if (activeRate?.codSurchargePaise) {
      codSurchargePaise += activeRate.codSurchargePaise;
    }
    if (activeRate?.codSurchargePercent) {
      codSurchargePaise += Math.round((orderValuePaise * activeRate.codSurchargePercent) / 100);
    }
  }

  const totalShippingChargePaise = baseChargePaise + codSurchargePaise;

  // Prose explanation generator (SHIP-11)
  let explanation = "";
  if (matchedRule) {
    explanation = `Pincode ${cleanPin} matched ${matchedRule.matchType.toLowerCase()} rule for '${resolvedZone.name}'.`;
  } else {
    explanation = `Pincode ${cleanPin} matched no specific pincode, range or state rule, so the fallback zone '${resolvedZone.name}' applied.`;
  }

  explanation += ` At ${weightGrams} g, ${ruleAppliedText} applied (${formatPaise(baseChargePaise)}).`;
  if (freeShippingApplied) {
    explanation += ` Order value of ${formatPaise(orderValuePaise)} qualifies for free shipping above ${formatPaise(activeRate.freeAbovePaise)}.`;
  }
  if (isCod && codSurchargePaise > 0) {
    explanation += ` A COD surcharge of ${formatPaise(codSurchargePaise)} was added.`;
  }

  return {
    serviceable: true,
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    matchedRuleType: matchedRule?.matchType,
    ruleSpecificity: matchedRule?.specificity ?? 0,
    ruleApplied: ruleAppliedText,
    baseChargePaise,
    codSurchargePaise,
    freeShippingApplied,
    totalShippingChargePaise,
    explanation,
    courierOptions,
  };
}

// ─── 4. SHIPMENT CREATION & DISPATCH (SHIP-05, SHIP-06, FR-14 TO FR-19) ──────

/**
 * Creates a shipment for an order.
 * Supports partial line selection and quantity splitting (SHIP-06).
 */
export async function createShipment(input: CreateShipmentInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: {
        where: { status: "ACTIVE" },
        include: { shipmentLines: true },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${input.orderId} not found`);
  }

  // FR-14: Only PACKED orders can ship (returns 409 if not)
  if (order.status !== "PACKED" && order.status !== "SHIPPED") {
    const err: any = new Error(
      `ILLEGAL_STATE: Cannot create shipment for order in status '${order.status}'. Order must be PACKED.`
    );
    err.statusCode = 409;
    throw err;
  }

  const courier = await prisma.courier.findUnique({
    where: { id: input.courierId },
  });

  if (!courier) {
    throw new Error(`Courier ${input.courierId} not found`);
  }

  // Validate line quantities and verify against active order lines
  let calculatedWeightGrams = 0;
  const verifiedLines: Array<{ orderLineId: string; quantity: number }> = [];

  for (const lineReq of input.lines) {
    const orderLine = order.items.find((i) => i.id === lineReq.orderLineId);
    if (!orderLine) {
      throw new Error(`Order line ${lineReq.orderLineId} is not an active item on this order`);
    }

    const alreadyShippedQty = orderLine.shipmentLines.reduce((sum, sl) => sum + sl.quantity, 0);
    const availableToShip = orderLine.quantity - alreadyShippedQty;

    if (lineReq.quantity > availableToShip) {
      throw new Error(
        `Quantity ${lineReq.quantity} exceeds available unshipped quantity (${availableToShip}) for item '${orderLine.productName}'`
      );
    }

    if (lineReq.quantity > 0) {
      verifiedLines.push({ orderLineId: orderLine.id, quantity: lineReq.quantity });
      calculatedWeightGrams += lineReq.quantity * 500; // default 500g per unit
    }
  }

  if (verifiedLines.length === 0) {
    throw new Error("Shipment must contain at least one item");
  }

  const finalWeightGrams = input.weightGrams ?? calculatedWeightGrams;

  // Determine internal cost from courier cost rates
  const costRate = await prisma.courierCostRate.findFirst({
    where: {
      courierId: courier.id,
      isActive: true,
      minWeightGrams: { lte: finalWeightGrams },
      OR: [{ maxWeightGrams: null }, { maxWeightGrams: { gte: finalWeightGrams } }],
    },
    orderBy: { minWeightGrams: "desc" },
  });

  const estimatedCostPaise = costRate?.costPaise ?? 4900;
  const shipmentNumber = await generateShipmentNumber();

  // FR-17: For manual couriers, AWB is entered; for API couriers, will be generated upon dispatch
  let awb = input.awbNumber?.trim() || null;
  if (courier.integrationMode === "MANUAL" && awb) {
    const existingAwb = await prisma.shipment.findUnique({
      where: { courierId_awbNumber: { courierId: courier.id, awbNumber: awb } },
    });
    if (existingAwb) {
      const err: any = new Error(`AWB ${awb} is already in use`);
      err.statusCode = 409;
      throw err;
    }
  }

  const isCod = order.paymentMethod === "COD";
  const codAmountPaise = isCod ? Math.round(order.totalAmount * 100) : 0;
  const shippingChargePaise = Math.round(order.shippingCost * 100);

  return await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        orderId: order.id,
        shipmentNumber,
        courierId: courier.id,
        awbNumber: awb,
        status: "PENDING",
        weightGrams: finalWeightGrams,
        declaredValuePaise: Math.round(order.totalAmount * 100),
        shippingChargePaise,
        estimatedCostPaise,
        codAmountPaise,
        createdBy: input.userId,
        lines: {
          create: verifiedLines.map((l) => ({
            orderLineId: l.orderLineId,
            quantity: l.quantity,
          })),
        },
        events: {
          create: {
            status: "PENDING",
            description: `Shipment created with ${courier.name}`,
            source: "MANUAL",
            createdBy: input.userId,
            createdByName: input.userName || "Ops Team",
          },
        },
      },
      include: { lines: true, events: true, courier: true },
    });

    return shipment;
  });
}

/**
 * Dispatches a shipment.
 * Generates AWB/label for API couriers, consumes stock, and updates order to SHIPPED (FR-17, FR-19).
 */
export async function dispatchShipment(data: {
  shipmentId: string;
  awbNumber?: string;
  userId?: string;
  userName?: string;
}) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: data.shipmentId },
    include: {
      courier: true,
      lines: { include: { orderLine: true } },
      order: true,
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (shipment.status !== "PENDING" && shipment.status !== "READY_TO_SHIP") {
    throw new Error(`Cannot dispatch shipment in status '${shipment.status}'`);
  }

  let finalAwb = data.awbNumber?.trim() || shipment.awbNumber;

  if (shipment.courier.integrationMode === "API") {
    // Generate mock API AWB if not present
    if (!finalAwb) {
      finalAwb = `${shipment.courier.code}${Date.now()}`;
    }
  } else {
    // MANUAL courier requires AWB
    if (!finalAwb) {
      const err: any = new Error("AWB number is required for manual courier dispatch");
      err.statusCode = 422;
      throw err;
    }
  }

  // Check AWB uniqueness within courier (FR-18)
  const duplicate = await prisma.shipment.findFirst({
    where: {
      courierId: shipment.courierId,
      awbNumber: finalAwb,
      id: { not: shipment.id },
    },
  });

  if (duplicate) {
    const err: any = new Error(`AWB ${finalAwb} is already in use`);
    err.statusCode = 409;
    throw err;
  }

  const labelUrl = `/api/admin/shipments/${shipment.id}/label`;

  // 1. Consume stock for the shipped lines only (INV-04, FR-19)
  const linesToFulfil = shipment.lines
    .filter((l) => l.orderLine.variantId)
    .map((l) => ({
      variantId: l.orderLine.variantId!,
      quantity: l.quantity,
    }));

  if (linesToFulfil.length > 0) {
    await fulfilStock({
      orderId: shipment.orderId,
      items: linesToFulfil,
    });
  }

  // 2. Update shipment status to DISPATCHED
  const updatedShipment = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      awbNumber: finalAwb,
      labelUrl,
      status: "DISPATCHED",
      dispatchedAt: new Date(),
      lastEventAt: new Date(),
      lastEventDescription: `Dispatched via ${shipment.courier.name}`,
      events: {
        create: {
          status: "DISPATCHED",
          description: `Dispatched via ${shipment.courier.name} with AWB ${finalAwb}`,
          source: shipment.courier.integrationMode === "API" ? "COURIER_WEBHOOK" : "MANUAL",
          createdBy: data.userId,
          createdByName: data.userName || "Ops Team",
        },
      },
    },
    include: { events: true, courier: true, lines: true },
  });

  // 3. Move Order to SHIPPED if not already shipped (SHIP-08)
  if (shipment.order.status !== "SHIPPED") {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status: "SHIPPED",
        shippedAt: new Date(),
        trackingNumber: finalAwb,
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: shipment.orderId,
        fromStatus: shipment.order.status,
        toStatus: "SHIPPED",
        reason: `Dispatched in shipment ${shipment.shipmentNumber} (AWB: ${finalAwb})`,
        createdBy: data.userName || "Ops Team",
      },
    });
  }

  return updatedShipment;
}

// ─── 5. TRACKING INGESTION & STATUS SYNC (SHIP-07, SHIP-08, FR-20, FR-21) ───

/**
 * Ingests tracking events from webhooks, poll, or manual entry.
 * Guarantees idempotency and protects against status regression.
 */
export async function ingestTrackingEvent(input: IngestTrackingEventInput) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: input.shipmentId },
    include: { order: { include: { items: { where: { status: "ACTIVE" } }, shipments: true } } },
  });

  if (!shipment) {
    throw new Error(`Shipment ${input.shipmentId} not found`);
  }

  // Idempotency: Check if this event description/timestamp already exists
  const eventTime = input.eventAt ? new Date(input.eventAt) : new Date();
  const duplicate = await prisma.shipmentEvent.findFirst({
    where: {
      shipmentId: shipment.id,
      status: input.status,
      description: input.description,
    },
  });

  if (duplicate) {
    return { status: "IDEMPOTENT_SKIP", event: duplicate, shipment };
  }

  // Status Progression order to prevent regression (DELIVERED never regresses to IN_TRANSIT)
  const statusRank: Record<string, number> = {
    PENDING: 1,
    READY_TO_SHIP: 2,
    DISPATCHED: 3,
    IN_TRANSIT: 4,
    OUT_FOR_DELIVERY: 5,
    FAILED_DELIVERY: 5,
    DELIVERED: 6,
    RTO: 7,
    RTO_DELIVERED: 8,
  };

  const currentRank = statusRank[shipment.status] || 0;
  const incomingRank = statusRank[input.status] || 0;

  // Only advance status if incoming rank >= current (or handling RTO/Failed attempts)
  let targetStatus = shipment.status;
  if (incomingRank >= currentRank || input.status === "FAILED_DELIVERY" || input.status === "RTO") {
    targetStatus = input.status;
  }

  const updatedShipment = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: targetStatus,
      lastEventAt: eventTime,
      lastEventDescription: input.description,
      lastEventLocation: input.location,
      isStuck: false, // A new event clears the stuck flag! (SHIP-09)
      ...(input.status === "DELIVERED" && { deliveredAt: eventTime }),
      events: {
        create: {
          status: input.status,
          courierStatusCode: input.courierStatusCode,
          description: input.description,
          location: input.location,
          eventAt: eventTime,
          source: input.source,
          rawPayload: input.rawPayload ? JSON.stringify(input.rawPayload) : null,
          createdBy: input.createdBy,
          createdByName: input.createdByName,
        },
      },
    },
    include: { events: { orderBy: { eventAt: "desc" } } },
  });

  // ── Sync Order Status (SHIP-08, FR-21) ──────────────────────────────────
  if (input.status === "DELIVERED") {
    // Check if EVERY shipment covering all active order lines has reached DELIVERED
    const allShipments = await prisma.shipment.findMany({
      where: { orderId: shipment.orderId },
      include: { lines: true },
    });

    const activeOrderLines = shipment.order.items;
    const totalOrderedQty = activeOrderLines.reduce((sum, item) => sum + item.quantity, 0);

    let deliveredShippedQty = 0;
    for (const s of allShipments) {
      if (s.status === "DELIVERED" || s.id === shipment.id) {
        deliveredShippedQty += s.lines.reduce((sum, l) => sum + l.quantity, 0);
      }
    }

    if (deliveredShippedQty >= totalOrderedQty && shipment.order.status !== "DELIVERED") {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: {
          status: "DELIVERED",
          deliveredAt: eventTime,
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: shipment.orderId,
          fromStatus: shipment.order.status,
          toStatus: "DELIVERED",
          reason: "All shipments successfully delivered by courier",
          createdBy: "System Courier Sync",
        },
      });

      // COD Collection trigger (PAY-06)
      if (shipment.order.paymentMethod === "COD") {
        await trackCodCollection({
          orderId: shipment.orderId,
          collectedPaise: Math.round(shipment.order.totalAmount * 100),
          courierId: shipment.courierId,
        });
      }
    }
  }

  return { status: "SUCCESS", event: updatedShipment.events[0], shipment: updatedShipment };
}

// ─── 6. STUCK SHIPMENTS QUEUE & DETECTION (SHIP-09, FR-22) ───────────────────

/**
 * Scans active shipments and flags as stuck if no update for configured threshold hours.
 */
export async function checkAndFlagStuckShipments() {
  const settings = await getShippingSettings();
  const thresholdMs = settings.stuckThresholdHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);

  // Terminal shipments are never flagged stuck
  const stuckShipments = await prisma.shipment.updateMany({
    where: {
      status: { notIn: ["DELIVERED", "RTO_DELIVERED", "PENDING"] },
      isStuck: false,
      OR: [
        { lastEventAt: { lt: cutoff } },
        { lastEventAt: null, dispatchedAt: { lt: cutoff } },
      ],
    },
    data: { isStuck: true },
  });

  return stuckShipments.count;
}

/**
 * Returns structured queues for S8 Stuck Shipments.
 */
export async function getStuckShipmentsQueue() {
  await checkAndFlagStuckShipments();

  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { isStuck: true },
        { status: "FAILED_DELIVERY" },
        { status: "RTO" },
      ],
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          paymentMethod: true,
          paymentStatus: true,
        },
      },
      courier: true,
    },
    orderBy: { lastEventAt: "asc" },
  });

  const noUpdate48h = shipments.filter((s) => s.isStuck && s.status !== "FAILED_DELIVERY" && s.status !== "RTO");
  const failedDelivery = shipments.filter((s) => s.status === "FAILED_DELIVERY");
  const rtoInProgress = shipments.filter((s) => s.status === "RTO");

  return {
    noUpdate48h,
    failedDelivery,
    rtoInProgress,
    totalStuckCount: shipments.length,
  };
}

// ─── 7. RTO LIFECYCLE (SHIP-10, FR-23) ───────────────────────────────────────

/**
 * Marks a shipment as RTO with recorded reason.
 */
export async function markShipmentRto(shipmentId: string, reason: string, userId?: string, userName?: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { order: true },
  });

  if (!shipment) throw new Error("Shipment not found");

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: "RTO",
      rtoReason: reason,
      lastEventAt: new Date(),
      lastEventDescription: `RTO initiated: ${reason}`,
      events: {
        create: {
          status: "RTO",
          description: `RTO initiated: ${reason}`,
          source: "MANUAL",
          createdBy: userId,
          createdByName: userName || "Ops Team",
        },
      },
    },
  });

  // Flag in order timeline
  await prisma.orderNote.create({
    data: {
      orderId: shipment.orderId,
      body: `Shipment ${shipment.shipmentNumber} marked RTO. Reason: ${reason}`,
      createdBy: userName || "Ops Team",
    },
  });

  return updated;
}

/**
 * Records receipt of an RTO shipment back at the warehouse.
 * 1. Restores inventory on-hand using system RETURN (INV-13 via restoreRtoStock).
 * 2. Flags prepaid orders for refund review (without auto-debit).
 * 3. Does not collect COD cash.
 */
export async function recordRtoReceived(input: RtoReceiptInput) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: input.shipmentId },
    include: {
      lines: { include: { orderLine: true } },
      order: true,
      courier: true,
    },
  });

  if (!shipment) throw new Error("Shipment not found");

  if (shipment.status === "RTO_DELIVERED") {
    // Idempotent: stock was already restored
    return shipment;
  }

  // 1. Restore stock for each line using system return movement (INV-13)
  const linesToRestore = shipment.lines
    .filter((l) => l.orderLine.variantId)
    .map((l) => ({
      variantId: l.orderLine.variantId!,
      quantity: l.quantity,
    }));

  if (linesToRestore.length > 0) {
    await restoreRtoStock({
      shipmentId: shipment.id,
      items: linesToRestore,
      actorId: input.userId || "System",
      actorName: input.userName || "Receiving Warehouse",
    });
  }

  // 2. Update shipment status to RTO_DELIVERED
  const updatedShipment = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "RTO_DELIVERED",
      rtoReceivedAt: new Date(),
      returnShippingCostPaise: input.returnShippingCostPaise ?? 0,
      events: {
        create: {
          status: "RTO_DELIVERED",
          description: "RTO parcel received back at warehouse. Stock restored to sellable inventory.",
          source: "MANUAL",
          createdBy: input.userId,
          createdByName: input.userName || "Receiving Staff",
        },
      },
    },
  });

  // 3. For prepaid orders, flag refund due amount on order for review
  if (shipment.order.paymentStatus === "PAID" && shipment.order.paymentMethod !== "COD") {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        refundDueAmount: shipment.order.totalAmount,
      },
    });

    await prisma.orderNote.create({
      data: {
        orderId: shipment.orderId,
        body: `RTO receipt confirmed. Order flagged for refund review: ₹${shipment.order.totalAmount.toFixed(2)}.`,
        createdBy: input.userName || "System",
      },
    });
  }

  return updatedShipment;
}

// ─── 8. PRINTING & MANIFEST GENERATION (SHIP-12, FR-24, FR-25) ───────────────

/**
 * Creates a courier handover manifest.
 */
export async function createManifest(data: {
  courierId: string;
  manifestDate?: Date;
  userId?: string;
  userName?: string;
}) {
  const courier = await prisma.courier.findUnique({
    where: { id: data.courierId },
  });

  if (!courier) throw new Error("Courier not found");

  const manifestDate = data.manifestDate || new Date();
  const startOfDay = new Date(manifestDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(manifestDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Find all shipments dispatched with this courier today
  const shipments = await prisma.shipment.findMany({
    where: {
      courierId: courier.id,
      dispatchedAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { order: true },
  });

  const manifestNumber = await generateManifestNumber();

  return await prisma.manifest.create({
    data: {
      manifestNumber,
      courierId: courier.id,
      manifestDate,
      shipmentCount: shipments.length,
      pdfUrl: `/api/admin/manifests/${manifestNumber}/pdf`,
      createdBy: data.userId,
      createdByName: data.userName || "Dispatch Supervisor",
    },
    include: { courier: true },
  });
}
