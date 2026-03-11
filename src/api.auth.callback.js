import { shopify, cookieStorage } from 'meowapps'

export async function GET(req, res) {
  const cookie = await cookieStorage.load(req.query.shop)
  if (cookie) {
    req.headers.cookie = [req.headers.cookie, ...cookie.map(c => c.split(';')[0])].join('; ')
  }

  await shopify.auth.callback()(req, res, () => {})
  await cookieStorage.store(req.query.shop, res.getHeader('Set-Cookie'))
  await shopify.redirectToShopifyOrAppRoot()(req, res, () => {})
}
