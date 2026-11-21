# WhatsApp setup (Meta Cloud API)

Three things make WhatsApp work for real customers. Do them in this order.

## 1. A permanent token (the "Generate token" one dies after 24 hours)

1. Go to **business.facebook.com** → **Settings** (gear icon) → **Users → System users** → **Add**.
   Name: `maison-ade-server`, role: **Admin**.
2. With the system user selected: **Assign assets** →
   - **Apps** → your app → turn on **Full control** (or "Manage app").
   - **WhatsApp accounts** → your test WhatsApp Business account → turn on **Full control**.
3. Click **Generate new token** → choose your app → **Token expiration: Never** →
   tick **`whatsapp_business_messaging`** and **`whatsapp_business_management`** → **Generate**.
4. Copy the token (shown once). Replace `WHATSAPP_TOKEN=` in `.env.local` **and** in Vercel, then redeploy.

Keep it secret: anyone with it can send WhatsApps from your business number.

## 2. Message templates (so customers get messages without writing to you first)

WhatsApp only allows free-form text within 24 hours of the customer messaging you. Everything else
must use a **template** Meta has approved. Create these four in **WhatsApp Manager → Message templates →
Create template**:

- **Category:** Utility  ·  **Language:** English (`en`)  ·  **Name:** exactly as below
- Body text exactly as below. When Meta asks for **sample values**, use the examples.

| Name | Body | Sample values |
|---|---|---|
| `maison_booking_confirmed` | Hi {{1}}, you're booked at Maison Adé: {{2}} with {{3}} on {{4}}. To change or cancel (until 2 hours before), open {{5}} . See you soon! | Ada · Silk press · Tolu · Saturday 5 December 2026, 10:30 am · https://maison-ade.vercel.app/b/example |
| `maison_booking_moved` | Hi {{1}}, your booking has moved. {{2}} with {{3}} is now on {{4}}. To change or cancel, open {{5}} . See you soon! | same as above |
| `maison_booking_cancelled` | Hi {{1}}, your {{2}} on {{3}} at Maison Adé is cancelled. To book again, open {{4}} . We hope to see you soon. | Ada · Silk press · Saturday 5 December 2026, 10:30 am · https://maison-ade.vercel.app/book |
| `maison_booking_reminder` | Hi {{1}}, a reminder of your {{2}} with {{3}} at Maison Adé on {{4}}. To change or cancel, open {{5}} . See you soon! | same as the first |

(The `{{n}}` order must match: the app fills them in that order. A template can't start or end with
a `{{n}}`, which is why each ends with a short sentence.)

When all four say **Active**, set in `.env.local` and Vercel:

```
WHATSAPP_USE_TEMPLATES=on
WHATSAPP_TEMPLATE_LANGUAGE=en
```

## 3. Delivery tracking (the webhook)

So the staff message log shows **Delivered / Read / Failed (and why)**:

1. In `.env.local` you already have `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (made for you).
2. Meta: your app → **App settings → Basic** → **App secret → Show** → copy into `WHATSAPP_APP_SECRET=`.
3. Add both to Vercel too, and redeploy.
4. Meta: your app → **WhatsApp → Configuration** → **Webhook → Edit**:
   - Callback URL: `https://maison-ade.vercel.app/api/webhooks/whatsapp`
   - Verify token: the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value
   - **Verify and save**, then under **Webhook fields** subscribe to **messages**.

## Test number limits (until you add a real number)

- Messages only reach the (max 5) numbers on the test number's recipient list.
- `npm run msg:test -- hello 0803...` sends Meta's `hello_world` template: a quick check that works any time.
