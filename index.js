const API_TOKEN = process.env.API_TOKEN;
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const RULE_ID = process.env.RULE_ID;
const YEAR = process.env.YEAR;
const MONTH = process.env.MONTH;

async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function verifyToken() {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  return fetchWithAuth(
    "https://api.cloudflare.com/client/v4/user/tokens/verify"
  );
}

async function getAdblockURLList() {
  if (!YEAR) throw new Error(`Error: YEAR is not set`);
  if (!MONTH) throw new Error(`Error: MONTH is not set`);

  const url = `https://280blocker.net/files/280blocker_domain_${YEAR}${(
    "0" + MONTH
  ).slice(-2)}.txt`;
  const response = await fetch(url);

  if (!response.ok) throw new Error(`Error fetching: ${response.statusText}`);

  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
}

async function getGatewayRules() {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  if (!ACCOUNT_ID) throw new Error(`Error: ACCOUNT_ID is not set`);

  try {
    await verifyToken();
    const rulesData = await fetchWithAuth(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/rules`
    );
    console.log("Gateway rules:", rulesData);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function putGatewayRules() {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  if (!ACCOUNT_ID) throw new Error(`Error: ACCOUNT_ID is not set`);
  if (!RULE_ID) throw new Error(`Error: RULE_ID is not set`);

  try {
    await verifyToken();
    const adblockURLList = await getAdblockURLList();

    const chunkSize = 200;
    const chunks = [];
    for (let i = 0; i < adblockURLList.length; i += chunkSize) {
      chunks.push(adblockURLList.slice(i, i + chunkSize));
    }

    const trafficConditions = chunks
      .map((chunk) => `dns.fqdn matches "(${chunk.join("|")})"`)
      .join(" or ");

    const ruleData = {
      action: "block",
      name: "AdBlock",
      enabled: true,
      traffic: trafficConditions,
    };

    const rulesData = await fetchWithAuth(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/rules/${RULE_ID}`,
      {
        method: "PUT",
        body: JSON.stringify(ruleData),
      }
    );

    console.log("Updated gateway rule:", rulesData);
  } catch (error) {
    console.error("Error:", error);
  }
}

// getGatewayRules();
putGatewayRules();
