# theta-workplace

Yerel ağda veya Tailscale üzerinden kullanılabilen, oda tabanlı ekip iletişim uygulaması.

## Gereksinimler

- Node.js 18 veya üzeri
- İsteğe bağlı: Tailscale

## Çalıştırma

```bash
npm start
```

Tarayıcıdan `http://localhost:3000` adresini açın.

Kullanım, local ağ, Tailscale ve sunucu kurulum rehberi: `http://localhost:3000/guide`

## Tailscale

Windows:

```powershell
npm run start:tailscale
tailscale serve --bg http://127.0.0.1:3000
```

Ubuntu/WSL:

```bash
npm run start:tailscale:linux
```

Ayrıntılı bilgi için [TAILSCALE.md](TAILSCALE.md) dosyasına bakın.

## Feedback e-postası

Feedback formu `admin.theta.server@gmail.com` adresine otomatik mail gönderir. İlk kurulumda `.env.example` dosyasını `.env` olarak kopyalayın ve `FEEDBACK_SMTP_PASS` alanına bu Gmail hesabı için oluşturduğunuz Google uygulama parolasını yazın. Normal Gmail hesap parolası SMTP için çalışmaz. `.env` dosyası GitHub'a gönderilmez.

## Siteye gömme

Uygulama `/embed` adresi üzerinden iframe ile gömülebilir. Örnek için [EMBED.md](EMBED.md) dosyasına bakın.
