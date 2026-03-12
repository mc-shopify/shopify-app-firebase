import { shopify, cookieStorage } from 'meowapps'

// Complete OAuth flow: restore cookies, validate callback, then redirect to app root.
export async function GET(req, res) {
  const shop = req.query.shop
  const cookie = await cookieStorage.load(shop)

  // Restore OAuth state cookies that Firebase Cloud Functions strips on cold start
  if (cookie) {
    req.headers.cookie = [req.headers.cookie, ...cookie.map(c => c.split(';')[0])].join('; ')
  }

  await shopify.auth.callback()(req, res, () => {})
  await cookieStorage.store(shop, res.getHeader('Set-Cookie'))
  await shopify.redirectToShopifyOrAppRoot()(req, res, () => {})
}
