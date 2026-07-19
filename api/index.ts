// Vercel's SPA fallback rewrites `/api/:path*` to this stable Function route.
// Keep the request implementation in the catch-all entry so direct Function
// routing and the explicit rewrite share exactly the same security behavior.
import catchAllHandler from "./[...path].js";

export default catchAllHandler;
