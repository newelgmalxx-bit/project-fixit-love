# Backend bug — Creating an agreement wipes partner fields

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
