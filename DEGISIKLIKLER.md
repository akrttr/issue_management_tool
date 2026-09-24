# Değişiklik Listesi (Kapalı Ağ Aktarımı)

Bu dosya, geliştirme ortamında yapılan her değişikliği **sırayla** kaydeder.
Kapalı ağdaki sisteme GitHub'dan çekme imkânı olmadığı için değişiklikler oraya
**elle** uygulanır. Maddeleri numara sırasıyla uygulayın, atlamayın.

## Nasıl kullanılır

- Her madde bir `D-NNN` numarası taşır ve bağımsız, küçük bir değişikliktir.
- Satır numaraları **yaklaşıktır** (kapalı ağdaki kodda ufak farklar var).
  Asıl rehber **"Bul"** bloğundaki metindir: dosyada o metni arayın
  (VS Code: `Ctrl+F`), bulduğunuz yeri **"Şununla değiştir"** bloğuyla değiştirin.
- "Bul" metni kapalı ağdaki dosyada birebir yoksa durun, farkı not edin;
  körlemesine uygulamayın.
- Uyguladıktan sonra maddenin **Kontrol** adımını yapın ve
  `[ ] Kapalı ağda uygulandı` kutusunu işaretleyin.
- Geliştirme ortamında her madde ayrı bir commit'tir ve commit mesajı madde
  numarasıyla başlar. Bir maddenin tam değişikliğini görmek için:
  `git log --grep "D-001"` ve `git show <hash>`.

## Başlangıç noktası

| | |
|---|---|
| Repo | `akrttr/issue_management_tool` (fork) |
| Branch | `production-setup` |
| Başlangıç commit'i | `efe736d` — Ignore Visual Studio .lscache files |
| Kapalı ağdaki çalışma şekli | Backend `dotnet run` (src/Api), frontend `npm run dev` |

## Ön kontroller (kod değişikliği değil)

- **Frontend bağımlılıkları:** Bu branch'te `package.json` içinde `cesium` ve
  `vite-plugin-cesium` var. Kapalı ağda `npm run dev` çalışırken
  `Cannot find package 'vite-plugin-cesium'` hatası alınıyorsa bu paketler orada
  kurulu değildir ve internetsiz `npm install` ile kurulamaz. Kapalı ağdaki
  `frontend/package.json` içinde bu iki satır var mı, kontrol edin.

---

## Değişiklikler

### D-001 — Sorunu yeni sekmede açabilme
- **Tarih:** 2026-09-24
- **Neden:** Sorun listesinden bir soruna girip çıkınca listedeki filtreler
  sıfırlanıyordu. Artık sorun yeni sekmede açılabiliyor, liste sekmesi olduğu gibi kalıyor.
  Ayrıca sorun detayındayken sayfa yenilenirse (F5) aynı sorun tekrar açılıyor
  (önceden dashboard'a atıyordu).
- **Bölüm:** frontend
- **Commit:** `D-001:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

**Nasıl kullanılır (sonuç):** Sorunlar listesinde
- satıra **Ctrl + tık** → yeni sekmede açar,
- satıra **tekerlek (orta tuş) tık** → yeni sekmede açar,
- **Sorun No**'ya sağ tık → "Bağlantıyı yeni sekmede aç",
- normal tık → eskisi gibi aynı sekmede açar.

> Not: Girintiler (boşluklar) JavaScript için önemli değil; metni ararken
> satırın baştaki boşluklarını dikkate almayın. Parantez ve noktalı virgüllere dikkat.

**1) `frontend/src/App.jsx`** (yaklaşık 34. satır, ilk `useEffect` içi)

Bul:
```jsx
        if (token && refreshToken) {
            setIsAuthenticated(true);

            const initialPage = "dashboard";
```

Şununla değiştir:
```jsx
        if (token && refreshToken) {
            setIsAuthenticated(true);

            // Yeni sekmede açılan sorun linki: /ticket-detail?id=123
            const urlTicketId = new URLSearchParams(window.location.search).get("id");
            if (window.location.pathname === "/ticket-detail" && urlTicketId) {
                const state = { ticketId: Number(urlTicketId) };
                window.history.replaceState({ page: "ticket-detail", state, initial: true }, "");
                applyNavigation("ticket-detail", state);
                return;
            }

            const initialPage = "dashboard";
```

**2) `frontend/src/App.jsx`** (yaklaşık 47–61. satır) — **ikinci, kopya `useEffect`'i tamamen silin.**
Aynı işi yapan iki `useEffect` vardı; ikincisi kalırsa 1. adımdaki yeni kodu bozar.

Bul ve **sil** (içinde `// initial history entry = dashboard` yorumu olan blok):
```jsx
    useEffect(() => {
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");
        if (token && refreshToken) {
            setIsAuthenticated(true);

            // initial history entry = dashboard
            const initialPage = "dashboard";
            window.history.replaceState(
                { page: initialPage, state: {} },
                "",
                `/${initialPage}`
            );
        }
    }, []);
```

**3) `frontend/src/App.jsx`** (`navigateWithHistory` fonksiyonu içi)

Bul:
```jsx
        window.history.pushState({ page, state }, "", `/${page}`);
```

Şununla değiştir:
```jsx
        const url = page === "ticket-detail" && state.ticketId && state.ticketId !== "new"
            ? `/ticket-detail?id=${state.ticketId}`
            : `/${page}`;
        window.history.pushState({ page, state }, "", url);
```

**4) `frontend/src/App.jsx`** (`handleCloseTicketDetail` fonksiyonu içi)

Bul:
```jsx
        setRefreshTickets((prev) => prev + 1);
        window.history.back();   // popstate listener will call applyNavigation
```

Şununla değiştir:
```jsx
        setRefreshTickets((prev) => prev + 1);
        // Yeni sekmede açıldıysa geri dönülecek sayfa yok: sorun listesine git
        if (window.history.state?.initial) {
            navigateWithHistory("tickets");
            return;
        }
        window.history.back();   // popstate listener will call applyNavigation
```

**5) `frontend/src/components/TicketsTable.jsx`** (yaklaşık 571. satır, tablo satırı `<tr>`'nin `onClick`'i)

