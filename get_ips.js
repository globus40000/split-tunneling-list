const dns = require("node:dns").promises;

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

const domains = [
  "google.com",
  "yandex.ru",
  "github.com",
  "microsoft.com",
  "youtube.com",
];

resolveWithPool(domains, 10).then(({ byDomain, allUniqueIps }) => {
  console.log("\n📊 RESULTS BY DOMAIN:");
  console.log(JSON.stringify(byDomain, null, 2));

  console.log("\n🌐 UNIQUE IP ADDRESSES:");
  console.log(allUniqueIps.join("\n"));
});

/*
Что дальше:
- Загрузка данных: Чтение списка урлов из текстового файла (urls.txt), где каждый урл с новой строки.
- Сохранение: Автоматическая запись результатов в файл ips.json в формате Amnezia.
*/
