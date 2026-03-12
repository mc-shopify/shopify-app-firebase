import { useState, useEffect } from 'react'
import { authenticate, BillingInterval } from 'meowapps'

export const meta = { title: 'Billing', description: 'Billing demo — subscription and one-time purchase' }

const EXAMPLE_CODE = `import { authenticate, BillingInterval } from 'meowapps'

export async function POST(req, res) {
  const { billing } = await authenticate(req, res)

  const sub = await billing.require({
    name: 'Starter',
    price: 5.00,
    interval: BillingInterval.Monthly,
    trialDays: 14,
    test: true,
  })

  if (!sub.active) return res.json(sub)
  res.json(sub)
}`

// --- UI --------------------------------------------------------------------

export default function BillingPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const rpc = async (body) => {
    setLoading(true)
    try {
      const res = await fetch('/app/billing.rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return await res.json()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { rpc({ action: 'check' }).then(setStatus) }, [])

  const subscribe = async (interval) => {
    const data = await rpc({ action: 'subscribe', interval })
    if (data.confirmationUrl) return open(data.confirmationUrl, '_top')
    setStatus(data)
    shopify.toast.show('Subscription is active')
  }

  return (
    <s-page heading="Billing demo">
      <s-section heading="Subscription status">
        {loading ? (
          <s-paragraph>Loading...</s-paragraph>
        ) : status?.active ? (
          <s-banner heading="Active" tone="success">
            <s-text>Plan: {status.name}</s-text>
            <s-text>Price: ${status.price}</s-text>
            {status.trialDays > 0 && <s-text>Trial: {status.trialDays} days</s-text>}
            {status.currentPeriodEnd && <s-text>Period ends: {new Date(status.currentPeriodEnd).toLocaleDateString()}</s-text>}
            <s-text>Test mode: {status.test ? 'Yes' : 'No'}</s-text>
            <s-button variant="tertiary" tone="critical" disabled={loading} onClick={async () => {
              await rpc({ action: 'cancel', id: status.id })
              setStatus({ active: false })
              shopify.toast.show('Subscription cancelled')
            }}>Cancel subscription</s-button>
          </s-banner>
        ) : (
          <s-banner heading="No active subscription" tone="warning">
            <s-text>Choose a plan below to get started.</s-text>
          </s-banner>
        )}
      </s-section>

      <s-section heading="Subscribe">
        <s-paragraph>
          These buttons call <code>billing.require()</code> with different intervals.
          All charges use test mode — no real billing.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => subscribe('monthly')} disabled={loading}>Monthly — $5</s-button>
          <s-button onClick={() => subscribe('annual')} disabled={loading}>Annual — $50</s-button>
          <s-button onClick={() => subscribe('oneTime')} variant="secondary" disabled={loading}>One-time — $10</s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <pre style={{ margin: 0, fontSize: 13 }}><code>{EXAMPLE_CODE}</code></pre>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="BillingInterval">
        <s-unordered-list>
          <s-list-item><code>Monthly</code> — every 30 days</s-list-item>
          <s-list-item><code>Annual</code> — yearly</s-list-item>
          <s-list-item><code>OneTime</code> — one-time purchase</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  )
}

// --- RPC -------------------------------------------------------------------

export async function POST(req, res) {
  const { billing } = await authenticate(req, res)
  const { action, interval } = req.body || {}

  if (action === 'check') return res.json(await billing.check())
  if (action === 'cancel') return res.json(await billing.cancel(req.body.id))

  const plans = {
    monthly: { name: 'Demo Monthly', price: 5.00, interval: BillingInterval.Monthly, trialDays: 7, test: true },
    annual: { name: 'Demo Annual', price: 50.00, interval: BillingInterval.Annual, trialDays: 7, test: true },
    oneTime: { name: 'Demo Feature', price: 10.00, interval: BillingInterval.OneTime, test: true },
  }

  const plan = plans[interval]
  if (!plan) return res.status(400).json({ error: 'Invalid interval' })

  res.json(await billing.require(plan))
}
