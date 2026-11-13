# R2 Vault

Privatni Next.js portal za upload fajlova u Cloudflare R2. Lozinka i R2 ključevi
ostaju na serveru; browser dobija samo kratkotrajni, potpisani URL za direktan
upload ili download.

## Lokalno pokretanje

1. Instaliraj Node.js 20.9+.
2. Napravi `.env.local` kopijom iz `.env.example` i zameni sve primer vrednosti.
3. Postavi obavezne vrednosti:
   - `ADMIN_PASSWORD`: jedinstvena lozinka od najmanje 12 karaktera.
   - `SESSION_SECRET`: nasumičan tajni string od najmanje 32 bajta.
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` i `R2_BUCKET_NAME`.
   - `R2_PUBLIC_BASE_URL`: HTTPS custom domain za R2, npr. `https://media.mikilic.com`.
4. Instaliraj pakete i pokreni aplikaciju:

   ```sh
   npm install
   npm run dev
   ```

Tajni ključ možeš da generišeš komandom:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Otvori `http://localhost:3000`. Za produkciju koristi `npm run build` i `npm start`.
U produkciji se session cookie šalje samo preko HTTPS-a.

## Cloudflare R2 podešavanje

- Napravi **private** bucket i R2 API token sa samo potrebnim pravima za taj bucket:
  `Object Read` i `Object Write`. Ne koristi account-wide token.
- Poveži `R2_PUBLIC_BASE_URL` kao custom domain za bucket u Cloudflare R2.
  Custom domain omogućava javno preuzimanje objekata preko tog domena, pa
  stalni linkovi rade bez prijave i isteka: svako ko zna link može preuzeti
  fajl dok je objekat dostupan. Privremeni linkovi ostaju potpisani R2 URL-ovi
  koji ističu posle 15 minuta.
- Dodaj bucket CORS policy za tačan sajt origin, npr.:

  ```json
  [
    {
      "AllowedOrigins": ["https://tvoj-domen.example"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["Content-Type"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- Zameni primer origin-a svojim stvarnim domenom. Dodaj `http://localhost:3000`
  samo ako ti treba lokalni razvoj.

## Zaštita i ograničenja

- Stranica i svi API endpoint-i koji čitaju ili menjaju R2 zahtevaju prijavljenu
  sesiju. Sesija je HMAC-potpisana, traje 8 sati i čuva se u `HttpOnly`,
  `SameSite=Strict` cookie-ju; u produkciji je cookie `Secure`.
- API lozinka, sesijski ključ i R2 kredencijali se čitaju isključivo iz server
  environment-a. Nikada ih nemoj stavljati u `NEXT_PUBLIC_*` promenljive.
- Upload URL traje 5 minuta; direktan download URL traje 1 minut. Link koji
  kopiraš traje 15 minuta i svako ko ga dobije može preuzeti fajl dok ne istekne.
  Upload je ograničen na 100 MB po fajlu. Početna prikazuje 5 najnovijih fajlova
  iz prvih 1.000 objekata; stranica „Svi fajlovi” učitava bucket u stranicama.
- Direktan upload zahteva R2 CORS podešavanje iznad. Potpisani URL-ovi su
  bearer linkovi: ne deli ih i ne zapisuj ih u javne logove.
- Pre javnog deploy-a uključi HTTPS i Cloudflare rate limiting za `/api/auth/login`
  (na primer ograniči broj neuspešnih zahteva po IP adresi). Jedna deljena
  administratorska lozinka je namenjena privatnom, malom storage portalu, ne
  višekorisničkoj autentikaciji.
