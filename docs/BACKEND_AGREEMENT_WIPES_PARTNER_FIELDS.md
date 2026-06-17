# Backend bug — Creating an agreement wipes partner fields

> **STATUS: NOT FIXED — reproduced again on 2026-06-17 08:09 UTC**
> Partner `72834de3-0044-4193-836d-aeb946399d5e` was wiped after
> `POST /api/admin/partners/72834de3-0044-4193-836d-aeb946399d5e/agreements`.
> `updatedAt` jumped from `2026-06-17 08:07:45` to `2026-06-17 08:09:09`.
> `commission_pct` / `deposit_pct` were set to `6/6` (intentional) but every
> other column (`vendor_name_ar`, `name`, `owner_name`, `email`, `phone`,
> `address`, `commercial_number`, `working_hours`, …) was overwritten with
> `''` / `NULL`. Whatever "fix" was deployed in `admin_14.php` is either NOT
> live on production or is being bypassed by another code path.

## What to verify on the server RIGHT NOW

1. `php -v` and `ls -la /home/u420244017/domains/koswmat.com/public_html/api/`
   — confirm which `admin_*.php` file is actually included by the active
   router. Print the file path with `error_log(__FILE__)` inside the agreement
   handler and trigger the endpoint; check the log.
2. Search ALL PHP files for any `UPDATE partners` or `save_partner(` /
   `updatePartner(` call reachable from the agreement create/update/resend
   routes:
   ```bash
   grep -RIn "UPDATE partners\|updatePartner\|save_partner\|partners\s*SET" \
     /home/u420244017/domains/koswmat.com/public_html/api/
   ```
   There MUST be exactly one statement under the agreement route, and it must
   touch only `commission_pct, deposit_pct, updated_at`.
3. Enable the MySQL general log for 60 seconds, hit the endpoint once, and
   paste every `UPDATE partners ...` statement that ran. That will prove
   which query is doing the damage.
4. Check for a DB trigger on `partner_agreements` that writes back to
   `partners`:
   ```sql
   SHOW TRIGGERS WHERE `Table` IN ('partner_agreements','partners');
   ```

## Reproduction payload (confirmed)

Before (`GET /api/admin/partners?...`):
```
id: 72834de3-...
vendorNameAr: "تيسست"
ownerName: "احمد الجمال"
email: "neweeeer@gmail.com"
phone: "0987654"
address: "دمياط"
commercialNumber: "987654"
workingHours: [7 days populated]
commissionPct: 10, depositPct: 25
updatedAt: 2026-06-17 08:07:45
```

Request:
```
POST /api/admin/partners/72834de3-0044-4193-836d-aeb946399d5e/agreements
{ "templateId":"fixed-tpl", "commissionPct":6, "depositPct":6,
  "customTitle":null, "customBody":null, "adminNotes":null }
```

After:
```
vendorNameAr: ""           ← wiped
ownerName: null            ← wiped
email: null                ← wiped
phone: null                ← wiped
address: null              ← wiped
commercialNumber: null     ← wiped
workingHours: null         ← wiped
commissionPct: 6, depositPct: 6   ← OK
updatedAt: 2026-06-17 08:09:09    ← proof the agreement endpoint wrote here
```

## Symptom

Before `POST /api/admin/partners/{partnerId}/agreements` the partner row is fine:

```json
{
  "id": "162801bf-...",
  "vendorNameAr": "مركز احمد",
  "name": "مركز احمد",
  "ownerName": "احمد",
  "email": "newelgmal7652@gmail.com",
  "phone": "09876543",
  "address": "دمياط",
  "commercialNumber": "345678987654",
  "workingHours": [ ... 7 days ... ],
  "commissionPct": 10,
  "depositPct": 25
}
```

After creating the agreement the SAME partner becomes:

```json
{
  "id": "162801bf-...",
  "vendorNameAr": "",
  "name": "",
  "ownerName": null,
  "email": null,
  "phone": null,
  "address": null,
  "commercialNumber": null,
  "workingHours": null,
  "commissionPct": 7,
  "depositPct": 7,
  "updatedAt": "2026-06-17 07:45:14"
}
```

Only `commissionPct` / `depositPct` were intentional (they match the new
agreement). Every other column was overwritten with empty string / NULL, and
`updatedAt` was bumped — proving the agreement endpoint did the damage.

## Cause

The agreement create/update handler (in `admin_12.php`) syncs `commission_pct`
and `deposit_pct` back to the `partners` table, but it does so with a generic
"save partner" routine that re-binds ALL partner columns from the incoming
request body. The body for this endpoint contains only `templateId`,
`commissionPct`, `depositPct`, `customTitle`, `customBody`, `adminNotes` — so
every missing key is coerced to `''` / `NULL`, blanking the partner row.

## Frontend payload (for reference)

`POST /api/admin/partners/{partnerId}/agreements` body sent by the admin panel:

```json
{
  "templateId": "fixed-tpl",
  "commissionPct": 7,
  "depositPct": 7,
  "customTitle": null,
  "customBody": null,
  "adminNotes": null
}
```

It does NOT and MUST NOT need to repeat `vendorNameAr`, `email`, `phone`,
`address`, `workingHours`, etc.

## Required fix

In the agreement endpoint, when syncing percentages to `partners`, touch ONLY
those two columns:

```sql
UPDATE partners
   SET commission_pct = :commissionPct,
       deposit_pct    = :depositPct,
       updated_at     = NOW()
 WHERE id = :partnerId;
```

Do NOT route through a generic "save partner" function that rewrites every
column from the request body. The same rule applies to:

- `PUT  /api/admin/partners/{id}/agreements/{agreementId}`
- `POST /api/admin/partners/{id}/agreements/{agreementId}/resend-email`

None of them should write any partner column other than the two percentages.

## Acceptance test

1. Create a new partner with full data (name, email, phone, address, hours).
2. `GET /api/admin/partners/{id}` — confirm fields are populated.
3. `POST /api/admin/partners/{id}/agreements` with only the body shown above.
4. `GET /api/admin/partners/{id}` again — every field except
   `commissionPct` / `depositPct` / `updatedAt` MUST be byte-identical to step 2.
