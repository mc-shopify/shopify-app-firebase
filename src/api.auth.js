import { shopify, cookieStorage } from 'meowapps'

// Begin OAuth flow, storing the Set-Cookie header for the callback step.
export async function GET(req, res) {
  await shopify.auth.begin()(req, res, () => {})
  await cookieStorage.store(req.query.shop, res.getHeader('Set-Cookie'))
}
