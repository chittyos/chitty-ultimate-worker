# ChittyGateway

Unified Cloudflare Worker Gateway for ChittyOS

ChittyGateway consolidates all ChittyOS service endpoints into a single, modular Cloudflare Worker. It centralizes routing, session management, identity handling, and service bindings so every ChittyOS subsystem operates through one deterministic gateway layer.

## Features

* Unified API gateway for all ChittyOS Workers
* Structured service bindings and multi-worker routing
* Session and identity management (encrypted, stateless, worker-safe)
* Cloudflare-native edge execution
* CI/CD workflow with Neon branching
* Modular architecture for incremental service expansion

## Directory Structure

```
.github/workflows/   # Deployment and CI/CD pipelines  
scripts/             # Worker build + automation scripts  
src/                 # Gateway core, routing, and session engine  
wrangler.toml        # Worker configuration and bindings  
package.json         # Build + dependency metadata  
```

## Deployment

```
wrangler deploy
```

Ensure required service bindings are configured in `wrangler.toml`.

## Status

Active development. Expect rapid iteration as additional ChittyOS modules integrate.

## License

MIT
