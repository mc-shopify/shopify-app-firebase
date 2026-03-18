---
description: Add Shopify billing (subscriptions, one-time purchases) to your app. Provides tested canonical code and Shopify billing domain knowledge.
---

## What

Add Shopify billing (subscriptions, one-time purchases) to an app. Provides tested canonical code and Shopify billing domain knowledge.

## Why

Billing is security-sensitive and API-heavy. The canonical code below handles GraphQL queries, metafield sync, dev store detection, and webhook integration correctly. Shopify has no API for extensions to query billing — the `$app:plan` metafield is the only way to pass plan state to checkout/theme extensions.

## Who

App developers adding billing for the first time, or integrating billing with extensions.

## When

When adding billing, updating plans, or connecting billing state to checkout/theme extensions.

## Where

- `src/api.billing.js` — billing module (always created)
- `src/api.webhook.js` — webhook integration (only if extensions need plan awareness)
- `shopify.app.toml` — webhook topic registration
- Extension files — if user has extensions that need the active plan

## How

### Gather requirements

Ask these questions. Do NOT proceed until answers are clear enough to fully implement.

1. **Plans**: name, price, interval (monthly/annual/one-time), trial days for each plan.
2. **Extension support**: do checkout/theme extensions need to know the active plan?
3. **Billing UI**: do you want a billing page? Which page?

If user provides plans via $ARGUMENTS, parse them and skip question 1.

### Present plan and get approval

List what will be created/modified with the exact plan config. Wait for approval.

### Canonical code — `src/api.billing.js`

Tested, working code. Only change the `plans` config.

If no extension support: remove `export { checkBilling }`, the `checkBilling` function, and the `authenticateOffline` import.

```js
import { authenticate, authenticateOffline } from 'meowapps'

export { checkBilling }

const BillingInterval = Object.freeze({
  Monthly: 'EVERY_30_DAYS',
  Annual: 'ANNUAL',
  OneTime: 'ONE_TIME',
})

const plans = {
  // --- CUSTOMIZE PLANS HERE ---
  monthly: { name: 'Demo Monthly', price: 5.00, interval: BillingInterval.Monthly, trialDays: 7 },
  annual: { name: 'Demo Annual', price: 50.00, interval: BillingInterval.Annual, trialDays: 7 },
  oneTime: { name: 'Demo Feature', price: 10.00, interval: BillingInterval.OneTime },
}

// Route billing actions: check status, cancel, or create subscription.
export async function POST(req, res) {
  const { action, interval, id } = req.body || {}
  const { session, graphql } = await authenticate(req, res)
  const billing = createBilling(session.shop, graphql)

  if (action === 'check') return res.json(await billing.check())
  if (action === 'cancel') return res.json(await billing.cancel(id))

  const plan = plans[interval]
  if (!plan) return res.status(400).json({ error: 'Invalid interval' })
  res.json(await billing.require(plan))
}

// Sync $app:plan metafield for a shop (used by webhook handler).
async function checkBilling(shop) {
  const { graphql } = await authenticateOffline(shop)
  const billing = createBilling(shop, graphql)
  await billing.check()
}

// --- billing ---------------------------------------------------------------

// Billing helpers scoped to a shop. Supports subscriptions and one-time purchases.
// check() syncs $app:plan metafield so checkout extensions can read the active plan.
function createBilling(shop, graphql) {
  const storeHandle = shop.replace('.myshopify.com', '')
  const url = (path) => `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}${path}`
  let devStore = null

  return {
    // Query Shopify for active subscription and sync $app:plan metafield.
    async check() {
      const data = await graphql(`query { currentAppInstallation { activeSubscriptions {
        id name status test trialDays createdAt currentPeriodEnd
        lineItems { plan { pricingDetails {
          ... on AppRecurringPricing { price { amount currencyCode } interval }
        } } }
      } } shop { id plan { partnerDevelopment } metafield(namespace: "$app", key: "plan") { id value } } }`)

      devStore = data.shop?.plan?.partnerDevelopment ?? false

      const subs = data.currentAppInstallation?.activeSubscriptions || []
      const planMeta = data.shop?.metafield
      const planName = subs.length ? subs[0].name : null

      // Sync metafield to match billing state
      if (planName && planMeta?.value !== planName) {
        await graphql(`mutation ($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
        }`, { metafields: [{ namespace: '$app', key: 'plan', value: planName, type: 'single_line_text_field', ownerId: data.shop.id }] })
      } else if (!planName && planMeta) {
        await graphql(`mutation ($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { deletedMetafields { ownerId namespace key } userErrors { field message } }
        }`, { metafields: [{ ownerId: data.shop.id, namespace: '$app', key: 'plan' }] })
      }

      if (!subs.length) return { active: false, plan: null }
      return { active: true, plan: planName, ...mapSubscription(subs[0]) }
    },

    // Ensure active billing exists. Auto-enables test mode on dev stores.
    async require({ name, price, interval = BillingInterval.Monthly, trialDays = 0, returnUrl = '/app' }) {
      if (devStore === null) await this.check()

      const test = devStore
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

// Create a new subscription.
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
```