Bul:
```jsx
                                    onClick={(e) => {
                                        // Eğer tıklanan şey buton / input ise satır navigasyonu yapma
                                        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
                                            return;
                                        }
                                        onViewTicket(ticket.id);
                                    }}
                                >
```

Şununla değiştir:
```jsx
                                    onClick={(e) => {
                                        // Eğer tıklanan şey buton / input ise satır navigasyonu yapma
                                        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
                                            return;
                                        }
                                        // Ctrl+tık: yeni sekmede aç
                                        if (e.ctrlKey || e.metaKey) {
                                            window.open(`/ticket-detail?id=${ticket.id}`, '_blank');
                                            return;
                                        }
                                        onViewTicket(ticket.id);
                                    }}
                                    onAuxClick={(e) => {
                                        // Orta tuş (tekerlek) tık: yeni sekmede aç
                                        if (e.button === 1 && !e.target.closest('a')) {
                                            window.open(`/ticket-detail?id=${ticket.id}`, '_blank');
                                        }
                                    }}
                                >
```

**6) `frontend/src/components/TicketsTable.jsx`** (yaklaşık 590. satır, "Sorun No" hücresi)

Bul:
```jsx
                                        <span style={styles.ticketCode}>{ticket.externalCode}</span>
```

Şununla değiştir:
```jsx
                                        <a
                                            href={`/ticket-detail?id=${ticket.id}`}
                                            style={{ ...styles.ticketCode, textDecoration: 'none' }}
                                            onClick={(e) => {
                                                // Normal tık aynı sekmede; Ctrl/orta tık/sağ tık tarayıcıya bırakılır
                                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                                    e.preventDefault();
                                                    onViewTicket(ticket.id);
                                                }
                                            }}
                                        >
                                            {ticket.externalCode}
                                        </a>
```

**Sonra:** Dosyaları kaydedin. `npm run dev` açıksa sayfa kendiliğinden yenilenir;
değilse `frontend` klasöründe `npm run dev` ile başlatın. Backend'e dokunulmadı.

**Kontrol:**
1. Sorunlar listesinde bir filtre/arama yapın.
2. Bir satıra Ctrl + tık yapın → sorun yeni sekmede açılmalı, eski sekmedeki filtreler durmalı.
3. Yeni sekmede F5'e basın → aynı sorun tekrar açılmalı.
4. Yeni sekmede sorunu kapatın/geri butonuna basın → sorun listesine gitmeli.
5. Eski sekmede normal tık → soruna aynı sekmede girip geri dönebilmeli (eski davranış).

<!--
Madde şablonu:

### D-NNN — Başlık
- **Tarih:** YYYY-AA-GG
- **Neden:** ...
- **Bölüm:** backend / frontend / veritabanı / betik
- **Commit:** `D-NNN:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

**1) `dosya/yolu`** (yaklaşık NN. satır)

Bul:
```
...
```

Şununla değiştir:
```
...
```

**Sonra:** (yeniden başlatma, komut vb.)

**Kontrol:** (değişikliğin çalıştığını nasıl anlarız)
-->
