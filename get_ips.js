const dns = require("node:dns").promises;
const fs = require("node:fs").promises;

async function getDomainsFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const urls = content.split("\n");
    const domains = new Set();

    for (const url of urls) {
      if (url !== "") {
        const { hostname } = new URL(url);

        if (hostname) {
          domains.add(hostname);
        }
      }
    }

    return Array.from(domains);
  } catch (err) {
    console.error(`💥 Error reading file ${filePath}:`, err.message);
    process.exit(1);
  }
}

const sortIps = (ips) => {
  return [...ips].sort((a, b) => {
    const octetsA = a.split(".").map(Number);
    const octetsB = b.split(".").map(Number);

    for (let i = 0; i < 4; i++) {
      if (octetsA[i] !== octetsB[i]) {
        return octetsA[i] - octetsB[i];
      }
    }
    return 0;
  });
};

async function resolveWithPool(domains, concurrency = 20) {
  const byDomain = {};
  const uniqueIps = new Set();
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < domains.length) {
      const domain = domains[currentIndex++];
      if (!domain) continue;

      try {
        const addresses = await dns.resolve4(domain, {
          signal: AbortSignal.timeout(5000),
        });

        byDomain[domain] = addresses;
        addresses.forEach((ip) => uniqueIps.add(ip));
      } catch (err) {
        const reason = err.name === "AbortError" ? "Request Timeout" : err.code;
        console.error(`❌ ${domain}: ${reason}`);
        byDomain[domain] = [];
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, domains.length) },
    worker,
  );

  await Promise.all(workers);

  return {
    byDomain,
    allUniqueIps: sortIps(Array.from(uniqueIps)),
  };
}

async function saveToAmneziaFormat(ips, outputFilePath) {
  const amneziaFormat = ips.map((ip) => ({
    hostname: `${ip}/32`,
    ip: "",
  }));

  try {
    console.log(`\n💾 Saving Amnezia config to ${outputFilePath}...`);

    const jsonString = JSON.stringify(amneziaFormat, null, 4);
    const escapedJsonString = jsonString.replace(/\//g, "\\/");

    await fs.writeFile(outputFilePath, escapedJsonString, "utf-8");
    console.log("✅ File saved successfully!");
  } catch (err) {
    console.error(`💥 Error writing file ${outputFilePath}:`, err.message);
  }
}

async function main() {
  const filePath = "urls.txt";
  const outputFilePath = "ips.json";

  console.log(`📖 Reading URLs from ${filePath}...`);

  const domains = await getDomainsFromFile(filePath);
  console.log(`🔍 Found ${domains.length} unique domains to check:`);
  console.log(domains.map((d) => `  - ${d}`).join("\n"));

  if (domains.length === 0) {
    console.log("⚠️ File is empty or contains no valid URLs.");
    return;
  }

  console.log(`\n🚀 Resolving IP addresses...`);
  const { byDomain, allUniqueIps } = await resolveWithPool(domains, 10);

  console.log("\n📊 RESULTS BY DOMAIN:");
  console.log(JSON.stringify(byDomain, null, 2));

  console.log("\n🌐 UNIQUE IP ADDRESSES:");
  console.log(allUniqueIps.join("\n"));

  await saveToAmneziaFormat(allUniqueIps, outputFilePath);
}

main();
