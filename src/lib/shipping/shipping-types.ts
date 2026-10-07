// ─── EPIC-07: SHIPPING & LOGISTICS (SHIP) TYPES & ENUMS ──────────────────────

export type ZoneMatchType = "PINCODE" | "PINCODE_RANGE" | "STATE" | "REGION";

export type RateType = "FLAT" | "WEIGHT_SLAB" | "VALUE_SLAB" | "FREE_ABOVE";

export type CourierMode = "API" | "MANUAL";

export type ShipmentStatus =
  | "PENDING"
  | "READY_TO_SHIP"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_DELIVERY"
  | "RTO"
  | "RTO_DELIVERED";

export type TrackingEventSource = "COURIER_WEBHOOK" | "COURIER_POLL" | "MANUAL";

export interface ZoneRuleInput {
  zoneId: string;
  matchType: ZoneMatchType;
  pincode?: string;
  pincodeFrom?: string;
  pincodeTo?: string;
  stateCode?: string;
  region?: "NORTH" | "SOUTH" | "EAST" | "WEST" | "NORTH_EAST" | "CENTRAL";
}

export interface ShippingRateSlabInput {
  minWeightGrams?: number;
  maxWeightGrams?: number | null;
  minValuePaise?: number;
  maxValuePaise?: number | null;
  amountPaise: number;
  perAdditionalWeightGrams?: number | null;
  perAdditionalAmountPaise?: number | null;
}

export interface ShippingRateInput {
  zoneId: string;
  rateType: RateType;
  flatAmountPaise?: number | null;
  freeAbovePaise?: number | null;
  codSurchargePaise?: number | null;
  codSurchargePercent?: number | null;
  slabs?: ShippingRateSlabInput[];
}

export interface RateResolutionRequest {
  pincode: string;
  weightGrams?: number;
  orderValuePaise?: number; // In integer paise
  isCod?: boolean;
  stateCode?: string;
}

export interface CourierOption {
  courierId: string;
  courierName: string;
  courierCode: string;
  costPaise: number; // Our internal cost
  transitDays: number;
  isServiceable: boolean;
  supportsCod: boolean;
  reasonDisabled?: string;
}

export interface RateResolutionResult {
  serviceable: boolean;
  zoneId?: string;
  zoneName: string;
  matchedRuleType?: ZoneMatchType;
  ruleSpecificity?: number;
  ruleApplied: string;
  baseChargePaise: number;
  codSurchargePaise: number;
  freeShippingApplied: boolean;
  totalShippingChargePaise: number;
  explanation: string;
  courierOptions: CourierOption[];
  error?: string;
}

export interface CreateShipmentInput {
  orderId: string;
  courierId: string;
  lines: Array<{
    orderLineId: string;
    quantity: number;
  }>;
  weightGrams?: number;
  awbNumber?: string; // Required for manual couriers
  userId?: string;
  userName?: string;
}

export interface IngestTrackingEventInput {
  shipmentId: string;
  status: ShipmentStatus;
  courierStatusCode?: string;
  description: string;
  location?: string;
  eventAt?: Date | string;
  source: TrackingEventSource;
  rawPayload?: any;
  createdBy?: string;
  createdByName?: string;
}

export interface RtoReceiptInput {
  shipmentId: string;
  rtoReason?: string;
  returnShippingCostPaise?: number;
  userId?: string;
  userName?: string;
}
