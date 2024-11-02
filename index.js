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
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .filter((line) => {
      const isIPAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(line);
      if (isIPAddress) {
        console.log(`Excluded IP address: ${line}`);
      }
      return !isIPAddress;
    });
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

async function getAdblockList() {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  if (!ACCOUNT_ID) throw new Error(`Error: ACCOUNT_ID is not set`);

  try {
    await verifyToken();
    const listsData = await fetchWithAuth(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`
    );
    return listsData.result.filter((list) =>
      list.name.startsWith("AutoCreated_AdBlockList_")
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

async function deleteAdblockList() {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  if (!ACCOUNT_ID) throw new Error(`Error: ACCOUNT_ID is not set`);

  try {
    await verifyToken();
    const adblockLists = await getAdblockList();
    const deletePromises = adblockLists.map((list) =>
      fetchWithAuth(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists/${list.id}`,
        {
          method: "DELETE",
        }
      )
    );

    await Promise.all(deletePromises);
    console.log(`Deleted ${adblockLists.length} adblock lists`);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function postAdblockList(name, urls) {
  if (!API_TOKEN) throw new Error(`Error: API_TOKEN is not set`);
  if (!ACCOUNT_ID) throw new Error(`Error: ACCOUNT_ID is not set`);

  try {
    await verifyToken();
    const listData = {
      name,
      description: "Auto created adblock list",
      type: "DOMAIN",
      items: urls.map((url) => ({ value: url })),
    };

    return await fetchWithAuth(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/gateway/lists`,
      {
        method: "POST",
        body: JSON.stringify(listData),
      }
    );
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

    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < adblockURLList.length; i += chunkSize) {
      chunks.push(adblockURLList.slice(i, i + chunkSize));
    }

    await deleteAdblockList();
    const listName = `AutoCreated_AdBlockList_${new Date().toLocaleString()}_`;
    const results = await Promise.all(
      chunks.map(async (chunk, index) =>
        postAdblockList(listName + index.toString(), chunk)
      )
    );

    const ruleData = {
      action: "block",
      name: "AdBlock",
      enabled: true,
      traffic: results
        .map(({ result }) => `dns.fqdn in $${result.id}`)
        .join(" or "),
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
