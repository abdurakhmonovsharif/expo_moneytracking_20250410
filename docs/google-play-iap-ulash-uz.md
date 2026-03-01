# VoxWallet: Google Play IAP ulash (O'zbekcha, ruscha interfeys uchun)

Bu hujjat sizning hozirgi holatingiz uchun: listing, privacy, test user, oylik/yillik subscriptionlar allaqachon tayyor bo'lgandan keyin qoladigan ishlar.

App paketi: `com.voxwallet.app`

## 0) Play Console ruscha menyu nomlari (tezkor moslik)

Sizdagi interfeys rus tilida bo'lgani uchun quyidagi yo'llardan yuring:

- `Монетизация с Google Play -> Товары -> Подписки`
- `Монетизация с Google Play -> Товары -> Контент, оплачиваемый однократно`
- `Тестирование и выпуск -> Внутреннее тестирование` yoki `Закрытое тестирование`
- `Setup/Настройка -> API access` (ba'zi akkauntlarda inglizcha ko'rinadi)
- `Setup/Настройка -> Лицензирование` (`License testing`)

## 1) Play productlar holatini tekshirish

Quyidagilar `Active` bo'lishi shart:

- `monthly_premium` (base plan: `monthly`)
- `yearly_premium` (base plan: `yearly`)

Muhim:

- App paywallda lifetime ko'rinsa, `premium_lifetime` ni ham yarating va aktiv qiling.
- Agar lifetime ishlatmasangiz, backenddagi lifetime tarifni `is_active=false` qiling (aks holda user bosganda xato chiqadi).

## 2) Google Play API access (backend verify uchun)

Backend Google purchase tokenni tekshirishi uchun Android Publisher API kerak.

Qisqa tartib:

1. Play Console -> `Setup` -> `API access` ga kiring.
2. Google Cloud project bog'lang.
3. Service account yarating.
4. Shu service accountga Play'da buyurtma/subscriptionni tekshirishga yetarli ruxsat bering.
5. JSON key yuklab oling va serverga joylang (git'ga push qilmang).

Ruscha interfeysda bu bo'lim odatda chap menyudagi `Setup`/`Настройка` ichida bo'ladi.

## 3) Backend env ni to'g'ri qo'yish

Production backendda quyidagilar bo'lishi kerak:

```env
GOOGLE_PLAY_PACKAGE_NAME=com.voxwallet.app
GOOGLE_PLAY_SERVICE_ACCOUNT_PATH=/run/secrets/google-play-service-account.json
GOOGLE_PLAY_SUBSCRIPTION_IDS=monthly_premium,yearly_premium
GOOGLE_PLAY_PRODUCT_IDS=premium_lifetime
```

Keyin backendni restart qiling.

## 4) Tarif mapping (backend <-> Play) mosligini tekshirish

`tariff_plans` ichida `store_product_ids.android` quyidagiga teng bo'lishi kerak:

- oylik tarif -> `monthly_premium`
- yillik tarif -> `yearly_premium`
- lifetime tarif -> `premium_lifetime`

Mos bo'lmasa purchase yoki verify yiqiladi.

## 5) Mobil build va test track

IAP faqat Play'dan o'rnatilgan buildda to'g'ri ishlaydi.

1. AAB build qiling:
   - `eas build -p android --profile production`
2. Shu AAB ni `Внутреннее тестирование` yoki `Закрытое тестирование` ga yuklang.
3. Tester email'larini track'ga qo'shing.
4. O'sha tester email'larini `Лицензирование` (`License testing`) ga ham qo'shing.
5. Tester appni faqat Play opt-in linkdan o'rnatsin.

## 6) Frontend env

App production API'ga qarashi kerak:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.voxwallet.uz
```

Env o'zgargan bo'lsa, yangi build chiqarish kerak.

## 7) End-to-end tekshiruv (minimal)

1. Tester account bilan Play'dan o'rnatilgan appni oching.
2. Login qiling.
3. `Get Premium` ga kiring.
4. `monthly` yoki `yearly` sotib oling.
5. Backendda verify endpoint muvaffaqiyatli o'tganini tekshiring.
6. Appda premium ochilganini tekshiring (`is_premium=true` holat).

## 8) Eng ko'p uchraydigan xatolar

- `Item not found`
  - Product aktiv emas
  - Product ID noto'g'ri
  - App Play'dan o'rnatilmagan

- `Developer error`
  - Noto'g'ri track/build
  - Tester account track yoki license testing'da yo'q

- Backendda `403` verify
  - Service account ruxsati/API access noto'g'ri

## 9) Siz uchun hozirgi tezkor ketma-ketlik

1. `premium_lifetime` kerakmi, qaror qiling (bor/yopish).
2. API access + service account JSON ni serverga ulang.
3. Backend envni yuqoridagicha to'ldiring va restart qiling.
4. `tariff_plans` mappingni tekshiring.
5. Test trackdan Play install qilib real test purchase qiling.

Shundan keyin IAP ulanishi tugagan hisoblanadi.

## 10) Ruscha interfeysda aynan qayerni bosish (qisqa)

1. `Монетизация с Google Play -> Товары -> Подписки`
2. `monthly_premium` va `yearly_premium` ichida `Активно` holatini tekshiring.
3. `Монетизация с Google Play -> Товары -> Контент, оплачиваемый однократно`
4. Kerak bo'lsa `premium_lifetime` yarating va `Активировать` qiling.
5. `Тестирование и выпуск -> Внутреннее/Закрытое тестирование` ga AAB chiqarib tester qo'shing.
6. `Setup/Настройка -> API access` da service account bog'lang.
7. `Setup/Настройка -> Лицензирование` ga tester email qo'shing.
