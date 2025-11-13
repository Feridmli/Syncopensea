/**
 * syncOpenseaOrders.js
 * OpenSea kolleksiyanızdakı NFT-ləri Seaport order-ları ilə backend-ə əlavə edir
 * Node.js ≥18 və ya node-fetch tələb olunur
 */

import fetch from "node-fetch";

// --- CONFIG ---
const BACKEND_URL = "https://sənin-app.onrender.com"; // Sizin backend URL
const NFT_CONTRACT_ADDRESS = "0x54a88333F6e7540eA982261301309048aC431eD5";
const PAGE_SIZE = 50; // OpenSea API limit
const OPENSEA_API_KEY = ""; // İstəsəniz OpenSea API Key qoyun rate-limit üçün

// --- HELPERS ---
async function fetchOpenseaAssets(offset = 0) {
  const url = `https://api.opensea.io/api/v1/assets?asset_contract_address=${NFT_CONTRACT_ADDRESS}&order_direction=desc&offset=${offset}&limit=${PAGE_SIZE}`;

  const headers = { "Accept": "application/json" };
  if (OPENSEA_API_KEY) headers["X-API-KEY"] = OPENSEA_API_KEY;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error("OpenSea API error:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    return data.assets || [];
  } catch (err) {
    console.error("Fetch OpenSea failed:", err);
    return [];
  }
}

async function postOrderToBackend(order) {
  try {
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const data = await res.json();
    if (!data.success) console.error("Backend error:", data);
    else console.log("✅ Order added:", order.tokenId);
  } catch (err) {
    console.error("POST /order failed:", err);
  }
}

// --- MAIN SYNC LOOP ---
async function main() {
  console.log("🚀 Sync started...");
  let offset = 0;

  while (true) {
    const assets = await fetchOpenseaAssets(offset);
    if (!assets.length) break;

    for (const nft of assets) {
      if (!nft.sell_orders || !nft.sell_orders.length) continue;

      for (const order of nft.sell_orders) {
        if (!order.protocol_data?.parameters) continue;

        const payload = {
          tokenId: nft.token_id,
          price: order.current_price ? parseFloat(order.current_price) / 1e18 : 0,
          sellerAddress: order.maker?.address || "unknown",
          seaportOrder: order.protocol_data,
          orderHash: order.order_hash || null,
          image: nft.image_url || nft.metadata?.image || null,
        };

        await postOrderToBackend(payload);
      }
    }

    offset += PAGE_SIZE;
  }

  console.log("✅ Sync tamamlandı!");
}

// --- RUN ---
main().catch(err => {
  console.error("Sync fatal error:", err);
});