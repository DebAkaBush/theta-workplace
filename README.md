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

Feedback formunun `admin.theta.server@gmail.com` adresine otomatik mail göndermesi için SMTP değişkenlerini sunucuda tanımlayın. Örnek değişkenler [.env.example](.env.example) dosyasındadır. Gmail kullanıyorsanız normal hesap parolası yerine Google hesap güvenliğinden oluşturulan uygulama parolasını kullanın.

## Siteye gömme

Uygulama `/embed` adresi üzerinden iframe ile gömülebilir. Örnek için [EMBED.md](EMBED.md) dosyasına bakın.
