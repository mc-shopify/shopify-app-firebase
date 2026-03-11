'use server'

import { shopifyApp } from '@shopify/shopify-app-express'
import { ApiVersion, Session } from '@shopify/shopify-api'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()

// Lazy init: created on first property access so SHOPIFY_API_SECRET
// can be set after module load (e.g. by emulator).
export const shopify = lazy(createShopifyApp)
export const cookieStorage = createCookieStorage()
export const authenticate = authenticateFn

// --- shopify ---------------------------------------------------------------

// Configure Shopify app with session storage, API credentials, and route paths.
function createShopifyApp() {
  return shopifyApp({
    sessionStorage: createSessionStorage(),
    api: {
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET,
      scopes: process.env.SHOPIFY_SCOPES?.split(',') || [],
      hostName: process.env.SHOPIFY_HOST_NAME,
      apiVersion: ApiVersion.October25,
    },
    auth: { path: '/api/auth', callbackPath: '/api/auth/callback' },
    webhooks: { path: '/api/webhook' },
  })
}

// --- storage ---------------------------------------------------------------

// Shopify session persistence backed by Firestore.
// Collection access is lazy so Firestore client is only created when needed.
function createSessionStorage() {
  const col = lazy(() => getFirestore().collection('shopify-sessions'))
  return {
    async storeSession(session) { await col.doc(session.id).set(session.toObject()); return true },
    async loadSession(id) { const d = await col.doc(id).get(); return d.exists ? new Session(d.data()) : undefined },
    async deleteSession(id) { await col.doc(id).delete(); return true },
    async deleteSessions(ids) { await Promise.all(ids.map(id => col.doc(id).delete())); return true },
    async findSessionsByShop(shop) { return (await col.where('shop', '==', shop).get()).docs.map(d => new Session(d.data())) },
  }
}

// OAuth cookie persistence backed by Firestore.
function createCookieStorage() {
  const col = lazy(() => getFirestore().collection('shopify-cookies'))
  return {
    async store(shop, cookie) { await col.doc(shop).set({ cookie }) },
    async load(shop) { const d = await col.doc(shop).get(); return d.exists ? d.data().cookie : undefined },
    async delete(shop) { await col.doc(shop).delete() },
  }
}

// --- auth ------------------------------------------------------------------

// Authenticate a request via Shopify middleware, return session + graphql helper.
async function authenticateFn(req, res) {
  await new Promise((resolve, reject) => {
    shopify.validateAuthenticatedSession()(req, res, (err) => {
      if (err) reject(err); else resolve()
    })
  })

  const session = res.locals.shopify?.session
  if (!session) throw new Error('Unauthorized')

  const client = new shopify.api.clients.Graphql({ session })
  return {
    session,
    graphql: async (query, variables) => {
      const { data, errors } = await client.request(query, { variables })
      if (errors) throw new Error(errors.map(e => e.message).join(', '))
      return data
    },
  }
}

// --- utility ---------------------------------------------------------------

// Defers object creation until first property access via Proxy.
function lazy(init) {
  let instance
  return new Proxy({}, { get: (_, prop) => (instance ??= init())[prop] })
}
