# مطلوب تعديل في ملف public.php

الهدف: إصلاح إرجاع نسبة العمولة/العربون لكل مركز (partner) في endpoints العروض والشركاء، وإصلاح endpoint دفع حجز موجود.

---

## 0) حفظ نسبة الاتفاقية تلقائياً على جدول `partners`

**المشكلة الحالية:** لما الأدمن يكتب نسبة العمولة/العربون/الديبوست أثناء إصدار أو تعديل اتفاقية مركز، النسبة بتتحفظ في جدول الاتفاقيات فقط، ومش بتتخزن في جدول `partners` داخل أعمدة `commission_pct` و `deposit_pct`.

**المطلوب:** في ملف admin backend، عند أي endpoint يستقبل `commissionPct` أو `depositPct` لاتفاقية مركز، لازم تعمل تحديث لنفس المركز في جدول `partners`.

Endpoints المقصودة:
- `POST /api/admin/partners/{partnerId}/agreements`
- `PUT /api/admin/partners/{partnerId}/agreements/{agreementId}`
- وأي endpoint تاني بيصدر/يعدل اتفاقية وفيه النسب دي.

القواعد:
- عندنا في السيستم `commissionPct` و `depositPct` نفس المعنى/نفس الرقم غالباً: نسبة العربون/الديبوست/الكوميشن.
- لو الأدمن بعت رقم واحد فقط، خزّنه في العمودين: `partners.commission_pct` و `partners.deposit_pct`.
- ممنوع fallback لـ `0` أو `10` وقت الحفظ. لو القيمة مش مبعوتة متغيرش القيم القديمة.
- لو القيمة مبعوتة لازم تكون `> 0` و `<= 100`.

مثال PHP مطلوب بعد حفظ الاتفاقية بنجاح:

```php
$commissionPct = $input['commissionPct'] ?? $input['commission_pct'] ?? null;
$depositPct    = $input['depositPct'] ?? $input['deposit_pct'] ?? $commissionPct;

if ($commissionPct !== null || $depositPct !== null) {
    $rate = $depositPct ?? $commissionPct;
    $rate = (float) $rate;

    if ($rate <= 0 || $rate > 100) {
        return response()->json([
            'error' => 'invalid_partner_rate',
            'message' => 'نسبة العمولة/العربون غير صحيحة',
        ], 422);
    }

    $stmt = $pdo->prepare(
        "UPDATE partners
         SET commission_pct = ?, deposit_pct = ?, updated_at = NOW()
         WHERE id = ?"
    );
    $stmt->execute([$rate, $rate, $partnerId]);
}
```

بعد التعديل، اختبر:
1. الأدمن يصدر اتفاقية بنسبة `13`.
2. اعمل Query:
   ```sql
   SELECT commission_pct, deposit_pct FROM partners WHERE id = 'PARTNER_ID';
   ```
3. لازم الاتنين يبقوا `13.00`.

---

## 1) دالة `transformPublicPartnerRow` (حوالي السطر 1608)

**المشكلة الحالية:** بترجّع `commission_pct` و `deposit_pct` بقيمة `0.0` لما تكون مش موجودة في الداتابيز. ده بيخلي الفرونت يحسبها صفر بالغلط.

**المطلوب:**
- أرجع القيم زي ما هي من جدول `partners` بدون أي fallback.
- لو الحقل `NULL` في الداتابيز، رجّع `null` (مش `0` ولا `0.0`).

```php
// داخل return array الخاص بـ transformPublicPartnerRow
'commission_pct' => isset($row['commission_pct']) && $row['commission_pct'] !== null
    ? (float) $row['commission_pct']
    : null,
'deposit_pct'    => isset($row['deposit_pct']) && $row['deposit_pct'] !== null
    ? (float) $row['deposit_pct']
    : null,
```

تأكد إن الـ SQL query بيـ SELECT الحقلين دول (لو بتستخدم `p.*` يبقى تمام، لو محدّد أعمدة ضيفهم).

---

## 2) دالة `offerTransformer` (حوالي السطر 1069) — endpoints: `GET /offers` و `GET /offers/{id}`

