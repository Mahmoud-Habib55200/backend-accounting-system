# 📮 Money Tracker API — Postman Collections

توثيق كامل لـ **80 endpoint** في السيستم، مقسّمة على كولكشنين + environment.

---

## 📁 الملفات

| الملف | المحتوى |
|---|---|
| `MoneyTracker-01-User.postman_collection.json` | **71 طلب** في 12 فولدر — كل endpoints المستخدم |
| `MoneyTracker-02-Admin.postman_collection.json` | **11 طلب** في 3 فولدرات — لوحة تحكم الأدمن |
| `MoneyTracker-Local.postman_environment.json` | متغيرات البيئة المحلية |

---

## 🚀 التنصيب (Import)

### 1) افتح Postman
اضغط **Import** (فوق على الشمال) → اسحب الـ 3 ملفات مع بعض → **Import**.

### 2) فعّل الـ Environment
من فوق على اليمين، اختار **Money Tracker — Local (محلي)** من القائمة المنسدلة.

### 3) شغّل السيرفر

```bash
cd backend
npm install
npm run dev
```

لازم يظهر لك:
```
Server running on port 5000
```

### 4) اتأكد إن كل حاجة تمام
روح فولدر **`00 — ❤️ Health Check`** ونفّذ الطلب.
لازم يرجع:
```json
{ "status": "ok" }
```

✅ لو رجع كده يبقى إنت جاهز.

---

## 🔑 تسجيل الدخول (مهم)

روح فولدر **`01 — 🔑 Auth`**:

1. نفّذ **Register** (أول مرة) — أو **Login** لو عندك حساب.
2. التوكن هيتحفظ **أوتوماتيك** في متغير `{{token}}`.
3. خلاص — كل الطلبات التانية هتشتغل من غير ما تعمل حاجة. 🎉

> 💡 الحفظ التلقائي بيتم عن طريق **Tests script** مكتوب في الطلب.
> افتح تاب **Tests** في طلب Login عشان تشوف الكود.

---

## 🗺️ الترتيب المقترح للتجربة

نفّذ الفولدرات بالترتيب ده عشان البيانات تتربط ببعض صح:

```
00  Health            اتأكد السيرفر شغال
01  Auth              Register / Login          → يحفظ {{token}}
05  Accounts          اعمل حساب                → يحفظ {{accountId}}
04  Expense Categories اعمل تصنيفات             → يحفظ {{categoryId}}
02  Income            سجّل إيراد                → يحفظ {{incomeId}}
03  Expenses          سجّل مصروف               → يحفظ {{expenseId}}
08  Savings           اعمل هدف ادخار + أودع    → يحفظ {{goalId}}
07  Debts             سجّل دين + دفعة          → يحفظ {{debtId}}
06  Transactions      جرّب الـ pagination      → يحفظ {{transactionId}}
10  Dashboard         شوف كل حاجة مجمّعة
09  Reports           شوف الـ 9 تقارير
11  Settings          عدّل بياناتك
```

> ⚠️ **لازم تعمل Account الأول** — الإيرادات والمصاريف والادخارات والديون كلها بتربط بحساب.

---

## 📦 المتغيرات وإزاي بتشتغل

الكولكشن بيستخدم **Collection Variables** بتتملى لوحدها:

| المتغير | بيتملى بعد |
|---|---|
| `baseUrl` | **أنت** بتحطه (الافتراضي `http://localhost:5000`) |
| `token` | Register / Login |
| `userId` | Register / Login |
| `accountId` | Create Account |
| `accountId2` | Create 2nd Account |
| `incomeId` | Create Income |
| `expenseId` | Create Expense |
| `categoryId` | Create Category |
| `debtId` | Create Debt |
| `goalId` | Create Savings Goal |
| `transactionId` | Create Transaction |
| `adminToken` | Admin Login (كولكشن الأدمن) |
| `targetUserId` | Get Users / Create User |

**عايز تشوف قيمهم؟** دوس على اسم الكولكشن → تاب **Variables** → عمود **Current Value**.

---

## 🛡️ كولكشن الأدمن

### اعمل حساب أدمن الأول

**الطريقة الصح:**
```bash
node scripts/createAdmin.js
```

**أو للتجربة بس:** استخدم طلب **Seed Admin** (بس اقرا التحذير الأمني اللي في وصفه 🚨).

### بعدها
نفّذ **Admin Login** → التوكن هيتحفظ في `{{adminToken}}`.

> ⏱️ **مهم:** توكن الأدمن صلاحيته **30 دقيقة بس**. لو جالك `401` فجأة، اعمل Login تاني.

---

## 📖 إزاي تقرا التوثيق

**كل** طلب فيه وصف تفصيلي. عشان تقراه:

- **في Postman:** افتح الطلب → دوس على السهم `>` على اليمين → تاب **Documentation**.
- **أو:** دوس ⋯ جنب اسم الكولكشن → **View Documentation** — بيفتح صفحة كاملة بكل التوثيق.

### كل وصف فيه:
- ✅ شرح الغرض من الـ endpoint
- 📥 جدول بكل حقول الـ Body (النوع، مطلوب ولا لأ، الافتراضي، القيم المسموحة)
- 🔍 جدول بكل الـ Query Params
- 📤 مثال كامل للـ Response بشكل JSON
- ❌ جدول بكل الأخطاء الممكنة وأكوادها
- ⚙️ شرح المنطق الداخلي (إيه اللي بيحصل جوه الـ controller)
- 🧪 تجارب مقترحة عليك تجرّبها
- 🚨 **الثغرات والمشاكل الموجودة فعلاً في الكود** — دي تمارين ليك!

---

## 🚨 قسم الثغرات (تمارين للطلبة)

