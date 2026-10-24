# Private Linux deployment

Run on Ubuntu 24.04 with persistent storage. Both application listeners bind only
to loopback. Tailscale Serve supplies HTTPS and authenticated identity. Never use
Tailscale Funnel or open public application ports.

Install this repository at `/opt/afterboard/app`, create the locked `afterboard` service
account, and create `/etc/afterboard/app.env` from `app.env.example`. Keep that file
root-owned, mode 0600. State lives at `/var/lib/afterboard`, owned by `afterboard`, mode
0700. Install the service units from this directory into `/etc/systemd/system/`.

Install Node.js 24 LTS from the official NodeSource repository; run `npm ci` and `npm run build`.

Start the services with systemd and enable them at boot. Configure the server's
Tailscale identity as `personal-apps`, authenticated to your own account. Then:

```sh
tailscale serve --bg --https=8443 http://127.0.0.1:8891
```

Afterboard uses its existing `/chess/` URL on port 8443.
Set `TAILSCALE_OWNER` to your Tailscale login; the application/bridge rejects
missing and different identities, even if other tailnet members can reach it.
Only Tailscale Serve should connect to these loopback ports. Do not share server
shell access with people who should not access app data.

Validate dashboard, POST token checks, saved state after restart, wrong-identity
403 responses, and a failed connection to public ports before retiring the laptop
setup. Keep the original laptop data until migration is verified. Use SQLite's
online backup API for a consistent migration snapshot rather than copying a live
database file. Keep credentials and data out of Git and out of web roots.

Garmin may challenge or reject cloud IP logins. Authenticate from the dashboard
after credentials are configured privately. A successful home-network login
does not guarantee a cloud login succeeds.
