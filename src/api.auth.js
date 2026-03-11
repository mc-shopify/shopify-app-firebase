import { shopify, cookieStorage } from 'meowapps'

export async function GET(req, res) {
  await shopify.auth.begin()(req, res, () => {})
  await cookieStorage.store(req.query.shop, res.getHeader('Set-Cookie'))
}