الأوصاف معلّم فيها على مشاكل حقيقية موجودة في الكود بعلامات 🚨 و⚠️. أهمها:

| # | المشكلة | فين |
|---|---|---|
| 1 | راوت `seed` للأدمن مفتوح للعامة | `POST /api/admin/auth/seed` |
| 2 | إيقاف اليوزر مبيبطّلش توكنه الحالي | `POST /api/admin/users/:id/suspend` |
| 3 | التحويلات مفيهاش MongoDB transactions | `POST /api/accounts/transfer` |
| 4 | الإيداع الزايد عن الهدف بيضيّع فلوس | `POST /api/savings/:id/deposit` |
| 5 | مفيش تحقق إن `fromId !== toId` في التحويل | `POST /api/accounts/transfer` |
| 6 | مفيش عداد محاولات لكود تأكيد الإيميل | `POST /api/settings/email/confirm` |
| 7 | شروط الباسورد في مكان واحد بس من 4 | `PUT /api/settings/password` |
| 8 | مشكلة N+1 query | `GET /api/reports/categories` |
| 9 | صور base64 متخزنة في الداتابيز | `POST /api/settings/photo` |
| 10 | مفيش rate limit على دخول الأدمن | `POST /api/admin/auth/login` |
| 11 | `express.json()` حده 100kb والصور لحد 5MB | `src/index.js` |
| 12 | الأسعار hard-coded في الـ controller | `GET /api/admin/dashboard` |

---

## 📋 شكل الردود

```json
// ✅ نجاح
{ "success": true, "data": { } }
{ "success": true, "data": [ ], "pagination": { } }
{ "success": true, "message": "..." }

// ❌ خطأ
{ "success": false, "message": "..." }
{ "success": false, "code": "SUBSCRIPTION_EXPIRED", "message": "..." }
```

| الكود | المعنى |
|---|---|
| `200` | تم |
| `201` | تم الإنشاء |
| `400` | بيانات ناقصة أو غلط |
| `401` | مش مسجّل دخول / توكن غلط أو منتهي |
| `403` | ممنوع (اشتراك منتهي / حد trial / حساب موقوف / مش أدمن) |
| `404` | مش موجود |
| `409` | تعارض (إيميل أو اسم مكرر) |
| `429` | طلبات كتير (rate limit) |
| `500` | خطأ في السيرفر |

---

## 🧱 خريطة الـ Endpoints

| الفولدر | Base Path | العدد | Auth | Subscription Check |
|---|---|---|---|---|
| Health | `/api/health` | 1 | ❌ | ❌ |
| Auth | `/api/auth` | 5 | جزئي | ❌ |
| Income | `/api/income` | 5 | ✅ | ✅ |
| Expenses | `/api/expenses` | 4 | ✅ | ✅ |
| Expense Categories | `/api/expense-categories` | 4 | ✅ | ❌ |
| Accounts | `/api/accounts` | 9 | ✅ | ✅ |
| Transactions | `/api/transactions` | 5 | ✅ | ❌ |
| Debts | `/api/debts` | 8 | ✅ | ❌ |
| Savings | `/api/savings` | 10 | ✅ | ✅ |
| Reports | `/api/reports` | 9 | ✅ | ❌ |
| Dashboard | `/api/dashboard` | 1 | ✅ | ❌ |
| Settings | `/api/settings` | 8 | ✅ | ❌ |
| Admin | `/api/admin` | 11 | أدمن | ❌ |
| **الإجمالي** | | **80** | | |

---

## ❓ مشاكل شائعة

| المشكلة | الحل |
|---|---|
| `ECONNREFUSED` | السيرفر مش شغال → `npm run dev` |
| `404 Route not found` | راجع الـ path — لازم يبدأ بـ `/api` |
| `401 Unauthorized` | اعمل Login تاني (التوكن خلص أو فاضي) |
| `403 SUBSCRIPTION_EXPIRED` | خلّي الأدمن يمدد الاشتراك من كولكشن الأدمن |
| `403 TRIAL_LIMIT_1_ACCOUNT` | حساب الـ trial مسموح له بحساب واحد — غيّر الخطة |
| `403 TRIAL_LIMIT_20_ENTRIES` | وصلت 20 عملية في الـ trial — غيّر الخطة |
| `403 Forbidden` في الأدمن | إنت بتستخدم توكن مستخدم عادي مش أدمن |
| `429` | استنى شوية — rate limit (20 طلب / 15 دقيقة على login) |
| التقارير راجعة فاضية | ضيف بيانات بتواريخ **جوه** المدى الزمني اللي بتطلبه |
| `413 Payload Too Large` | الصورة كبيرة — حد `express.json()` هو 100kb |

---

## 🎓 تمارين مقترحة

1. **CRUD كامل:** اعمل إيراد، عدّله، اعرضه، امسحه — وراقب رصيد الحساب في كل خطوة.
2. **تتبع الفلوس:** اعمل تحويل بين حسابين وشوف الحركتين في `GET /api/accounts/activity`.
3. **اكسر السيستم:** جرّب تحوّل مبلغ أكبر من الرصيد، أو تودّع في هدف أكتر من المتبقي.
4. **الاشتراكات:** من كولكشن الأدمن، خلّي اشتراك يوزر ينتهي، وبعدين حاول تعمل POST — شوف الـ 403.
5. **الأمان:** خد توكن مستخدم عادي وحطه في `{{adminToken}}` — شوف الـ 403.
6. **التقارير:** ضيف مصاريف على مدار 3 شهور وقارن `income-expenses` بـ `savings` بـ `net-worth`.
7. **صلّح ثغرة:** اختار واحدة من جدول الثغرات فوق وصلّحها في الكود.

---

بالتوفيق! 🎓
