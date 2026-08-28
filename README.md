# LinkShort Pro

احترافي وقابل للتوسع: Cloudflare Workers + D1 + GitHub.

## 1) المتطلبات
- حساب Cloudflare
- حساب GitHub
- Node.js
- Wrangler

## 2) تثبيت
```bash
npm install
```

## 3) إنشاء قاعدة D1
```bash
npx wrangler d1 create linkshort-db
```
انسخ `database_id` وضعه مكان `REPLACE_WITH_DATABASE_ID` داخل `wrangler.toml`.

## 4) إنشاء الجداول
محلياً:
```bash
npm run db:migrate:local
```

سحابياً:
```bash
npm run db:migrate:remote
```

## 5) إضافة Admin Token
```bash
npx wrangler secret put ADMIN_TOKEN
```

اكتب قيمة طويلة وعشوائية. لا تضعها في GitHub.

## 6) تشغيل محلي
```bash
npm run dev
```

## 7) النشر
```bash
npm run deploy
```

## 8) API
POST `/api/links`
```json
{"url":"https://example.com/long-page","slug":"example"}
```

GET `/api/admin/links`
Header:
`Authorization: Bearer YOUR_ADMIN_TOKEN`

## 9) المرحلة التالية
- لوحة تحكم حقيقية
- تسجيل دخول آمن
- إحصائيات يومية
- منع البوتات والسبام
- صفحات القانونية وPrivacy/Terms
- custom domain
- نظام إعلانات قابل للتبديل
- API keys وrate limiting
- OpenGraph/SEO
- QR codes
