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
export const BillingInterval = Object.freeze({
  Monthly: 'EVERY_30_DAYS',
  Annual: 'ANNUAL',
  OneTime: 'ONE_TIME',
})

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

// Authenticate a request via Shopify middleware, return session + graphql + billing helpers.
async function authenticateFn(req, res) {
  await new Promise((resolve, reject) => {
    shopify.validateAuthenticatedSession()(req, res, (err) => {
      if (err) reject(err); else resolve()
    })
  })

  const session = res.locals.shopify?.session
  if (!session) throw new Error('Unauthorized')

  const client = new shopify.api.clients.Graphql({ session })
  const graphql = async (query, variables) => {
    const { data, errors } = await client.request(query, { variables })
    if (errors) throw new Error(errors.map(e => e.message).join(', '))
    return data
  }

  return { session, graphql, billing: createBilling(session.shop, graphql) }
}

// --- billing ---------------------------------------------------------------

// Billing helpers scoped to a shop. Supports subscriptions and one-time purchases.
// All methods query Shopify directly as source of truth — no Firestore cache.
function createBilling(shop, graphql) {
  // Billing returnUrl must go through admin.shopify.com so Shopify injects session context
  const storeHandle = shop.replace('.myshopify.com', '')
  const url = (path) => `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}${path}`

  return {
    // Query Shopify for active subscription status.
    async check() {
      const data = await graphql(`query { currentAppInstallation { activeSubscriptions {
        id name status test trialDays createdAt currentPeriodEnd
        lineItems { plan { pricingDetails {
          ... on AppRecurringPricing { price { amount currencyCode } interval }
        } } }
      } } }`)
      const subs = data.currentAppInstallation?.activeSubscriptions || []
      if (!subs.length) return { active: false }
      return { active: true, ...mapSubscription(subs[0]) }
    },

    // Ensure active billing exists. Queries Shopify, or creates a new charge if none found.
    // Returns { active: true, ...record } or { active: false, confirmationUrl }.
    async require({ name, price, interval = BillingInterval.Monthly, trialDays = 0, test = false, returnUrl = '/app' }) {
      return interval === BillingInterval.OneTime
        ? requireOneTime(graphql, { name, price, test, returnUrl: url(returnUrl) })
        : requireSubscription(graphql, { name, price, interval, trialDays, test, returnUrl: url(returnUrl) })
    },

    // Cancel active subscription. One-time purchases cannot be cancelled via API.
    async cancel(id, { prorate = true } = {}) {
      if (!id.includes('AppSubscription')) return { status: 'CANCELLED' }

      const result = await graphql(`mutation ($id: ID!, $prorate: Boolean) {
        appSubscriptionCancel(id: $id, prorate: $prorate) {
          appSubscription { id status }
          userErrors { field message }
        }
      }`, { id, prorate })

      const { userErrors } = result.appSubscriptionCancel
      if (userErrors?.length) throw new Error(userErrors.map(e => e.message).join(', '))
      return { status: 'CANCELLED' }
    },
  }
}

// Map Shopify AppSubscription object to a flat record.
function mapSubscription(s) {
  const pricing = s.lineItems?.[0]?.plan?.pricingDetails
  return {
    type: 'subscription',
    id: s.id, name: s.name, status: s.status, test: s.test,
    trialDays: s.trialDays, createdAt: s.createdAt,
    currentPeriodEnd: s.currentPeriodEnd,
    price: parseFloat(pricing?.price?.amount || 0),
  }
}

// Create a new subscription. Always creates — caller decides whether to call this.
async function requireSubscription(graphql, { name, price, interval, trialDays, test, returnUrl }) {
  const result = await graphql(`mutation ($name: String!, $returnUrl: URL!,
    $lineItems: [AppSubscriptionLineItemInput!]!, $trialDays: Int, $test: Boolean) {
    appSubscriptionCreate(name: $name, returnUrl: $returnUrl,
      lineItems: $lineItems, trialDays: $trialDays, test: $test) {
      confirmationUrl
      userErrors { field message }
    }
  }`, {
    name, trialDays, test, returnUrl,
    lineItems: [{
      plan: {
        appRecurringPricingDetails: {
          price: { amount: price, currencyCode: 'USD' },
          interval,
        }
      },
    }],
  })

  return extractConfirmation(result.appSubscriptionCreate)
}

// Query one-time purchases by name, or create a new one.
async function requireOneTime(graphql, { name, price, test, returnUrl }) {
  // oneTimePurchases returns all historical purchases — filter by name and ACTIVE status
  const data = await graphql(`query ($first: Int!) { currentAppInstallation {
    oneTimePurchases(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes { id name status test price { amount currencyCode } createdAt }
    }
  } }`, { first: 25 })
  const match = data.currentAppInstallation?.oneTimePurchases?.nodes
    ?.find(p => p.name === name && p.status === 'ACTIVE')

  if (match) {
    return {
      active: true, type: 'one_time',
      id: match.id, name: match.name, status: match.status, test: match.test,
      price: parseFloat(match.price?.amount || 0), createdAt: match.createdAt,
    }
  }

  const result = await graphql(`mutation ($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
    appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
      confirmationUrl
      userErrors { field message }
    }
  }`, { name, test, returnUrl, price: { amount: price, currencyCode: 'USD' } })

  return extractConfirmation(result.appPurchaseOneTimeCreate)
}

// Extract confirmationUrl or throw on userErrors.
function extractConfirmation(payload) {
  if (payload.userErrors?.length) throw new Error(payload.userErrors.map(e => e.message).join(', '))
  return { active: false, confirmationUrl: payload.confirmationUrl }
}

// --- utility ---------------------------------------------------------------

// Defers object creation until first property access via Proxy.
function lazy(init) {
  let instance
  return new Proxy({}, { get: (_, prop) => (instance ??= init())[prop] })
}
