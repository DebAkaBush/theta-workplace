# theta-workplace'i sitene ekleme

Uygulama çalışırken başka bir sitenin içine iframe olarak eklenebilir:

```html
<iframe
  src="https://SUNUCU-ADRESI/embed"
  title="theta-workplace"
  width="100%"
  height="720"
  style="border:0;border-radius:12px;"
  loading="lazy">
</iframe>
```

`SUNUCU-ADRESI` yerine yerel ağ adresini veya Tailscale Serve tarafından verilen HTTPS adresini yazın. İnternete açık bir siteye gömecekseniz Tailscale ACL, oda parolası ve HTTPS erişimini birlikte kullanın.
