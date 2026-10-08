import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==> Starting Storefront Real Catalogue Seeding (Spec 10)...");

  // 1. Purge test/garbage products and test categories safely
  console.log("Archiving test products and obsolete test categories...");
  await prisma.product.updateMany({
    where: {
      OR: [
        { title: { contains: "Test Product" } },
        { title: { contains: "Cotton Kurta" } },
        { title: { contains: "Solar Technician Kurta" } },
        { slug: { startsWith: "test-" } },
        { slug: { startsWith: "cotton-kurta" } },
        { slug: { startsWith: "solar-uniform" } },
        { slug: "automated-test-draft-product" },
      ],
    },
    data: {
      isAvailable: false,
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
  });

  await prisma.category.updateMany({
    where: {
      slug: { in: ["inv-test-cat", "inventory-test-category", "apparel-shipping-test"] },
    },
    data: {
      deletedAt: new Date(),
    },
  });

  // 2. Ensure Brands
  const brandData = [
    { name: "Crompton", slug: "crompton", description: "Pioneer in energy-efficient BLDC fans and home pumps" },
    { name: "Havells", slug: "havells", description: "Leading Indian fast moving electrical goods brand" },
    { name: "Orient Electric", slug: "orient-electric", description: "Smart fans, home appliances, and switchgear" },
    { name: "Polycab", slug: "polycab", description: "India's premier wire, cable, and FMEG manufacturer" },
    { name: "Finolex Cables", slug: "finolex-cables", description: "High-grade flame-retardant industrial & domestic wires" },
    { name: "Microtek", slug: "microtek", description: "Heavy-duty pure sine wave inverters, UPS, and solar solutions" },
    { name: "Luminous", slug: "luminous", description: "Smart inverter technologies and long-lasting tubular batteries" },
    { name: "Syska LED", slug: "syska-led", description: "Modern, flicker-free LED luminaires and lighting fixtures" },
    { name: "Bajaj", slug: "bajaj", description: "Trusted Indian manufacturer of water heaters and kitchen appliances" },
    { name: "ZOE Motors", slug: "zoe-motors", description: "Clean energy smart electric 2-wheelers and commercial loaders" },
    { name: "Anchor by Panasonic", slug: "anchor-panasonic", description: "World-class modular switches, sockets, and protection MCBs" },
  ];

  const brands: Record<string, any> = {};
  for (const b of brandData) {
    brands[b.slug] = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description },
      create: b,
    });
  }
  console.log(`✓ Seeded ${Object.keys(brands).length} Brands`);

  // 3. Ensure Confirmed Categories (9 Trade Categories)
  const categoryData = [
    {
      name: "Electrical Fittings",
      slug: "electrical-fittings",
      description: "Modular switches, MCBs, distribution boxes, sockets, and conduits.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 3,
      sortOrder: 1,
    },
    {
      name: "Electrical Wires",
      slug: "electrical-wires",
      description: "Flame retardant (FR/FRLS) 100% copper house wiring and submersible cables.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 2,
      sortOrder: 2,
    },
    {
      name: "Fans",
      slug: "fans",
      description: "High-speed BLDC energy-saving ceiling fans, exhaust fans, and pedestal fans.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 2,
      sortOrder: 3,
    },
    {
      name: "LED Lighting",
      slug: "led-lighting",
      description: "Energy-efficient LED battens, downlights, recessed panels, and outdoor lights.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 2,
      sortOrder: 4,
    },
    {
      name: "Home Appliances",
      slug: "home-appliances",
      description: "Storage water heaters, immersion rods, room heaters, and dry/steam irons.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 3,
      sortOrder: 5,
    },
    {
      name: "UPS Systems",
      slug: "ups-systems",
      description: "Sine wave power backup inverters, solar inverters, and heavy-duty tubular batteries.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 3,
      sortOrder: 6,
    },
    {
      name: "Electric Vehicles",
      slug: "electric-vehicles",
      description: "High-efficiency electric 2-wheelers, e-rickshaws, and commercial e-loaders.",
      defaultCheckoutMode: "INQUIRE",
      sourcingLeadDays: 7,
      sortOrder: 7,
    },
    {
      name: "EV Batteries & Chargers",
      slug: "ev-batteries-chargers",
      description: "Automotive-grade Lithium-ion battery packs, swappable units, and fast chargers.",
      defaultCheckoutMode: "INQUIRE",
      sourcingLeadDays: 7,
      sortOrder: 8,
    },
    {
      name: "EV Accessories",
      slug: "ev-accessories",
      description: "Smart controllers, throttles, crash guards, rain covers, and vehicle parts.",
      defaultCheckoutMode: "BUY",
      sourcingLeadDays: 3,
      sortOrder: 9,
    },
  ];

  const categories: Record<string, any> = {};
  for (const c of categoryData) {
    categories[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        defaultCheckoutMode: c.defaultCheckoutMode,
        sourcingLeadDays: c.sourcingLeadDays,
        sortOrder: c.sortOrder,
      },
      create: c,
    });
  }
  console.log(`✓ Seeded ${Object.keys(categories).length} Categories`);

  // 4. Update Attributes with helpText (B-02)
  const attrSweep = await prisma.attribute.upsert({
    where: { code: "blade_sweep" },
    update: {
      name: "Blade Sweep",
      helpText: "1200 mm suits most normal bedrooms. Bigger halls need 1400 mm.",
    },
    create: {
      name: "Blade Sweep",
      code: "blade_sweep",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      helpText: "1200 mm suits most normal bedrooms. Bigger halls need 1400 mm.",
      values: {
        create: [
          { label: "900 mm", code: "900mm", displayOrder: 1 },
          { label: "1200 mm", code: "1200mm", displayOrder: 2 },
          { label: "1400 mm", code: "1400mm", displayOrder: 3 },
        ],
      },
    },
  });

  const attrColour = await prisma.attribute.upsert({
    where: { code: "colour" },
    update: {
      name: "Colour",
      helpText: "Matte finishes resist dust; gloss finishes wipe clean easily.",
    },
    create: {
      name: "Colour",
      code: "colour",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      usesSwatches: true,
      helpText: "Matte finishes resist dust; gloss finishes wipe clean easily.",
      values: {
        create: [
          { label: "Pearl White", code: "pearl_white", swatchHex: "#FFFFFF", displayOrder: 1 },
          { label: "Smoked Brown", code: "smoked_brown", swatchHex: "#4E3629", displayOrder: 2 },
          { label: "Matte Black", code: "matte_black", swatchHex: "#1F2428", displayOrder: 3 },
          { label: "Ivory Gold", code: "ivory_gold", swatchHex: "#EFEBD9", displayOrder: 4 },
        ],
      },
    },
  });

  const attrWireGauge = await prisma.attribute.upsert({
    where: { code: "wire_gauge" },
    update: {
      name: "Wire Gauge",
      helpText: "1.0 sq mm for lighting, 1.5 sq mm for sockets, 2.5 sq mm for AC/geyser.",
    },
    create: {
      name: "Wire Gauge",
      code: "wire_gauge",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      helpText: "1.0 sq mm for lighting, 1.5 sq mm for sockets, 2.5 sq mm for AC/geyser.",
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

  const attrCapacity = await prisma.attribute.upsert({
    where: { code: "power_capacity" },
    update: {
      name: "Capacity",
      helpText: "1 kVA runs basic lights & fans; 3 kVA powers full household with refrigerator.",
    },
    create: {
      name: "Capacity",
      code: "power_capacity",
      inputType: "SINGLE_SELECT",
      isVariantDefining: true,
      helpText: "1 kVA runs basic lights & fans; 3 kVA powers full household with refrigerator.",
      values: {
        create: [
          { label: "1 kVA", code: "1kva", displayOrder: 1 },
          { label: "2 kVA", code: "2kva", displayOrder: 2 },
          { label: "3 kVA", code: "3kva", displayOrder: 3 },
          { label: "5 kVA", code: "5kva", displayOrder: 4 },
        ],
      },
    },
  });

  console.log("✓ Seeded Attributes & Values with Help Text");

  // 5. Seed Images
  const images = {
    fanCrompton: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1618944847023-38aa001235f0?w=800&auto=format&fit=crop",
        filename: "crompton_bldc_fan.jpg",
        size: 58000,
        alt: "Crompton Energion BLDC Ceiling Fan",
      },
    }),
    fanHavells: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop",
        filename: "havells_stealth_fan.jpg",
        size: 61000,
        alt: "Havells Stealth Air Ceiling Fan",
      },
    }),
    wirePolycab: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop",
        filename: "polycab_wire.jpg",
        size: 54000,
        alt: "Polycab FR House Wires",
      },
    }),
    wireFinolex: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1601524909162-ae8725290836?w=800&auto=format&fit=crop",
        filename: "finolex_copper_cable.jpg",
        size: 52000,
        alt: "Finolex 2.5 sqmm Copper Wire Coil",
      },
    }),
    switchAnchor: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop",
        filename: "anchor_roma_switch.jpg",
        size: 47000,
        alt: "Anchor Roma Modular Switch and Plate",
      },
    }),
    switchHavells: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop",
        filename: "havells_crabtree_switch.jpg",
        size: 45000,
        alt: "Havells Crabtree Athena 6A Modular Switch",
      },
    }),
    ledSyska: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=800&auto=format&fit=crop",
        filename: "syska_panel_light.jpg",
        size: 49000,
        alt: "Syska 15W Slim LED Recessed Panel Light",
      },
    }),
    ledBatten: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop",
        filename: "philips_led_batten.jpg",
        size: 42000,
        alt: "Philips Stellar 20W LED Batten Light",
      },
    }),
    geyserHavells: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800&auto=format&fit=crop",
        filename: "havells_monza_geyser.jpg",
        size: 51000,
        alt: "Havells Monza EC 15L Water Heater",
      },
    }),
    geyserBajaj: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop",
        filename: "bajaj_neo_geyser.jpg",
        size: 53000,
        alt: "Bajaj New Shakti Neo 25L Geyser",
      },
    }),
    upsMicrotek: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=800&auto=format&fit=crop",
        filename: "microtek_luxe_ups.jpg",
        size: 78000,
        alt: "Microtek Luxe 3kVA Pure Sine Wave UPS",
      },
    }),
    upsLuminous: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop",
        filename: "luminous_zelio_ups.jpg",
        size: 75000,
        alt: "Luminous Zelio+ 1100 Home UPS",
      },
    }),
    evScooter: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop",
        filename: "zoe_ecoride_pro.jpg",
        size: 92000,
        alt: "ZOE EcoRide Pro Smart Electric Scooty",
      },
    }),
    evLoader: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&fit=crop",
        filename: "zoe_loadking_cargo.jpg",
        size: 98000,
        alt: "ZOE LoadKing Commercial Cargo E-Loader",
      },
    }),
    evBattery: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop",
        filename: "microtek_lithium_battery.jpg",
        size: 67000,
        alt: "Microtek 60V 30Ah Lithium-Ion Battery Pack",
      },
    }),
    evCharger: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&auto=format&fit=crop",
        filename: "zoe_fast_charger.jpg",
        size: 58000,
        alt: "ZOE Smart Fast Charger 60V 10A",
      },
    }),
    evHelmet: await prisma.mediaImage.create({
      data: {
        url: "https://images.unsplash.com/photo-1558980664-769d59546b3d?w=800&auto=format&fit=crop",
        filename: "ev_protective_helmet.jpg",
        size: 45000,
        alt: "ISI Certified Aerodynamic EV Rider Helmet",
      },
    }),
  };

  console.log("✓ Seeded Media Images");

  // 6. Real Plausible Products (P-01 plain language, P-02 fixed slots, P-04 INQUIRE distinction, P-05 honest stock)
  const productsToSeed = [
    // ── FANS (BUY)
    {
      title: "Crompton Energion HS 1200mm BLDC Ceiling Fan",
      slug: "crompton-energion-1200mm-bldc-fan",
      shortDescription: "Fits a normal 10x12 bedroom; cuts fan power bill by 65%",
      description:
        "India's best-selling energy saving BLDC ceiling fan with smart remote control. ActivBLDC motor delivers high air delivery of 220 CMM while consuming only 28W at full speed. Runs up to 3 times longer on inverter backup during load shedding.",
      basePrice: 3499,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["fans"].id,
      brandId: brands["crompton"].id,
      imageId: images.fanCrompton.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Sweep Size": "1200 mm",
        "Power Consumption": "28 Watts",
        "Air Delivery": "220 CMM",
        "Speed": "370 RPM",
        "Remote Functions": "Timer (2h, 4h, 6h, 8h), Sleep Mode, Boost Mode",
        "Warranty": "5 Year On-Site Warranty",
      }),
      variants: [
        {
          title: "1200 mm / Pearl White",
          sku: "CMP-ENRG-1200-WHT",
          price: 3499,
          mrp: 4500,
          stock: 14,
          isDefault: true,
          isAvailable: true,
          attributes: { "blade_sweep": "1200 mm", "colour": "Pearl White" },
        },
        {
          title: "1200 mm / Smoked Brown",
          sku: "CMP-ENRG-1200-BRN",
          price: 3599,
          mrp: 4600,
          stock: 6,
          isDefault: false,
          isAvailable: true,
          attributes: { "blade_sweep": "1200 mm", "colour": "Smoked Brown" },
        },
        {
          title: "1400 mm / Pearl White",
          sku: "CMP-ENRG-1400-WHT",
          price: 3899,
          mrp: 4950,
          stock: 2, // Low stock test
          isDefault: false,
          isAvailable: true,
          attributes: { "blade_sweep": "1400 mm", "colour": "Pearl White" },
        },
        {
          title: "900 mm / Smoked Brown",
          sku: "CMP-ENRG-900-BRN",
          price: 3299,
          mrp: 4200,
          stock: 0, // Sourcing test
          isDefault: false,
          isAvailable: true,
          attributes: { "blade_sweep": "900 mm", "colour": "Smoked Brown" },
        },
      ],
    },
    {
      title: "Havells Stealth Air 1200mm Silent Ceiling Fan",
      slug: "havells-stealth-air-1200mm-fan",
      shortDescription: "Silent whisper-flow blades for peaceful sleep; dust-resistant lacquer",
      description:
        "Engineered with aerodynamic composite blades that reduce air friction and eliminate typical ceiling fan whirring. Hydrophobic dust-resistant coating prevents grime accumulation in dusty town conditions.",
      basePrice: 5199,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["fans"].id,
      brandId: brands["havells"].id,
      imageId: images.fanHavells.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Sweep Size": "1200 mm",
        "Blade Material": "Twin-color Composite",
        "Coating": "Dust-Resistant Metallic Lacquer",
        "Air Flow": "280 CMM High Thrust",
        "Warranty": "2 Years Comprehensive",
      }),
      variants: [
        {
          title: "1200 mm / Matte Black",
          sku: "HVL-STLTH-1200-BLK",
          price: 5199,
          mrp: 6850,
          stock: 8,
          isDefault: true,
          isAvailable: true,
          attributes: { "blade_sweep": "1200 mm", "colour": "Matte Black" },
        },
        {
          title: "1200 mm / Pearl White",
          sku: "HVL-STLTH-1200-WHT",
          price: 5199,
          mrp: 6850,
          stock: 12,
          isDefault: false,
          isAvailable: true,
          attributes: { "blade_sweep": "1200 mm", "colour": "Pearl White" },
        },
      ],
    },

    // ── ELECTRICAL WIRES (BUY)
    {
      title: "Polycab 1.5 sq mm Green FR Copper House Wire (90m)",
      slug: "polycab-1-5-sqmm-fr-copper-wire-90m",
      shortDescription: "Standard thickness for 6A wall sockets, TVs, and bedroom lighting",
      description:
        "100% pure electrolytic grade multi-strand annealed copper conductor with Flame Retardant (FR) PVC insulation. Certified to resist flash fires and prevent flame propagation across enclosed conduits.",
      basePrice: 1649,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electrical-wires"].id,
      brandId: brands["polycab"].id,
      imageId: images.wirePolycab.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Conductor Cross-section": "1.5 sq mm",
        "Standard Coil Length": "90 Metres",
        "Voltage Grade": "Up to 1100V",
        "Current Capacity": "14 Amperes",
        "Conductor": "Bright Annealed Bare Copper (IS:8130)",
        "Insulation": "Flame Retardant Lead-Free PVC",
      }),
      variants: [
        {
          title: "1.5 sq mm / Red (Live)",
          sku: "POL-1.5-RED-90M",
          price: 1649,
          mrp: 2190,
          stock: 25,
          isDefault: true,
          isAvailable: true,
          attributes: { "wire_gauge": "1.5 sq mm", "colour": "Red" },
        },
        {
          title: "1.5 sq mm / Black (Neutral)",
          sku: "POL-1.5-BLK-90M",
          price: 1649,
          mrp: 2190,
          stock: 20,
          isDefault: false,
          isAvailable: true,
          attributes: { "wire_gauge": "1.5 sq mm", "colour": "Black" },
        },
        {
          title: "1.5 sq mm / Green (Earth)",
          sku: "POL-1.5-GRN-90M",
          price: 1649,
          mrp: 2190,
          stock: 18,
          isDefault: false,
          isAvailable: true,
          attributes: { "wire_gauge": "1.5 sq mm", "colour": "Green" },
        },
      ],
    },
    {
      title: "Finolex 2.5 sq mm Flame Retardant Copper Wire (90m)",
      slug: "finolex-2-5-sqmm-fr-copper-wire-90m",
      shortDescription: "Heavy-duty rating for 1.5-ton split ACs, geysers, and power boards",
      description:
        "High current capacity copper cable with superior insulation resistance. Specifically engineered for demanding residential loads including power geysers, kitchen microwaves, and split air conditioning lines.",
      basePrice: 2499,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electrical-wires"].id,
      brandId: brands["finolex-cables"].id,
      imageId: images.wireFinolex.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Conductor Cross-section": "2.5 sq mm",
        "Length": "90 Metres",
        "Current Capacity": "20 Amperes",
        "Certifications": "ISI Marked (IS:694), CE, RoHS Compliant",
        "Purity": "99.97% Pure Electrolytic Copper",
      }),
      variants: [
        {
          title: "2.5 sq mm / Red",
          sku: "FIN-2.5-RED-90M",
          price: 2499,
          mrp: 3250,
          stock: 16,
          isDefault: true,
          isAvailable: true,
          attributes: { "wire_gauge": "2.5 sq mm", "colour": "Red" },
        },
        {
          title: "2.5 sq mm / Black",
          sku: "FIN-2.5-BLK-90M",
          price: 2499,
          mrp: 3250,
          stock: 15,
          isDefault: false,
          isAvailable: true,
          attributes: { "wire_gauge": "2.5 sq mm", "colour": "Black" },
        },
      ],
    },

    // ── ELECTRICAL FITTINGS (BUY)
    {
      title: "Anchor Roma Classic 16A Shuttered Power Socket",
      slug: "anchor-roma-classic-16a-power-socket",
      shortDescription: "Child-safety shuttered socket for heavy home appliances and heaters",
      description:
        "Universal 6A/16A combined socket with captive screw terminals and internal polycarbonate safety shutters. Prevents accidental contact and withstands sustained high-wattage current draw without heating.",
      basePrice: 185,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electrical-fittings"].id,
      brandId: brands["anchor-panasonic"].id,
      imageId: images.switchAnchor.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Current Rating": "6A & 16A Combined",
        "Module Size": "2 Module",
        "Shutter Protection": "Dual Spring In-built Child Shutter",
        "Contact Material": "Silver-alloy rivets with brass terminals",
      }),
      variants: [
        {
          title: "White / 16A Socket",
          sku: "ANC-ROMA-16A-WHT",
          price: 185,
          mrp: 235,
          stock: 80,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },
    {
      title: "Havells Crabtree Athena 6A 1-Way Modular Switch",
      slug: "havells-crabtree-athena-6a-modular-switch",
      shortDescription: "Dual-shutter sparkless mechanism rated for 100,000 continuous clicks",
      description:
        "Ultra-smooth rocker action switch with silver cadmium oxide contacts for zero sparking. Fire-retardant virgin polycarbonate casing that never discolours or yellows over years of usage.",
      basePrice: 95,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electrical-fittings"].id,
      brandId: brands["havells"].id,
      imageId: images.switchHavells.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Current Rating": "6 Amperes, 240V AC",
        "Module Size": "1 Module",
        "Cycle Life": "Tested for 100,000+ Operations",
        "Terminal Type": "Brass Terminals with Plated Screws",
      }),
      variants: [
        {
          title: "Pure White / 6A Switch",
          sku: "HVL-CBT-6A-WHT",
          price: 95,
          mrp: 130,
          stock: 120,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },

    // ── LED LIGHTING (BUY)
    {
      title: "Syska 15W Slim LED Recessed Panel Downlight",
      slug: "syska-15w-slim-led-recessed-panel-light",
      shortDescription: "Ultra-thin flush ceiling fit with zero eye-strain frosted diffuser",
      description:
        "Round recessed slim LED panel light engineered with high efficacy LEDs producing 1350 lumens. Fits into shallow false ceilings (under 25mm depth) and includes integrated surge-protected driver.",
      basePrice: 420,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["led-lighting"].id,
      brandId: brands["syska-led"].id,
      imageId: images.ledSyska.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Wattage": "15 Watts",
        "Lumen Output": "1350 Lumens (90 lm/W)",
        "Color Temp": "6500K Cool Daylight",
        "Cut-out Hole": "150 mm (6 inches)",
        "Surge Protection": "Up to 3.5 kV In-built",
        "Lifespan": "30,000 Hours",
      }),
      variants: [
        {
          title: "Cool Daylight (6500K)",
          sku: "SYS-15W-RND-CDL",
          price: 420,
          mrp: 650,
          stock: 45,
          isDefault: true,
          isAvailable: true,
        },
        {
          title: "Warm White (3000K)",
          sku: "SYS-15W-RND-WW",
          price: 420,
          mrp: 650,
          stock: 20,
          isDefault: false,
          isAvailable: true,
        },
      ],
    },
    {
      title: "Philips Stellar 20W LED Batten Light (4 Feet)",
      slug: "philips-stellar-20w-led-batten-light",
      shortDescription: "Direct replacement for traditional tube rods; instant flicker-free light",
      description:
        "Robust extruded polycarbonate batten with uniform edge-to-edge light distribution. Provides broad room illumination with zero dark ends and comes with easy snap-on mounting clips.",
      basePrice: 280,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["led-lighting"].id,
      brandId: brands["syska-led"].id,
      imageId: images.ledBatten.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Length": "4 Feet (1200 mm)",
        "Wattage": "20 Watts",
        "Luminous Flux": "2000 Lumens",
        "Beam Angle": ">120 Degrees Wide Spread",
      }),
      variants: [
        {
          title: "4 Feet / 20W Batten",
          sku: "PHL-20W-BTN-4FT",
          price: 280,
          mrp: 420,
          stock: 50,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },

    // ── HOME APPLIANCES (BUY)
    {
      title: "Havells Monza EC 15L Storage Water Heater Geyser",
      slug: "havells-monza-ec-15l-water-heater",
      shortDescription: "Feroglas tank with heavy heating rod; hot bath water in under 10 minutes",
      description:
        "Engineered with ultra-thick cold rolled steel coated with Feroglas enamel to prevent rust from hard borewell water. Heavy-duty Incoloy 800 heating element ensures fast thermal transfer with 5-star energy rating.",
      basePrice: 6899,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["home-appliances"].id,
      brandId: brands["havells"].id,
      imageId: images.geyserHavells.id,
      sourcingLeadDays: 3,
      specs: JSON.stringify({
        "Capacity": "15 Litres",
        "Pressure Rating": "8 Bar (Suitable for high-rise buildings & pumps)",
        "BEE Star Rating": "5 Star Energy Efficient",
        "Tank Material": "Feroglas Enamel Coated Steel",
        "Heating Rod": "Incoloy 800 Glass-lined Element",
        "Warranty": "7 Years on Inner Tank, 2 Years on Element",
      }),
      variants: [
        {
          title: "15 Litres / White & Grey",
          sku: "HVL-MNZ-15L-WHT",
          price: 6899,
          mrp: 9800,
          stock: 7,
          isDefault: true,
          isAvailable: true,
        },
        {
          title: "25 Litres / White & Grey",
          sku: "HVL-MNZ-25L-WHT",
          price: 8299,
          mrp: 11400,
          stock: 3, // Low stock test
          isDefault: false,
          isAvailable: true,
        },
      ],
    },
    {
      title: "Bajaj New Shakti Neo 25L Vertical Storage Geyser",
      slug: "bajaj-new-shakti-neo-25l-geyser",
      shortDescription: "Titanium armour tank ideal for hard water areas and multi-story plumbing",
      description:
        "Equipped with Titanium Armour Technology for long tank life in mineral-rich borewell water. Features Swirl Flow technology that delivers 20% more hot water by slowing incoming cold water mixing.",
      basePrice: 7499,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["home-appliances"].id,
      brandId: brands["bajaj"].id,
      imageId: images.geyserBajaj.id,
      sourcingLeadDays: 3,
      specs: JSON.stringify({
        "Capacity": "25 Litres",
        "Rated Pressure": "8 Bar",
        "Tank Coating": "Titanium Armour Marine-grade",
        "Safety Cutoff": "Multi-function safety valve & auto thermal cut-out",
      }),
      variants: [
        {
          title: "25 Litres / White",
          sku: "BAJ-NEO-25L-WHT",
          price: 7499,
          mrp: 10500,
          stock: 5,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },

    // ── UPS SYSTEMS (BUY)
    {
      title: "Microtek Luxe 3kVA Pure Sine Wave Inverter UPS",
      slug: "microtek-luxe-3kva-pure-sine-wave-ups",
      shortDescription: "Runs complete 2BHK house including refrigerator, fans, and PC during power cuts",
      description:
        "State-of-the-art pure sine wave UPS featuring high-speed microcontroller architecture. Powers sensitive home electronics, LED TVs, desktop computers, and kitchen appliances without humming noise or distortion.",
      basePrice: 19800,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["ups-systems"].id,
      brandId: brands["microtek"].id,
      imageId: images.upsMicrotek.id,
      sourcingLeadDays: 3,
      specs: JSON.stringify({
        "Capacity": "3 kVA / 24V System (Requires 2 Batteries)",
        "Waveform": "Pure Sine Wave",
        "Charging Current": "Adjustable (Up to 18A Multi-stage)",
        "Overload Capacity": "110% for 10 minutes with auto-retry",
        "Warranty": "24 Months On-site Doorstep",
      }),
      variants: [
        {
          title: "3 kVA / 24V System",
          sku: "MTK-LUXE-3KVA",
          price: 19800,
          mrp: 26500,
          stock: 4,
          isDefault: true,
          isAvailable: true,
          attributes: { "power_capacity": "3 kVA" },
        },
        {
          title: "2 kVA / 24V System",
          sku: "MTK-LUXE-2KVA",
          price: 14200,
          mrp: 18900,
          stock: 6,
          isDefault: false,
          isAvailable: true,
          attributes: { "power_capacity": "2 kVA" },
        },
      ],
    },
    {
      title: "Luminous Zelio+ 1100 Intelligent Home Sine Wave UPS",
      slug: "luminous-zelio-1100-intelligent-home-ups",
      shortDescription: "Smart digital display shows exact power backup time in hours and minutes",
      description:
        "India's most intelligent residential inverter UPS with LED screen reporting hours remaining on current load, battery charge percentage, and bypass mode status. Supports deep discharge protection for maximum battery lifespan.",
      basePrice: 6299,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["ups-systems"].id,
      brandId: brands["luminous"].id,
      imageId: images.upsLuminous.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Capacity": "900 VA / 12V Single Battery",
        "Max Bulb Load": "756 Watts",
        "Display": "Intuitive LED Screen with Backup & Charge Hours",
        "Protection": "Short circuit, reverse polarity, battery over-charge",
      }),
      variants: [
        {
          title: "900 VA / Single Battery",
          sku: "LUM-ZELIO-1100",
          price: 6299,
          mrp: 8400,
          stock: 10,
          isDefault: true,
          isAvailable: true,
          attributes: { "power_capacity": "1 kVA" },
        },
      ],
    },

    // ── ELECTRIC VEHICLES (INQUIRE — P-04)
    {
      title: "ZOE EcoRide Pro Smart Electric Scooty",
      slug: "zoe-ecoride-pro-smart-electric-scooty",
      shortDescription: "120km range on single charge; swappable lithium pack for daily local commute",
      description:
        "High-performance urban electric scooter designed for Indian road conditions. High ground clearance, digital instrument cluster, anti-theft alarm system, and portable 60V 30Ah Lithium-ion battery pack that charges from any standard 6A home wall socket in 4 hours.",
      basePrice: 84999,
      checkoutMode: "INQUIRE",
      stockMode: "INQUIRE",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electric-vehicles"].id,
      brandId: brands["zoe-motors"].id,
      imageId: images.evScooter.id,
      sourcingLeadDays: 7,
      specs: JSON.stringify({
        "Motor Power": "1500W High Torque Waterproof BLDC Hub Motor",
        "Battery": "60V 30Ah NMC Automotive Grade Lithium Pack",
        "Real-world Range": "100 - 120 km per charge",
        "Top Speed": "45 km/h",
        "Braking": "Front Disc + Rear Drum with CBS",
        "Charging Time": "3.5 to 4 Hours (Fast Charger Included)",
        "License Requirement": "RTO Registered with Helmet & RC",
      }),
      variants: [
        {
          title: "Matte Black (120km Range)",
          sku: "ZOE-ECO-PRO-BLK",
          price: 84999,
          mrp: 99000,
          stock: 0,
          isDefault: true,
          isAvailable: true,
        },
        {
          title: "Metallic Cyan (120km Range)",
          sku: "ZOE-ECO-PRO-CYN",
          price: 84999,
          mrp: 99000,
          stock: 0,
          isDefault: false,
          isAvailable: true,
        },
      ],
    },
    {
      title: "ZOE LoadKing Commercial Heavy Duty Electric Cargo Loader",
      slug: "zoe-loadking-commercial-cargo-loader",
      shortDescription: "Heavy-duty 500kg payload cargo bed; ideal for Mandi and shop deliveries",
      description:
        "Rugged 3-wheeler commercial electric loader built on reinforced tubular chassis with heavy leaf spring suspension. Features low operating cost of less than ₹0.35 per kilometre, saving up to ₹8,000 monthly compared to diesel auto-rickshaws.",
      basePrice: 145000,
      checkoutMode: "INQUIRE",
      stockMode: "INQUIRE",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["electric-vehicles"].id,
      brandId: brands["zoe-motors"].id,
      imageId: images.evLoader.id,
      sourcingLeadDays: 7,
      specs: JSON.stringify({
        "Payload Capacity": "500 Kilograms Rated Cargo Load",
        "Cargo Bed Dimensions": "4.5 ft x 3.2 ft Heavy Gauge Steel Box",
        "Motor": "1200W Differential Geared High Torque Motor",
        "Battery Bank": "48V 100Ah Tubular Lead-Acid / Li-Ion Compatible",
        "Daily Running Cost": "Approx. ₹35 per full charge (80km)",
      }),
      variants: [
        {
          title: "Heavy Cargo Bed / Forest Green",
          sku: "ZOE-LK-500-GRN",
          price: 145000,
          mrp: 165000,
          stock: 0,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },

    // ── EV BATTERIES & CHARGERS (INQUIRE — P-04)
    {
      title: "Microtek EV SuperCharge 60V 30Ah Lithium-Ion Battery Pack",
      slug: "microtek-ev-supercharge-60v-30ah-lithium-battery",
      shortDescription: "Automotive grade prismatic cells with 3-year replacement warranty",
      description:
        "High-density Lithium iron phosphate (LiFePO4) / NMC pack with smart Bluetooth Battery Management System (BMS). Features cell balancing, thermal sensors, and IP67 waterproof metal casing suited for electric scooties and e-bikes.",
      basePrice: 32000,
      checkoutMode: "INQUIRE",
      stockMode: "INQUIRE",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["ev-batteries-chargers"].id,
      brandId: brands["microtek"].id,
      imageId: images.evBattery.id,
      sourcingLeadDays: 5,
      specs: JSON.stringify({
        "Nominal Voltage": "60 Volts",
        "Capacity": "30 Ampere-Hours (1.8 kWh Energy)",
        "BMS Features": "Over-charge, short-circuit, over-discharge, thermal cutoff",
        "Cycle Life": "2000+ Full Charge Cycles (80% Capacity Retention)",
        "Warranty": "36 Months Doorstep Replacement",
      }),
      variants: [
        {
          title: "60V 30Ah Pack / Metal Casing",
          sku: "MTK-EV-6030-LIP",
          price: 32000,
          mrp: 38000,
          stock: 0,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },

    // ── EV ACCESSORIES (BUY)
    {
      title: "ZOE Smart Fast Charger 60V 10A for Electric Scooters",
      slug: "zoe-smart-fast-charger-60v-10a",
      shortDescription: "Automated cut-off charger protects battery from overvoltage and thermal spikes",
      description:
        "High-efficiency smart charger with built-in cooling fan, dual LED charging indicators, and automatic CC/CV charging profile. Cuts off power automatically once battery hits 100% to prevent overcharging.",
      basePrice: 3499,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["ev-accessories"].id,
      brandId: brands["zoe-motors"].id,
      imageId: images.evCharger.id,
      sourcingLeadDays: 3,
      specs: JSON.stringify({
        "Input Voltage": "180V - 260V AC 50Hz (Indian Domestic Standard)",
        "Output": "67.2V DC @ 10 Amperes Constant Current",
        "Connector": "Standard 3-Pin Metal Cannon / IEC Connector",
        "Protections": "Reverse Polarity, OVP, OCP, Thermal Auto-Shutdown",
      }),
      variants: [
        {
          title: "60V 10A Standard Charger",
          sku: "ZOE-CHG-6010-STD",
          price: 3499,
          mrp: 4500,
          stock: 15,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },
    {
      title: "Steelbird Full Face Aerodynamic Helmet with Anti-Fog Visor",
      slug: "steelbird-aerodynamic-ev-helmet",
      shortDescription: "ISI certified crash safety helmet with quick-release chin buckle",
      description:
        "High impact ABS engineering thermoplastic shell with multi-layer EPS density liner. Features dynamic ventilation with upper and chin vents for maximum comfort during hot weather commutes in Uttar Pradesh.",
      basePrice: 1299,
      checkoutMode: "BUY",
      stockMode: "TRACKED",
      status: "ACTIVE",
      isAvailable: true,
      categoryId: categories["ev-accessories"].id,
      brandId: brands["zoe-motors"].id,
      imageId: images.evHelmet.id,
      sourcingLeadDays: 2,
      specs: JSON.stringify({
        "Certification": "ISI (IS:4151) Approved",
        "Shell Material": "High Impact ABS Outer Shell",
        "Visor": "Scratch-resistant Clear Optical Polycarbonate",
        "Strap": "Micro-metric Quick Release Ratchet Buckle",
      }),
      variants: [
        {
          title: "Large (58-60cm) / Matte Black",
          sku: "STB-HLM-LRG-BLK",
          price: 1299,
          mrp: 1750,
          stock: 18,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },
  ];

  for (const p of productsToSeed) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          title: p.title,
          shortDescription: p.shortDescription,
          description: p.description,
          basePrice: p.basePrice,
          checkoutMode: p.checkoutMode,
          stockMode: p.stockMode,
          status: p.status,
          isAvailable: p.isAvailable,
          sourcingLeadDays: p.sourcingLeadDays,
          categoryId: p.categoryId,
          brandId: p.brandId,
          specs: p.specs,
        },
      });
      console.log(`  ✓ Product updated: ${p.title} (${p.checkoutMode})`);
      continue;
    }

    for (const v of p.variants) {
      const existingVar = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
      if (existingVar) {
        try {
          await prisma.productVariant.delete({ where: { id: existingVar.id } });
        } catch (_) {}
      }
    }

    const created = await prisma.product.create({
      data: {
        title: p.title,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        basePrice: p.basePrice,
        checkoutMode: p.checkoutMode,
        stockMode: p.stockMode,
        status: p.status,
        isAvailable: p.isAvailable,
        sourcingLeadDays: p.sourcingLeadDays,
        categoryId: p.categoryId,
        brandId: p.brandId,
        specs: p.specs,
        images: {
          create: {
            imageId: p.imageId,
            sortOrder: 1,
            isMain: true,
          },
        },
        variants: {
          create: p.variants.map((v) => ({
            title: v.title,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isDefault: v.isDefault,
            isAvailable: v.isAvailable,
          })),
        },
      },
    });

    console.log(`  ✓ Product seeded: ${created.title} (${p.checkoutMode})`);
  }

  console.log("\n==> Storefront Real Catalogue Seeding COMPLETED SUCCESSFULLY!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
