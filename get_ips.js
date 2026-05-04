const dns = require("node:dns").promises;

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), ms),
  );
  return Promise.race([promise, timeout]);
};

async function resolveWithPool(list, concurrency = 20) {
  const byDomain = {};
  const uniqueIps = new Set();
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < list.length) {
      const domain = list[currentIndex++];
      if (!domain) continue;

      try {
        const addresses = await withTimeout(dns.resolve4(domain), 5000);
        byDomain[domain] = addresses;
        addresses.forEach((ip) => uniqueIps.add(ip));
      } catch (err) {
        const reason = err.message === "TIMEOUT" ? "Request Timeout" : err.code;
        console.error(`❌ ${domain}: ${reason}`);
        byDomain[domain] = [];
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, list.length) },
    worker,
  );
  await Promise.all(workers);

  return {
    byDomain,
    allUniqueIps: Array.from(uniqueIps).sort(),
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
- Загрузка данных: Чтение списка доменов из текстового файла (.txt), где каждый домен с новой строки.
- Сохранение: Автоматическая запись результатов в файл results.json.
- Прогресс: Вывод в консоль строки вида Progress: 45/100 (45%), чтобы не смотреть в «пустой» экран при больших списках.
*/