### Webhook integration (only if extension support)

Read the user's `src/api.webhook.js`. If it doesn't exist, copy from `node_modules/meowapps/src/api.webhook.js` first. Then add:

**Import:**
```js
import { checkBilling } from './api.billing.js'
```

**Handler registration** — add to `webhookHandlers`:
```js
APP_SUBSCRIPTIONS_UPDATE: { callback: handleSubscriptionUpdate },
```

**Handler function:**
```js
// Sync $app:plan metafield when subscription status changes.
async function handleSubscriptionUpdate(topic, shop) {
  console.log(`Received ${topic} webhook for ${shop}`)
  try {
    await checkBilling(shop)
  } catch (err) {
    console.error(`Failed to sync plan for ${shop}:`, err.message)
  }
}
```

**shopify.app.toml** — append to existing webhook topics:
```toml
topics = [ "app/uninstalled", "app/scopes_update", "app_subscriptions/update" ]
```

### Extension integration (only if user has extensions)

**Extension config** (`shopify.extension.toml`):
```toml
[[extensions.metafields]]
namespace = "$app"
key = "plan"
```

**Reading plan in extension code:**
```jsx
import { useAppMetafields } from '@shopify/ui-extensions-react/checkout'

function usePlan() {
  const [planMeta] = useAppMetafields({ namespace: '$app', key: 'plan', type: 'shop' })
  return planMeta?.metafield?.value ?? null
}
```

### Frontend API contract

`POST /api/billing` accepts JSON body:

| Action | Request body | Response |
|---|---|---|
| Check status | `{ action: 'check' }` | `{ active, plan, type, id, name, status, test, trialDays, createdAt, currentPeriodEnd, price }` or `{ active: false, plan: null }` |
| Subscribe | `{ interval: 'monthly' }` | `{ active: false, confirmationUrl }` — redirect via `open(url, '_top')` |
| Buy one-time | `{ interval: 'oneTime' }` | `{ active: false, confirmationUrl }` or `{ active: true, ... }` if already purchased |
| Cancel | `{ action: 'cancel', id }` | `{ status: 'CANCELLED' }` |

### Domain knowledge

- `$app:plan` metafield is the ONLY way to pass billing state to checkout/theme extensions. Must use `$app` format — fully qualified `app--{id}--{namespace}` is NOT supported in extensions.
- `check()` syncs the metafield: sets it to the active subscription name, or deletes it if no subscription.
- `devStore` detection auto-enables `test: true` on partner development stores.
- One-time purchases cannot be cancelled via API — only subscriptions can.
- Billing APIs do not require additional OAuth scopes.
- The `plans` keys (e.g. `monthly`, `annual`) are the `interval` values sent from the frontend.
- Price currency is hardcoded to `'USD'`. Change `currencyCode` for other currencies.
- The metafield reflects active subscription name only. One-time purchases are not synced to it.

$ARGUMENTS
