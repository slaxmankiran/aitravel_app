/**
 * Seed Knowledge Base
 *
 * Seeds curated visa/entry requirement documents for top passport + destination combinations.
 * Run with: npx tsx server/scripts/seedKnowledge.ts
 */

const KNOWLEDGE_API = "http://localhost:3000/api/knowledge";

interface SeedDocument {
  sourceId: string;
  sourceType: "visa" | "entry_requirements";
  title: string;
  content: string;
  fromCountry: string;
  toCountry: string;
  sourceName: string;
  sourceUrl: string;
  metadata?: Record<string, unknown>;
}

/**
 * Curated visa documents for Indian passport holders.
 * Data sourced from official embassy websites (Jan 2026).
 */
const INDIA_VISA_DOCS: SeedDocument[] = [
  // Thailand
  {
    sourceId: "visa_india_thailand_voa",
    sourceType: "visa",
    title: "Thailand Visa on Arrival for Indian Citizens",
    content: `Indian passport holders can obtain a Visa on Arrival (VOA) for Thailand at designated international airports.
The VOA allows stays of up to 15 days and cannot be extended.
Fee: approximately $20 USD (or 2000 THB) payable in cash.
Required documents: Valid passport with 6+ months validity, completed arrival/departure card, proof of onward travel within 15 days, proof of accommodation booking, passport-size photo, and proof of funds (10,000 THB per person or 20,000 THB per family).
Processing is instant at immigration counters.
Important: VOA is only available at airports - land borders require a Tourist Visa obtained in advance.`,
    fromCountry: "IN",
    toCountry: "TH",
    sourceName: "Thai Immigration Bureau",
    sourceUrl: "https://www.immigration.go.th",
  },
  {
    sourceId: "visa_india_thailand_tourist",
    sourceType: "visa",
    title: "Thailand Tourist Visa for Indian Citizens",
    content: `Indian passport holders can apply for a Tourist Visa at Thai embassies/consulates for longer stays.
Single Entry Tourist Visa: Up to 60 days stay, extendable by 30 days at Thai Immigration.
Multiple Entry Tourist Visa (METV): Valid 6 months, each entry allows 60 days stay.
Fee: Single Entry ~$40 USD, Multiple Entry ~$200 USD.
Processing time: 3-5 business days (may be longer during peak seasons).
Required documents: Passport valid 6+ months, completed visa application form, 2 passport photos, proof of accommodation, flight itinerary, bank statements (last 3 months), employment letter or business registration.
Apply at: Thai Embassy New Delhi, Thai Consulates in Chennai, Kolkata, Mumbai.`,
    fromCountry: "IN",
    toCountry: "TH",
    sourceName: "Royal Thai Embassy India",
    sourceUrl: "https://newdelhi.thaiembassy.org",
  },

  // Japan
  {
    sourceId: "visa_india_japan_tourist",
    sourceType: "visa",
    title: "Japan Tourist Visa for Indian Citizens",
    content: `Indian passport holders require a visa to visit Japan. No visa on arrival or e-visa available.
Tourist Visa: Single entry, allows stays up to 15 or 30 days (as approved).
Fee: $25 USD (approximately).
Processing time: 5-7 business days (longer during peak seasons).
Required documents: Passport valid for duration of stay, completed visa application form, recent photograph, detailed travel itinerary, flight booking (return ticket), hotel reservations, bank statements (last 6 months showing sufficient funds), employment letter with salary details, income tax returns, sponsor guarantee letter if invited.
Japan has strict visa requirements - incomplete applications are rejected.
Apply at: Japan Embassy New Delhi, Consulates in Chennai, Kolkata, Mumbai, Bengaluru.
Important: Multiple entry visa available for frequent travelers with good travel history.`,
    fromCountry: "IN",
    toCountry: "JP",
    sourceName: "Embassy of Japan in India",
    sourceUrl: "https://www.in.emb-japan.go.jp",
  },

  // Singapore
  {
    sourceId: "visa_india_singapore",
    sourceType: "visa",
    title: "Singapore Visa Requirements for Indian Citizens",
    content: `Indian passport holders require a visa to visit Singapore.
Tourist Visa: Valid for 30 days from issue, allows stays up to 30 days.
E-Visa available: Apply online through authorized visa agents.
Fee: $30 SGD (approximately $22 USD).
Processing time: 3-5 business days for e-visa.
Required documents: Passport valid 6+ months beyond intended stay, completed visa application, recent digital photograph, travel itinerary, hotel booking, return flight booking, bank statements (last 3 months), employment letter.
Singapore has efficient visa processing - most tourist visas approved within 3 days.
Multiple entry visa: Available for frequent travelers, valid 2 years.
Apply through: Authorized Visa Agents, VFS Global, or Singapore Embassy directly.`,
    fromCountry: "IN",
    toCountry: "SG",
    sourceName: "Immigration & Checkpoints Authority Singapore",
    sourceUrl: "https://www.ica.gov.sg",
  },

  // UAE/Dubai
  {
    sourceId: "visa_india_uae",
    sourceType: "visa",
    title: "UAE Visa Requirements for Indian Citizens",
    content: `Indian passport holders require a visa to visit the UAE (Dubai, Abu Dhabi, etc.).
Tourist Visa options:
- 14-day visa: Single entry, $70-90 USD
- 30-day visa: Single entry, extendable once, $90-120 USD
- 90-day visa: Multiple entry, $180-220 USD
E-Visa available: Apply through airlines (Emirates, FlyDubai), hotels, or authorized agents.
Processing time: 3-4 business days (express 24-hour service available).
Required documents: Passport valid 6+ months, passport photo, confirmed flight booking, hotel reservation or invitation letter.
Important: US/UK/EU/Schengen visa holders with valid visa can get visa on arrival for 14 days.
UAE has relaxed visa rules - most tourist visas approved quickly.
Apply through: Emirates airline, hotels, authorized travel agents, ICA Smart Services.`,
    fromCountry: "IN",
    toCountry: "AE",
    sourceName: "Federal Authority for Identity and Citizenship UAE",
    sourceUrl: "https://icp.gov.ae",
  },

  // Indonesia/Bali
  {
    sourceId: "visa_india_indonesia",
    sourceType: "visa",
    title: "Indonesia (Bali) Visa for Indian Citizens",
    content: `Indian passport holders can obtain a Visa on Arrival (VOA) for Indonesia including Bali.
Visa on Arrival: Available at major airports and seaports.
Duration: 30 days, extendable once for another 30 days at local immigration office.
Fee: 500,000 IDR (approximately $35 USD), cash or card accepted.
Required documents: Passport valid 6+ months with 2 blank pages, proof of onward/return travel, proof of accommodation.
Processing: Instant at immigration counters (may have queues during peak season).
E-Visa also available: Apply online at molina.imigrasi.go.id before travel.
Important: Free visa waiver for 30 days is NOT available for Indian citizens.
For stays over 60 days: Social/Cultural visa required, apply at Indonesian Embassy.`,
    fromCountry: "IN",
    toCountry: "ID",
    sourceName: "Directorate General of Immigration Indonesia",
    sourceUrl: "https://www.imigrasi.go.id",
  },

  // Maldives
  {
    sourceId: "visa_india_maldives",
    sourceType: "visa",
    title: "Maldives Visa Requirements for Indian Citizens",
    content: `Indian passport holders enjoy visa-free entry to the Maldives!
Visa-free period: Up to 30 days on arrival.
No advance visa application required.
Cost: Free entry, no visa fee.
Required documents: Passport valid 6+ months, confirmed hotel booking, return flight ticket, sufficient funds for stay ($100-150 per day recommended).
Immigration process: Straightforward at Velana International Airport (Male).
Extension: Can extend up to 90 days at Maldives Immigration.
Important notes:
- All tourists must have confirmed resort/hotel booking
- Maldives is alcohol-restricted country (only resorts serve alcohol)
- Importing pork, religious materials, or alcohol is prohibited
Indian tourists are the second-largest visitor group to Maldives.`,
    fromCountry: "IN",
    toCountry: "MV",
    sourceName: "Maldives Immigration",
    sourceUrl: "https://immigration.gov.mv",
  },

  // Sri Lanka
  {
    sourceId: "visa_india_srilanka",
    sourceType: "visa",
    title: "Sri Lanka Visa for Indian Citizens",
    content: `Indian passport holders require a visa to visit Sri Lanka.
ETA (Electronic Travel Authorization): Available online.
Duration: 30 days, double entry, extendable up to 6 months.
Fee: $50 USD (was free until 2023, reintroduced).
Processing time: Usually approved within 24 hours.
Apply at: www.srilankaevisa.lk
Required documents: Passport valid 6+ months, travel itinerary, proof of funds.
Alternative: Visa on Arrival available but ETA recommended to avoid queues.
Important: Sri Lanka removed free visa for Indians in 2024 - now requires paid ETA.
For long stays: Residence visa categories available for business, employment, or retirement.`,
    fromCountry: "IN",
    toCountry: "LK",
    sourceName: "Sri Lanka Department of Immigration",
    sourceUrl: "https://www.immigration.gov.lk",
  },

  // Vietnam
  {
    sourceId: "visa_india_vietnam",
    sourceType: "visa",
    title: "Vietnam Visa Requirements for Indian Citizens",
    content: `Indian passport holders require a visa to visit Vietnam.
E-Visa: Single entry, valid 30 days, extendable.
Fee: $25 USD.
Processing time: 3 business days.
Apply at: evisa.xuatnhapcanh.gov.vn
Required documents: Passport scan, digital photo, travel dates, intended entry point.
Alternative: Visa on Arrival with pre-approved letter.
VOA requires: Approval letter from Vietnam Immigration (obtained via agency), 2 photos, $25-50 USD stamping fee.
Multiple entry visa: Available through embassy for 90 days.
Vietnam visa process is straightforward - e-visa recommended for single visits.
Entry points: All international airports and major land borders.`,
    fromCountry: "IN",
    toCountry: "VN",
    sourceName: "Vietnam Immigration Department",
    sourceUrl: "https://evisa.xuatnhapcanh.gov.vn",
  },

  // Malaysia
  {
    sourceId: "visa_india_malaysia",
    sourceType: "visa",
    title: "Malaysia Visa Requirements for Indian Citizens",
    content: `Indian passport holders require a visa to visit Malaysia.
eNTRI (Electronic Travel Registration & Information): For tourism only.
Duration: Single entry, max 15 days.
Fee: $20 USD.
Processing: Usually instant, max 24 hours.
Apply at: www.windowmalaysia.my
Alternative: eVISA for 30 days, $25 USD.
Required documents: Passport valid 6+ months, return flight ticket, hotel booking, sufficient funds.
Important: eNTRI only valid for entry via KLIA/KLIA2, Penang, Johor Bahru, Kuching, Kota Kinabalu airports.
For land border crossings: Regular visa required from Malaysian Embassy.
Malaysia is popular destination for Indian tourists - visa process is quick and efficient.`,
    fromCountry: "IN",
    toCountry: "MY",
    sourceName: "Immigration Department of Malaysia",
    sourceUrl: "https://www.imi.gov.my",
  },
];

