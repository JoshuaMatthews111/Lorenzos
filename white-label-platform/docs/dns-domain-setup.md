# Trainer Custom Domain Setup

Each trainer can use a default Lorenzo URL first, then connect a personal business domain when ready.

## Trainer Steps

1. Buy or open the domain in the DNS provider.
2. Add the domain inside the Lorenzo trainer site dashboard.
3. Copy the DNS records shown by the dashboard.
4. Add the records at the DNS provider.
5. Wait for verification.
6. Set the custom domain as primary after it verifies.

## DNS Records

The system will generate records like this:

| Type | Host | Value | Purpose |
| --- | --- | --- | --- |
| TXT | `_lorenzo-verify.example.com` | generated token | Proves the trainer controls the domain |
| CNAME | `www.example.com` | `trainer-sites.lorenzosdogtrainingteam.com` | Sends the www domain to the landing page |
| ALIAS/ANAME or A | `example.com` | platform target | Sends the root domain to the landing page |

## Recommended Client Wording

Your trainer site can go live on a Lorenzo preview URL first. When your domain is ready, add the DNS records provided in your dashboard. Once verified, your domain will show your white-labeled landing page and send new lead requests directly into your trainer dashboard.

## Important Notes

- DNS changes can take minutes or several hours depending on the provider.
- Use `www` as the easiest setup path.
- The root domain may require `ALIAS`, `ANAME`, or an `A` record depending on the host platform.
- Do not point more than one active trainer site to the same domain.

