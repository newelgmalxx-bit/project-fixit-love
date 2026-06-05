# Backend Fix — Commission Requests: Partner Info Missing

## Problem

`GET /api/admin/commission-requests` returns rows with
`partnerName / partnerEmail / partnerPhone = null`, e.g.:

```json
{
  "id": "da91eead-b721-4bbc-a724-524a095c96ce",
  "partnerId": "b91e0d43-0353-4734-8b02-dc8e5b2080c0",
  "partnerName": null,
  "partnerEmail": null,
  "partnerPhone": null
}
```

The frontend already falls back to `GET /api/admin/partners/{partnerId}` to
enrich the row, but that endpoint also fails:

```
GET /api/admin/partners/b91e0d43-0353-4734-8b02-dc8e5b2080c0
→ {"success":false,"message":"الشريك غير موجود"}
```

Investigation:

- The `partnerId` stored in `commission_requests` does NOT exist in the
  `partners` table (`/api/admin/partners` lists only 4 rows, none match).
- It also does NOT exist in `users` (`/api/admin/users/{id}` → not found).
- The notification row for the same partner uses the same orphan id
  (`/admin/partners/b91e0d43-...`), and the actual partner user
  "صالون اللمسة الراقية" lives in `users` under a totally different id:
  `0ef4c9ed-80f1-4afe-ae7e-49f80bf2a9bd`.

So the value being stored in `commission_requests.partner_id` (and in
`notifications.link`) is NOT a real `partners.id` or `users.id`. It looks
like an id generated at signup before the partner row is actually
persisted, or a stale id from a deleted/half-migrated partner.

## Required backend fixes

1. **Stop storing orphan partner ids.** When a partner submits a commission
   change request (or any notification is created), use the actual
   `partners.id` of an existing row. If the partner row is created
   lazily after package selection, defer creating the commission request
   until the partner row exists, and reference its real id.

2. **Backfill existing orphan rows.** For each
   `commission_requests.partner_id` that does not exist in `partners`:
   - Try to resolve via `users` (e.g. by email/phone captured at request
     time) and rewrite to the matching `partners.id`.
   - Rows that cannot be resolved should be soft-deleted or flagged so
     the admin UI does not show empty cards.

3. **Make `/api/admin/commission-requests` self-contained.** Update the
   SQL behind this endpoint to LEFT JOIN both `partners` AND `users`,
   so the response always includes the best-available name / email /
   phone / city even if the partner row was removed:

   ```sql
   SELECT cr.*,
          COALESCE(p.vendor_name_ar, p.name, u.name)  AS partner_name,
          COALESCE(p.email, u.email)                  AS partner_email,
          COALESCE(p.phone, u.phone)                  AS partner_phone,
          COALESCE(p.address, u.city)                 AS partner_city
   FROM commission_requests cr
   LEFT JOIN partners p ON p.id = cr.partner_id
   LEFT JOIN users    u ON u.id = COALESCE(p.user_id, cr.partner_id)
   ORDER BY cr.created_at DESC;
   ```

   Add `partnerCity` to the response payload alongside `partnerName`,
   `partnerEmail`, `partnerPhone` so the admin UI can display it
   without an extra request.

4. **Optional but recommended:** add a reverse-lookup endpoint
   `GET /api/admin/partners/by-user/{userId}` and / or include
   `userId` in the partner row, so the admin app can recover from
   future id mismatches without backend changes.

## Expected response shape after fix

```json
{
  "id": "da91eead-b721-4bbc-a724-524a095c96ce",
  "partnerId": "<real partners.id>",
  "partnerName": "صالون اللمسة الراقية",
  "partnerEmail": "info@saba-dwsign.com",
  "partnerPhone": "0505252525252",
  "partnerCity": "…",
  ...
}
```

Once this is returned, the existing admin UI
(`src/routes/admin.commission-requests.tsx`) will show the partner name,
owner / contact and city automatically — no frontend change needed.
