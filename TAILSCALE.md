# theta-workplace'i Tailscale ile uzaktan kullanma

Tailscale hesabı theta-workplace içine yazılmaz. Her kullanıcı kendi cihazında Tailscale ile oturum açar; hangi kişilerin erişebileceği Tailscale yönetim panelindeki tailnet üyeleri ve ACL kurallarıyla belirlenir.

## Kurulum

1. Sunucu bilgisayarına Tailscale'i kurun ve yönetici hesabıyla oturum açın:

```powershell
tailscale up
```

2. Projeyi Tailscale modunda başlatın.

Windows:

```powershell
npm run start:tailscale
```

Ubuntu veya WSL:

```bash
npm run start:tailscale:linux
```

Bu modda uygulama yalnızca `127.0.0.1:3000` üzerinde dinler. Tailscale dışından doğrudan erişim açılmaz.

3. Uygulamayı tailnet üzerinden yayınlayın:

```powershell
tailscale serve --bg http://127.0.0.1:3000
```

Tailscale komutunun yazdırdığı HTTPS adresini onayladığınız kişilerle paylaşın.

4. Erişmesini istediğiniz kişileri Tailscale yönetim panelinden aynı tailnet'e davet edin veya ACL kurallarıyla yalnızca belirli kullanıcı/gruplara erişim verin. Onaylanmayan kişiler Tailscale ağına ve uygulamaya ulaşamaz.

## Uygulama davranışı

`TAILSCALE_MODE=true` olduğunda theta-workplace, Tailscale Serve tarafından eklenen `Tailscale-User-Login` ve `Tailscale-User-Name` başlıklarını okuyabilir. Odaya girişte kullanıcı adı otomatik doldurulur; Tailscale parolası hiçbir zaman uygulamaya gönderilmez veya saklanmaz.

Oda parolaları ayrıca kullanılabilir. Böylece Tailscale ağına kabul edilmiş bir kullanıcı bile yalnızca ilgili odanın parolasını biliyorsa odaya girebilir.

## Notlar

- `npm start` yerel ağ kullanımını sürdürür.
- `npm run start:tailscale` uzaktan erişim için önerilen moddur.
- Tailscale ACL ve cihaz onayı uygulama kodundan değil, Tailscale yönetim panelinden yapılır.
- Gerçek kurum kullanımı öncesinde HTTPS adresini, ACL kurallarını ve yedekleme politikasını test edin.
