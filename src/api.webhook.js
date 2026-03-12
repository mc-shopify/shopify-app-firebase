import { shopify } from 'meowapps'

export async function POST(req, res) {
  if (req.rawBody) req.body = req.rawBody
  await shopify.processWebhooks({
    webhookHandlers: {
      APP_UNINSTALLED: { callback: handleAppUninstalled },
      APP_SCOPES_UPDATE: { callback: handleScopesUpdate },
      CUSTOMERS_DATA_REQUEST: { callback: handleGdpr },
      CUSTOMERS_REDACT: { callback: handleGdpr },
      SHOP_REDACT: { callback: handleGdpr },
    },
  })(req, res)
}

// ---------------------------------------------------------------------------

// Delete all sessions for the uninstalled shop.
async function handleAppUninstalled(topic, shop) {
  console.log(`Received ${topic} webhook for ${shop}`)
  const storage = shopify.config.sessionStorage
  const sessions = await storage.findSessionsByShop(shop)
  await storage.deleteSessions(sessions.map(s => s.id))
}

// Update session scopes when merchant changes permissions.
async function handleScopesUpdate(topic, shop, body) {
  console.log(`Received ${topic} webhook for ${shop}`)
  const storage = shopify.config.sessionStorage
  const sessions = await storage.findSessionsByShop(shop)
  for (const session of sessions) {
    session.scope = body.current?.toString()
    await storage.storeSession(session)
  }
}

// GDPR mandatory compliance — app stores no customer data, acknowledge only.
async function handleGdpr(topic, shop) {
  console.log(`Received ${topic} webhook for ${shop}`)
}