**المشكلة الحالية:**
- بترجّع `commission_pct` من `commission_pct_override` بس، اللي غالبًا `null`.
- مش بترجّع `deposit_pct` خالص.

**المطلوب:** لو `commission_pct_override` فاضي/`null`، اعمل lookup لجدول `partners` وارجع نسبة المركز نفسه. وكمان رجّع `deposit_pct` بنفس المنطق.

```php
// كاش static لتجنّب تكرار الاستعلام في نفس الـ request
static $partnerPctCache = [];

$partnerId = $row['partner_id'] ?? null;
$override  = $row['commission_pct_override'] ?? null;

$effectiveCommission = null;
$effectiveDeposit    = null;

if ($override !== null && $override !== '') {
    $effectiveCommission = (float) $override;
}

if ($partnerId) {
    if (!isset($partnerPctCache[$partnerId])) {
        $stmt = $pdo->prepare(
            "SELECT commission_pct, deposit_pct FROM partners WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$partnerId]);
        $partnerPctCache[$partnerId] = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
            'commission_pct' => null,
            'deposit_pct'    => null,
        ];
    }

    $partnerPct = $partnerPctCache[$partnerId];

    if ($effectiveCommission === null && $partnerPct['commission_pct'] !== null) {
        $effectiveCommission = (float) $partnerPct['commission_pct'];
    }

    if ($partnerPct['deposit_pct'] !== null) {
        $effectiveDeposit = (float) $partnerPct['deposit_pct'];
    }
}

// في الـ return:
'commission_pct' => $effectiveCommission, // override أو commission_pct من المركز أو null
'deposit_pct'    => $effectiveDeposit,    // deposit_pct من المركز أو null
```

⚠️ **مهم:** ممنوع أي fallback يخلي القيمة `0` أو `10`. لو مفيش نسبة محفوظة لازم ترجع `null`.

---

## 3) Endpoint: `POST /bookings/{id}/initiate-payment`

**المشكلة الحالية:** الـ response ناقص. الفرونت محتاج معلومات أكتر عشان يكمل.

**المطلوب:**
- تحقق إن `deposit_amount > 0` قبل إنشاء عملية الدفع. لو صفر أو null، ارجع `400` برسالة واضحة.
- ارجع response بالشكل ده بالظبط:

```php
return response()->json([
    'paymentUrl'    => $payUrl,        // رابط بوابة الدفع (MyFatoorah)
    'bookingId'     => $booking['id'], // string
    'paymentMethod' => 'myfatoorah',
    'paymentStatus' => 'pending',
    'amount'        => (float) $booking['deposit_amount'],
    'currency'      => $booking['currency'] ?? 'EGP',
]);
```

في حالة الخطأ:
```php
return response()->json([
    'error'   => 'invalid_deposit_amount',
    'message' => 'قيمة العربون غير صحيحة لهذا الحجز',
], 400);
```

---

## 4) خطوات التحقق بعد التعديل

1. `GET /api/partners/{id}` → لازم يرجع `commission_pct` و `deposit_pct` (قيمة رقمية أو `null`، مش `0`).
2. `GET /api/offers/{id}` → لازم يرجع `commission_pct` (override أو من المركز) و `deposit_pct` من المركز.
3. `POST /api/bookings/{id}/initiate-payment` → response فيه `paymentUrl` + `bookingId` + `amount` + `currency`.
4. تأكد إن أعمدة `commission_pct` و `deposit_pct` موجودة فعلاً في جدول `partners` (`DECIMAL(5,2) NULL`). لو مش موجودة، اعملها:

```sql
ALTER TABLE partners
  ADD COLUMN commission_pct DECIMAL(5,2) NULL,
  ADD COLUMN deposit_pct    DECIMAL(5,2) NULL;
```

---

## ملخص القواعد

- ❌ ممنوع أي fallback بـ `0` أو `10` للنسب.
- ✅ `null` معناه "غير محددة" والفرونت هيمنع الحجز ويطلب من الأدمن يضبطها.
- ✅ `commission_pct_override` على العرض ياخد الأولوية، وبعده `partners.commission_pct`.
- ✅ `deposit_pct` بييجي دايمًا من `partners.deposit_pct`.
