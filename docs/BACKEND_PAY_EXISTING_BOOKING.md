# Backend Endpoint Needed: POST /bookings/{bookingId}/pay

Re-initiates a MyFatoorah hosted payment for an EXISTING booking (instead of creating a duplicate booking via `/checkout`).

## Request
`POST /bookings/{bookingId}/pay`

Body (JSON, optional):
```json
{ "paymentMethodId": 6 }   // 2=visa, 6=mada, 11=applepay, 12=stcpay; omit for hosted page
```

`bookingId` may be the internal UUID OR the booking number (e.g. `BK-DXECMR`).

## Behavior
1. Lookup booking by id/qr_code. 404 if not found.
2. If `payment_status` already `paid` → return 409 with `{ message: "الحجز مدفوع بالفعل" }`.
3. Recompute `amount = deposit_amount` (or `total` if no deposit), in SAR, rounded to 2 decimals.
4. Call `createMyfatoorahInvoiceForBooking($booking['id'], $booking['qr_code'], $amount, name, email, phone, $paymentMethodId)`.
5. On success, UPDATE `bookings SET invoice_id=?, payment_method='myfatoorah', updated_at=NOW() WHERE id=?`.
6. Respond:
```json
{
  "success": true,
  "data": {
    "bookingId": "<uuid>",
    "bookingNumber": "BK-DXECMR",
    "depositAmount": 14.9,
    "paymentUrl": "https://...",
    "invoiceId": "1234567"
  }
}
```

## Route registration (PHP, drop into checkout routes file)
```php
if ($method === 'POST' && preg_match('#^/bookings/([^/]+)/pay$#', $path, $m)) {
    $idOrNo = $m[1];
    $st = db()->prepare("SELECT * FROM bookings WHERE id=? OR qr_code=? LIMIT 1");
    $st->execute([$idOrNo, $idOrNo]);
    $bk = $st->fetch();
    if (!$bk) error('الحجز غير موجود', 404);
    if (($bk['payment_status'] ?? '') === 'paid') error('الحجز مدفوع بالفعل', 409);

    $b = body();
    $pmId = isset($b['paymentMethodId']) && ctype_digit((string)$b['paymentMethodId'])
        ? (int)$b['paymentMethodId'] : null;

    $amount = round((float)($bk['deposit_amount'] ?: $bk['total']), 2);
    if ($amount <= 0) error('قيمة الدفع غير صالحة', 422);

    $invoice = createMyfatoorahInvoiceForBooking(
        $bk['id'], $bk['qr_code'], $amount,
        $bk['customer_name'], $bk['customer_email'], $bk['customer_phone'], $pmId
    );
    if (!$invoice) error('تعذّر الاتصال ببوابة الدفع', 503);

    $payUrl    = $invoice['Data']['PaymentURL'] ?? $invoice['Data']['InvoiceURL'] ?? null;
    $invoiceId = (string)($invoice['Data']['InvoiceId'] ?? '');
    if (!$payUrl) error('تعذّر الحصول على رابط الدفع', 503);

    db()->prepare("UPDATE bookings SET invoice_id=?, payment_method='myfatoorah', updated_at=NOW() WHERE id=?")
        ->execute([$invoiceId, $bk['id']]);

    success([
        'bookingId'     => $bk['id'],
        'bookingNumber' => $bk['qr_code'],
        'depositAmount' => $amount,
        'paymentUrl'    => $payUrl,
        'invoiceId'     => $invoiceId,
    ]);
    exit;
}
```