/**
 * General destination information (not passport-specific).
 */
const GENERAL_DESTINATION_DOCS: SeedDocument[] = [
  {
    sourceId: "general_thailand_entry",
    sourceType: "entry_requirements",
    title: "Thailand Entry Requirements - General",
    content: `Thailand entry requirements for all visitors:
COVID-19: No longer requires vaccination proof or testing (as of 2023).
Passport: Must be valid for at least 6 months from entry date.
Health: Yellow fever vaccination certificate required if traveling from endemic areas.
Customs: Prohibited items include e-cigarettes/vapes, drugs, excessive currency (>$20,000 USD must be declared).
Currency: Thai Baht (THB). ATMs widely available. Credit cards accepted in cities.
Best time to visit: November-February (cool season).
Peak tourist season: December-January.
Official language: Thai (English widely spoken in tourist areas).`,
    fromCountry: "",
    toCountry: "TH",
    sourceName: "Tourism Authority of Thailand",
    sourceUrl: "https://www.tatnews.org",
  },
  {
    sourceId: "general_japan_entry",
    sourceType: "entry_requirements",
    title: "Japan Entry Requirements - General",
    content: `Japan entry requirements for all visitors:
Visit Japan Web: Required registration before arrival for customs declaration.
COVID-19: No vaccination or testing requirements (as of 2023).
Passport: Valid for duration of stay.
Health: No specific vaccinations required.
Customs: Strict on food imports, meat products prohibited.
Currency: Japanese Yen (JPY). Cash-based society - carry yen for smaller establishments.
JR Pass: Tourist rail pass must be purchased before arriving in Japan.
Best time to visit: March-May (cherry blossoms), October-November (autumn colors).
Official language: Japanese (limited English in rural areas).
Tipping: Not customary and may be considered rude.`,
    fromCountry: "",
    toCountry: "JP",
    sourceName: "Japan National Tourism Organization",
    sourceUrl: "https://www.japan.travel",
  },
];

