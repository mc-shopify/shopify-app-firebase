export const meta = { title: 'Shopify App', description: 'Install and manage your Shopify app' }

export default function Home() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <h1>A short heading about [your app]</h1>
        <p>A tagline about [your app] that describes your value proposition.</p>
        <form method="get" action="/api/auth" style={{ margin: '24px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, textAlign: 'left' }}>
            <span>Shop domain</span>
            <input
              type="text"
              name="shop"
              placeholder="my-shop-domain.myshopify.com"
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
            />
          </label>
          <button type="submit" style={{ width: '100%', padding: 10, marginTop: 8 }}>
            Log in
          </button>
        </form>
        <ul style={{ textAlign: 'left' }}>
          <li><strong>Product feature</strong>. Some detail about your feature and its benefit to your customer.</li>
          <li><strong>Product feature</strong>. Some detail about your feature and its benefit to your customer.</li>
          <li><strong>Product feature</strong>. Some detail about your feature and its benefit to your customer.</li>
        </ul>
      </div>
    </div>
  )
}
