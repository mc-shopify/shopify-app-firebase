export default function AppLayout({ children }) {
  if (!new URLSearchParams(location.search).get('shop')) {
    return <p>This app must be accessed through the Shopify Admin.</p>
  }

  return (
    <>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
      </s-app-nav>
      {children}
    </>
  )
}