async function ingestDocument(doc: SeedDocument): Promise<boolean> {
  try {
    const response = await fetch(`${KNOWLEDGE_API}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...doc,
        fromCountry: doc.fromCountry || null,
        toCountry: doc.toCountry || null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to ingest ${doc.sourceId}:`, error);
      return false;
    }

    const result = await response.json();
    console.log(`✓ Ingested: ${doc.sourceId} (${result.embeddingSource}, ${result.latencyMs}ms)`);
    return true;
  } catch (error) {
    console.error(`Error ingesting ${doc.sourceId}:`, error);
    return false;
  }
}

async function clearExistingDocs(): Promise<void> {
  const allDocs = [...INDIA_VISA_DOCS, ...GENERAL_DESTINATION_DOCS];
  for (const doc of allDocs) {
    try {
      await fetch(`${KNOWLEDGE_API}/documents/${doc.sourceId}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore errors - document may not exist
    }
  }
  console.log("Cleared existing documents");
}

async function main() {
  console.log("=== Seeding Knowledge Base ===\n");

  // Check if server is running
  try {
    const status = await fetch(`${KNOWLEDGE_API}/status`);
    if (!status.ok) {
      console.error("Knowledge API not available. Is the server running?");
      process.exit(1);
    }
    const statusData = await status.json();
    console.log(`Embedding service: ${statusData.embeddingService.source} (${statusData.embeddingService.model})`);
    console.log(`Current documents: ${statusData.documentCount}\n`);
  } catch {
    console.error("Cannot connect to server. Run: npm run dev");
    process.exit(1);
  }

  // Clear existing and seed fresh
  await clearExistingDocs();

  console.log("\n--- Seeding India Visa Documents ---");
  let successCount = 0;
  for (const doc of INDIA_VISA_DOCS) {
    if (await ingestDocument(doc)) successCount++;
  }

  console.log("\n--- Seeding General Destination Documents ---");
  for (const doc of GENERAL_DESTINATION_DOCS) {
    if (await ingestDocument(doc)) successCount++;
  }

  const total = INDIA_VISA_DOCS.length + GENERAL_DESTINATION_DOCS.length;
  console.log(`\n=== Seeding Complete: ${successCount}/${total} documents ===`);

  // Verify
  const finalStatus = await fetch(`${KNOWLEDGE_API}/status`).then(r => r.json());
  console.log(`Final document count: ${finalStatus.documentCount}`);
}

main().catch(console.error);
