# Expose per-partner commission/deposit %

The frontend needs the booking deposit % to be per merchant/offer, but
currently the public endpoints only return:

- `GET /api/offers/{id}` → `commissionPctOverride: null` (always null)
- `GET /api/partners/{id}` → no `commission_pct` / `deposit_pct` field at all

So the UI is forced to fall back to a hardcoded 10% for every center.

## Please add

1. **`GET /api/partners/{id}`** — include the partner's effective values:
   ```json
   {
     "commission_pct": 5,
     "deposit_pct": 5
   }
   ```
   (snake_case is fine — the frontend already accepts both cases.)

2. **`GET /api/offers/{id}` and `GET /api/offers`** — keep
   `commissionPctOverride` and also return the resolved value when the
   offer has its own override, e.g.:
   ```json
   {
     "commissionPctOverride": 7,
     "commission_pct": 7
   }
   ```
   If no override exists, return the partner's value so the client doesn't
   need a second request just to compute the deposit.

## Frontend resolution order

The normalizer reads, in order:
`offer.commissionPctOverride` → `offer.commission_pct` →
`partner.commission_pct`.

There is intentionally **no fixed 10% fallback** anymore. If the backend does
not return a center/offer percentage, the storefront will show the deposit as
unavailable and block checkout instead of charging a wrong amount.

Once the backend returns the field, the deposit shown on the offer page
(`عربون الحجز`) will correctly reflect each merchant's agreed rate.