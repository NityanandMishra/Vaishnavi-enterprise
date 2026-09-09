const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // 1. Clean existing records (in reverse dependency order)
  await prisma.categoryHsnMapping.deleteMany();
  await prisma.taxSettings.deleteMany();
  await prisma.hsnPriceSlab.deleteMany();
  await prisma.hsnRateVersion.deleteMany();
  await prisma.hsnCode.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.variantAttributeValue.deleteMany();
  await prisma.productAttributeValue.deleteMany();
  await prisma.categoryAttribute.deleteMany();
  await prisma.attributeValue.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.mediaImage.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database cleaned.");

  // ─── WARNING: DO NOT USE THESE IN PRODUCTION/STAGING ────────────────────────
  // Default development credentials. In production/staging environments, set the
  // SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD environment variables.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || "customer123";

  // 2. Seed Admin User
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@vaishnavi.com",
      phone: "9999999999",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      name: "Admin Operator",
      phoneVerified: true,
    },
  });
  console.log(`Seeded Admin User: ${admin.email}`);

  // Seed Customer User
  const customerPasswordHash = await bcrypt.hash(customerPassword, 10);
  const customer = await prisma.user.create({
    data: {
      email: "customer@gmail.com",
      phone: "7388847575",
      passwordHash: customerPasswordHash,
      role: "CUSTOMER",
      name: "Rajesh Kumar",
      phoneVerified: true,
      addresses: {
        create: {
          fullName: "Rajesh Kumar",
          addressLine1: "Station Road, Suriyawan",
          addressLine2: "Near Railway Crossing",
          landmark: "In front of Hanuman Temple",
          city: "Bhadohi",
          state: "Uttar Pradesh",
          pincode: "221404",
          isDefault: true,
        }
      }
    },
  });
  console.log(`Seeded Customer User: ${customer.email}`);

  // 3. Seed Media Images (Placeholders using public mock imagery)
  const imageInverter = await prisma.mediaImage.create({
    data: { url: "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=600&auto=format&fit=crop", filename: "solar_inverter.jpg", size: 94300, width: 600, height: 400, alt: "Smart Solar Inverter System" }
  });
  const imageScooty = await prisma.mediaImage.create({
    data: { url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop", filename: "e_scooty.jpg", size: 104200, width: 600, height: 400, alt: "ZOE EcoRide Pro Smart Electric Scooty" }
  });
  const imageFan = await prisma.mediaImage.create({
    data: { url: "https://images.unsplash.com/photo-1618944847023-38aa001235f0?w=600&auto=format&fit=crop", filename: "bldc_fan.jpg", size: 45000, width: 600, height: 400, alt: "Orient Smart Ceiling Fan" }
  });
  const imageWire = await prisma.mediaImage.create({
    data: { url: "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop", filename: "copper_wire.jpg", size: 52000, width: 600, height: 400, alt: "Finolex House Wires" }
  });
  const imageLED = await prisma.mediaImage.create({
    data: { url: "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600&auto=format&fit=crop", filename: "syska_led.jpg", size: 48000, width: 600, height: 400, alt: "Syska Smart LED Bulb" }
  });

  console.log("Seeded Media Images.");

  // 4. Seed Brands
  const brandMicrotek = await prisma.brand.create({ data: { name: "Microtek", slug: "microtek", description: "Inverters, UPS and Solar equipment" } });
  const brandOrient = await prisma.brand.create({ data: { name: "Orient Electric", slug: "orient-electric", description: "Home appliances and premium fans" } });
  const brandZOE = await prisma.brand.create({ data: { name: "ZOE Motors", slug: "zoe-motors", description: "Smart electric mobility vehicles" } });
  const brandFinolex = await prisma.brand.create({ data: { name: "Finolex Cables", slug: "finolex-cables", description: "Premium electrical wires and cables" } });
  const brandSyska = await prisma.brand.create({ data: { name: "Syska LED", slug: "syska-led", description: "Energy-efficient LED lighting systems" } });

  console.log("Seeded Brands.");

  // 5. Seed the 9 Confirmed Categories
  const catElectricalFittings = await prisma.category.create({
    data: { name: "Electrical Fittings", slug: "electrical-fittings", description: "Modular switches, distribution boards, sockets, and conduits", defaultCheckoutMode: "BUY", sortOrder: 1 }
  });
  const catElectricalWires = await prisma.category.create({
    data: { name: "Electrical Wires", slug: "electrical-wires", description: "FR/FRLS insulated copper house wires and cables", defaultCheckoutMode: "BUY", sortOrder: 2 }
  });
  const catFans = await prisma.category.create({
    data: { name: "Fans", slug: "fans", description: "BLDC energy-efficient ceiling, wall, and exhaust fans", defaultCheckoutMode: "BUY", sortOrder: 3 }
  });
  const catLEDLighting = await prisma.category.create({
    data: { name: "LED Lighting", slug: "led-lighting", description: "LED bulbs, battens, panels, and decorative lighting", defaultCheckoutMode: "BUY", sortOrder: 4 }
  });
  const catHomeAppliances = await prisma.category.create({
    data: { name: "Home Appliances", slug: "home-appliances", description: "Geysers, coolers, irons, and small home utilities", defaultCheckoutMode: "BUY", sortOrder: 5 }
  });
  const catUPSSystems = await prisma.category.create({
    data: { name: "UPS Systems", slug: "ups-systems", description: "Power backup inverters, batteries, and offline UPS systems", defaultCheckoutMode: "BUY", sortOrder: 6 }
  });
  const catElectricVehicles = await prisma.category.create({
    data: { name: "Electric Vehicles", slug: "electric-vehicles", description: "Smart electric scooties, e-rickshaws, and e-cycles", defaultCheckoutMode: "INQUIRE", sortOrder: 7 }
  });
  const catEVBatteries = await prisma.category.create({
    data: { name: "EV Batteries & Chargers", slug: "ev-batteries-chargers", description: "High-performance Lithium-ion and Lead-acid EV batteries", defaultCheckoutMode: "INQUIRE", sortOrder: 8 }
  });
  const catEVAccessories = await prisma.category.create({
    data: { name: "EV Accessories", slug: "ev-accessories", description: "EV helmets, protective guards, smart chargers, and covers", defaultCheckoutMode: "BUY", sortOrder: 9 }
  });

  console.log("Seeded Confirmed Categories.");

  // 5b. Seed Attributes & Attribute Values (EPIC-01: ATTR)
  const attrColour = await prisma.attribute.create({
    data: {
      name: "Colour",
      code: "colour",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      usesSwatches: true,
      description: "Outer finish or shade for appliances, fans, and wiring insulation",
      values: {
        create: [
          { label: "Smoked Brown", code: "smoked_brown", swatchHex: "#5C4033", displayOrder: 1 },
          { label: "Pearl White", code: "pearl_white", swatchHex: "#F8F9FA", displayOrder: 2 },
          { label: "Matte Black", code: "matte_black", swatchHex: "#1A1A1A", displayOrder: 3 },
          { label: "Midnight Blue", code: "midnight_blue", swatchHex: "#191970", displayOrder: 4 },
          { label: "Cherry Red", code: "cherry_red", swatchHex: "#C2185B", displayOrder: 5 },
        ],
      },
    },
  });

  const attrSweep = await prisma.attribute.create({
    data: {
      name: "Blade Sweep",
      code: "blade_sweep",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      usesSwatches: false,
      description: "Blade diameter span for ceiling and exhaust fans",
      values: {
        create: [
          { label: "900 mm", code: "900mm", displayOrder: 1 },
          { label: "1200 mm", code: "1200mm", displayOrder: 2 },
          { label: "1400 mm", code: "1400mm", displayOrder: 3 },
        ],
      },
    },
  });

  const attrWireGauge = await prisma.attribute.create({
    data: {
      name: "Wire Gauge",
      code: "wire_gauge",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      usesSwatches: false,
      description: "Cross-sectional conductor thickness in sq mm",
      values: {
        create: [
          { label: "1.0 sq mm", code: "1_0_sqmm", displayOrder: 1 },
          { label: "1.5 sq mm", code: "1_5_sqmm", displayOrder: 2 },
          { label: "2.5 sq mm", code: "2_5_sqmm", displayOrder: 3 },
          { label: "4.0 sq mm", code: "4_0_sqmm", displayOrder: 4 },
        ],
      },
    },
  });

  const attrCapacity = await prisma.attribute.create({
    data: {
      name: "Power Capacity",
      code: "power_capacity",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      usesSwatches: false,
      description: "Rated peak power output in kVA or kW",
      values: {
        create: [
          { label: "1 kVA", code: "1kva", displayOrder: 1 },
          { label: "3 kVA", code: "3kva", displayOrder: 2 },
          { label: "5 kVA", code: "5kva", displayOrder: 3 },
          { label: "10 kVA", code: "10kva", displayOrder: 4 },
        ],
      },
    },
  });

  const attrWattage = await prisma.attribute.create({
    data: {
      name: "Rated Wattage",
      code: "rated_wattage",
      inputType: "NUMBER",
      isVariantDefining: false,
      description: "Power consumption in Watts",
    },
  });

  // Attach attributes to categories
  // Fans: Colour (Req), Blade Sweep (Req), Rated Wattage (Opt)
  await prisma.categoryAttribute.createMany({
    data: [
      { categoryId: catFans.id, attributeId: attrColour.id, isRequired: true, displayOrder: 1 },
      { categoryId: catFans.id, attributeId: attrSweep.id, isRequired: true, displayOrder: 2 },
      { categoryId: catFans.id, attributeId: attrWattage.id, isRequired: false, displayOrder: 3 },
    ],
  });

  // Electrical Wires: Wire Gauge (Req), Colour (Req)
  await prisma.categoryAttribute.createMany({
    data: [
      { categoryId: catElectricalWires.id, attributeId: attrWireGauge.id, isRequired: true, displayOrder: 1 },
      { categoryId: catElectricalWires.id, attributeId: attrColour.id, isRequired: true, displayOrder: 2 },
    ],
  });

  // UPS Systems: Power Capacity (Req)
  await prisma.categoryAttribute.createMany({
    data: [
      { categoryId: catUPSSystems.id, attributeId: attrCapacity.id, isRequired: true, displayOrder: 1 },
    ],
  });

  console.log("Seeded Attributes, Values, and Category Linkages.");

  // 5c. Seed Units of Measure (FR-03: 12 Default Units)
  const defaultUnits = [
    { name: "Piece", symbol: "pcs", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
    { name: "Set", symbol: "set", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
    { name: "Pair", symbol: "pr", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
    { name: "Kilogram", symbol: "kg", unitType: "WEIGHT", decimalPrecision: 3, isSystem: true },
    { name: "Gram", symbol: "g", unitType: "WEIGHT", decimalPrecision: 2, isSystem: true },
    { name: "Litre", symbol: "l", unitType: "VOLUME", decimalPrecision: 2, isSystem: true },
    { name: "Millilitre", symbol: "ml", unitType: "VOLUME", decimalPrecision: 0, isSystem: true },
    { name: "Metre", symbol: "m", unitType: "LENGTH", decimalPrecision: 2, isSystem: true },
    { name: "Centimetre", symbol: "cm", unitType: "LENGTH", decimalPrecision: 1, isSystem: true },
    { name: "Box", symbol: "box", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
    { name: "Dozen", symbol: "dz", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
    { name: "Packet", symbol: "pkt", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  ];

  const seededUnits = {};
  for (const u of defaultUnits) {
    const created = await prisma.unit.create({ data: u });
    seededUnits[u.name] = created;
  }
  console.log("Seeded 12 Default Units of Measure.");

  // 5d. Seed HSN Codes & GST Rates
  const hsn8504 = await prisma.hsnCode.create({
    data: {
      code: "8504",
      description: "Electrical transformers, static converters (e.g. inverters) and inductors",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8414 = await prisma.hsnCode.create({
    data: {
      code: "8414",
      description: "Electric fans, ventilating hoods and air extraction equipment",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8711 = await prisma.hsnCode.create({
    data: {
      code: "8711",
      description: "Motorcycles, scooters and other electric two-wheelers",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 5.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8544 = await prisma.hsnCode.create({
    data: {
      code: "8544",
      description: "Insulated wire, cables, and optical fibre cables",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn9405 = await prisma.hsnCode.create({
    data: {
      code: "9405",
      description: "Luminaires and lighting fittings, LED lamps and light sources",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8536 = await prisma.hsnCode.create({
    data: {
      code: "8536",
      description: "Electrical apparatus for switching or protecting electrical circuits (switches, sockets)",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8516 = await prisma.hsnCode.create({
    data: {
      code: "8516",
      description: "Electric instantaneous or storage water heaters and space heating apparatus",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8507 = await prisma.hsnCode.create({
    data: {
      code: "8507",
      description: "Electric accumulators, including separators therefor; lithium-ion batteries",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8714 = await prisma.hsnCode.create({
    data: {
      code: "8714",
      description: "Parts and accessories of vehicles of headings 8711 to 8713",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  const hsn8517 = await prisma.hsnCode.create({
    data: {
      code: "8517",
      description: "Telephones, mobiles and apparatus for transmission or reception of voice/data",
      rateType: "FLAT",
      rateVersions: {
        create: {
          gstRate: 18.0,
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
        },
      },
    },
  });

  // Price Slab HSN (Apparel: 6109)
  const hsn6109 = await prisma.hsnCode.create({
    data: {
      code: "6109",
      description: "T-shirts, singlets and other vests, knitted or crocheted",
      rateType: "SLAB",
      rateVersions: {
        create: {
          effectiveFrom: new Date("2024-01-01"),
          createdBy: "System Seed",
          slabs: {
            create: [
              { minPrice: 0.0, maxPrice: 1000.0, gstRate: 5.0 },
              { minPrice: 1000.01, maxPrice: null, gstRate: 12.0 },
            ],
          },
        },
      },
    },
  });

  console.log("Seeded HSN Codes & Rate Versions (Flat & Slab).");

  // 5e. Seed Category ↔ HSN Mappings
  await prisma.categoryHsnMapping.createMany({
    data: [
      { categoryId: catElectricalFittings.id, hsnId: hsn8536.id },
      { categoryId: catElectricalWires.id, hsnId: hsn8544.id },
      { categoryId: catFans.id, hsnId: hsn8414.id },
      { categoryId: catLEDLighting.id, hsnId: hsn9405.id },
      { categoryId: catHomeAppliances.id, hsnId: hsn8516.id },
      { categoryId: catUPSSystems.id, hsnId: hsn8504.id },
      { categoryId: catElectricVehicles.id, hsnId: hsn8711.id },
      { categoryId: catEVBatteries.id, hsnId: hsn8507.id },
      { categoryId: catEVAccessories.id, hsnId: hsn8714.id },
    ],
  });
  console.log("Seeded Category ↔ HSN Mappings.");

  // 5f. Seed Tax Settings
  await prisma.taxSettings.create({
    data: {
      sellerStateCode: "27", // Maharashtra
      sellerGstin: "27AABCV1234K1Z5",
      pricingMode: "EXCLUSIVE",
      defaultHsnId: hsn8536.id,
    },
  });
  console.log("Seeded Tax Settings.");

  // 6. Seed Products

  // Product 1: Inverter (BUY, VIRTUAL) -> UPS Systems
  const productInverter = await prisma.product.create({
    data: {
      title: "Microtek Luxe 3kVA Pure Sine Wave UPS",
      description: "Premium digital UPS / hybrid power backup system with high efficiency and multi-stage battery charging control.",
      basePrice: 28500,
      checkoutMode: "BUY",
      stockMode: "VIRTUAL",
      categoryId: catUPSSystems.id,
      brandId: brandMicrotek.id,
      specs: JSON.stringify({
        "Capacity": "3kVA / 24V",
        "Wave Type": "Pure Sine Wave",
        "Technology": "Micro-Controller based Intelligent Design",
        "Warranty": "2 Years"
      }),
      images: {
        create: {
          imageId: imageInverter.id,
          sortOrder: 1,
          isMain: true
        }
      },
      variants: {
        create: [
          { title: "Standard 3kVA", sku: "MTK-UPS-3KVA-STD", isAvailable: true }
        ]
      }
    }
  });

  // Product 2: Ceiling Fan (BUY, TRACKED) -> Fans
  const productFan = await prisma.product.create({
    data: {
      title: "Orient BLDC Ceiling Fan 1200mm",
      description: "Energy-saving BLDC ceiling fan with remote control, silent operation, and 5-speed control configurations.",
      basePrice: 3800,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      categoryId: catFans.id,
      brandId: brandOrient.id,
      specs: JSON.stringify({
        "Sweep Size": "1200mm",
        "Motor Type": "BLDC Silent",
        "Power Consumption": "28W (Energy Efficient)",
        "Control": "RF Remote"
      }),
      images: {
        create: {
          imageId: imageFan.id,
          sortOrder: 1,
          isMain: true
        }
      },
      variants: {
        create: [
          { title: "Classy White", price: 3800, stock: 15, sku: "ORN-BLDC-1200-WHT", color: "White", isAvailable: true },
          { title: "Metallic Bronze", price: 4100, stock: 8, sku: "ORN-BLDC-1200-BRZ", color: "Bronze", isAvailable: true }
        ]
      }
    }
  });

  // Product 3: E-Scooty (INQUIRE, INQUIRE) -> Electric Vehicles
  const productScooty = await prisma.product.create({
    data: {
      title: "ZOE EcoRide Pro Smart Electric Scooty",
      description: "Next-gen smart electric scooter. Features a 120km range, lithium-ion battery, LED display, and app monitoring.",
      basePrice: 85000,
      checkoutMode: "INQUIRE",
      stockMode: "INQUIRE",
      categoryId: catElectricVehicles.id,
      brandId: brandZOE.id,
      specs: JSON.stringify({
        "Motor Power": "1500W BLDC Hub Motor",
        "Battery": "60V 30Ah Lithium-Ion",
        "Range": "120 km / Charge",
        "Top Speed": "45 km/h"
      }),
      images: {
        create: {
          imageId: imageScooty.id,
          sortOrder: 1,
          isMain: true
        }
      },
      variants: {
        create: [
          { title: "Matte Black (120km Range)", sku: "ZOE-ER-PRO-BLK", isAvailable: true },
          { title: "Slate Grey (120km Range)", sku: "ZOE-ER-PRO-GRY", isAvailable: true }
        ]
      }
    }
  });

  // Product 4: Finolex Copper Wire (BUY, TRACKED) -> Electrical Wires
  const productWire = await prisma.product.create({
    data: {
      title: "Finolex 2.5 sqmm FR insulated copper wire (90m)",
      description: "Flame Retardant (FR) multi-strand copper cables ideal for internal conduit wiring in homes and buildings.",
      basePrice: 2200,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      categoryId: catElectricalWires.id,
      brandId: brandFinolex.id,
      specs: JSON.stringify({
        "Size": "2.5 sqmm",
        "Length": "90 Meters",
        "Conductor": "99.9% Pure Electrolytic Grade Copper",
        "Insulation": "Flame Retardant PVC"
      }),
      images: {
        create: {
          imageId: imageWire.id,
          sortOrder: 1,
          isMain: true
        }
      },
      variants: {
        create: [
          { title: "Red 90m", price: 2200, stock: 25, sku: "FIN-2.5MM-RED-90M", color: "Red", isAvailable: true },
          { title: "Black 90m", price: 2200, stock: 20, sku: "FIN-2.5MM-BLK-90M", color: "Black", isAvailable: true },
          { title: "Green 90m", price: 2200, stock: 12, sku: "FIN-2.5MM-GRN-90M", color: "Green", isAvailable: true }
        ]
      }
    }
  });

  // Product 5: LED Panel Light (BUY, TRACKED) -> LED Lighting
  const productLED = await prisma.product.create({
    data: {
      title: "Syska 15W Slim LED Recessed Panel Light",
      description: "Ultra-slim round LED recessed panel light with anti-glare diffuser, high brightness, and long lifetime.",
      basePrice: 450,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      categoryId: catLEDLighting.id,
      brandId: brandSyska.id,
      specs: JSON.stringify({
        "Power": "15 Watts",
        "Shape": "Round Slim",
        "Color Temperature": "6500K (Cool Day Light)",
        "Lifetime": "Up to 50,000 Hours"
      }),
      images: {
        create: {
          imageId: imageLED.id,
          sortOrder: 1,
          isMain: true
        }
      },
      variants: {
        create: [
          { title: "Cool Day Light (Round)", price: 450, stock: 40, sku: "SYS-15W-CDL-RND", color: "White", isAvailable: true }
        ]
      }
    }
  });

  console.log("Seeded Products.");

  // 7. Seed Leads (Inquiries)
  await prisma.lead.create({
    data: {
      name: "Sanjay Mishra",
      phone: "9876543210",
      email: "sanjay@outlook.com",
      city: "Suriyawan",
      pincode: "221404",
      productId: productScooty.id,
      productName: productScooty.title,
      message: "I want to book a test ride for the Matte Black E-Scooty in Suriyawan this Sunday.",
      status: "NEW",
      ownerNotes: "Need to call Sanjay on Friday evening to coordinate the test vehicle.",
    }
  });

  console.log("Seeded sample Leads.");

  // 8. Seed Coupons
  await prisma.coupon.deleteMany();
  await prisma.coupon.createMany({
    data: [
      {
        code: "WELCOME10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        minOrderValue: 999,
        maxDiscount: 500,
        usageLimit: 1000,
        usedCount: 14,
        isActive: true,
      },
      {
        code: "SOLAR500",
        discountType: "FLAT",
        discountValue: 500,
        minOrderValue: 5000,
        usageLimit: 200,
        usedCount: 5,
        isActive: true,
      },
      {
        code: "FESTIVE15",
        discountType: "PERCENTAGE",
        discountValue: 15,
        minOrderValue: 2000,
        maxDiscount: 1500,
        isActive: true,
      },
    ],
  });
  console.log("Seeded Coupons.");

  // 9. Seed Reviews
  await prisma.review.deleteMany();
  await prisma.review.create({
    data: {
      userId: customer.id,
      productId: productFan.id,
      rating: 5,
      title: "Excellent BLDC Fan - saves so much power!",
      comment: "Installed this Atomberg fan in our living room in Suriyawan. Works flawlessly on inverter and runs dead silent with great airflow.",
      isVerifiedPurchase: true,
      status: "APPROVED",
    },
  });
  await prisma.review.create({
    data: {
      userId: customer.id,
      productId: productLED.id,
      rating: 5,
      title: "Bright and durable Syska panel",
      comment: "Very bright daylight output, fits perfectly into the false ceiling cutouts. Fast local delivery.",
      isVerifiedPurchase: true,
      status: "APPROVED",
    },
  });
  console.log("Seeded Reviews.");

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during database seed execution:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
