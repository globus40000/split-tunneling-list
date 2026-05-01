const fs = require("fs");
const dns = require("dns").promises;
const { URL } = require("url");

const URLS_FILE = "urls.txt";

async function main() {
  try {
    const data = fs.readFileSync(URLS_FILE, "utf8");
    const urls = data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const domains = new Set();
    urls.forEach((rawUrl) => {
      try {
        const parsed = new URL(rawUrl);
        domains.add(parsed.hostname);
      } catch (error) {
        console.error(`Invalid URL skipped: ${rawUrl}`);
      }
    });

    const uniqueDomains = Array.from(domains).sort();
    const uniqueIps = new Set();

    for (const domain of uniqueDomains) {
      try {
        const addresses = await dns.lookup(domain, { all: true });
        const ips = addresses.map((addr) => addr.address);
        ips.forEach((ip) => uniqueIps.add(ip));
        console.log(`${domain}: ${ips.join(", ")}`);
      } catch (error) {
        console.error(`Failed to resolve ${domain}: ${error.message}`);
      }
    }

    console.log("\nUnique IPs:");
    Array.from(uniqueIps)
      .sort()
      .forEach((ip) => console.log(ip));
  } catch (error) {
    console.error("Error reading urls.txt:", error.message);
  }
}

main();
