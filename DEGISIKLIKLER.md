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

---

### D-002 — Durdurmada log'a çift kayıt düşmesi
- **Tarih:** 2026-09-24
- **Neden:** Sorun durdurulunca geçmişe iki kayıt düşüyordu
  ("Duraklama Sebebi: …" ve "Sebep: …", ikisi de DURDURULDU → DURDURULDU).
  Frontend durdurma için backend'e iki ayrı istek gönderiyordu. Ayrıca ilk istek
  onaydan **önce** gittiği için "Emin misiniz?" sorusuna "Hayır" denince bile sorun
  durduruluyordu. Artık tek istek gidiyor: log'a tek kayıt (AÇIK → DURDURULDU) düşüyor,
  "Hayır" denince hiçbir şey değişmiyor.
- **Bölüm:** frontend
- **Commit:** `D-002:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

**1) `frontend/src/components/TicketDetail.jsx`** (yaklaşık 408. satır, `handleStatusChange` içi)

Bul ve **sil** (sadece bu satır):
```jsx
            await ticketPausesAPI.create({ ticketId: ticketId, pauseReason: pauseReason });
```

**2) `frontend/src/components/TicketDetail.jsx`** (4. satır, en üstteki import)

Bul:
```jsx
import { ticketsAPI, userApi, configurationAPI, notificationsAPI, ticketPausesAPI } from "../../services/api";
```

Şununla değiştir (sondaki `, ticketPausesAPI` kaldırıldı):
```jsx
import { ticketsAPI, userApi, configurationAPI, notificationsAPI } from "../../services/api";
```

**Sonra:** Dosyayı kaydedin (`npm run dev` açıksa sayfa kendiliğinden yenilenir). Backend'e dokunulmadı.

**Kontrol:**
1. Açık bir sorunu durdurun, sebep girin, onayda "Evet" deyin → sorun geçmişinde
   **tek** kayıt olmalı: "AÇIK → DURDURULDU", not "Sebep: …".
2. Başka açık bir sorunda durdur → sebep gir → onayda "Hayır" deyin → sorun
   durumu değişmemeli, geçmişe kayıt düşmemeli.

> Not: Daha önce oluşmuş çift kayıtlar veritabanında kalır; bu değişiklik sadece
> yeni durdurmaları etkiler.

---

### D-003 — Durdurma tarihini seçebilme (geçmişe yönelik durdurma)
- **Tarih:** 2026-09-24
- **Neden:** Durdurma tarihi her zaman "şu an" olarak kaydediliyordu ve sonradan
  değiştirilemiyordu. Artık durdururken sebep penceresinde bir **Durdurma tarihi**
  alanı var (varsayılan: şu an). Geçmiş bir tarih seçilebilir.
  - İleri (gelecek) tarih kabul edilmez.
  - Sorunun önceki bir durdurması varsa, yeni tarih o durdurmanın bitişinden önce olamaz
    (süreler üst üste binmesin diye).
  - Sorun geçmişindeki kayıt, işlemin yapıldığı anın saatiyle görünür; notunda gerçek
    durdurma tarihi yazar: `Sebep: … (Durdurma tarihi: 20.09.2026 14:00)`.
- **Bölüm:** backend + frontend
- **Ön koşul:** D-002 uygulanmış olmalı.
- **Commit:** `D-003:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

**1) `src/Api/DTOs/TicketDTOs.cs`** (yaklaşık 47. satır)

Bul:
```csharp
public record ChangeStatusRequest(string ToStatus, string? Notes, string? PauseReason);
```

Şununla değiştir:
```csharp
public record ChangeStatusRequest(string ToStatus, string? Notes, string? PauseReason, DateTime? PausedAt = null);
```

**2) `src/Api/Controllers/TicketsController.cs`** (yaklaşık 807. satır, `ChangeStatus` metodu içi)

Bul:
```csharp
        // Handle pausing - create pause record
        if (toStatus == TicketStatus.PAUSED && oldStatus != TicketStatus.PAUSED)
        {
            if (string.IsNullOrWhiteSpace(request.PauseReason))
                return BadRequest(new { message = "Duraklama sebebi zorunludur" });
```

Şununla değiştir:
```csharp
        // Handle pausing - create pause record
        var pausedAt = request.PausedAt?.ToUniversalTime() ?? DateTime.UtcNow;
        if (toStatus == TicketStatus.PAUSED && oldStatus != TicketStatus.PAUSED)
        {
            if (string.IsNullOrWhiteSpace(request.PauseReason))
                return BadRequest(new { message = "Duraklama sebebi zorunludur" });

            // Geçmişe yönelik durdurma: ileri tarih olamaz, önceki durdurmanın bitişinden önce olamaz
            if (pausedAt > DateTime.UtcNow.AddMinutes(1))
                return BadRequest(new { message = "Durdurma tarihi ileri bir tarih olamaz" });

            var lastResumedAt = await _context
                .TicketPauses.Where(tp => tp.TicketId == id && tp.ResumedAt != null)
                .MaxAsync(tp => tp.ResumedAt);
            if (lastResumedAt.HasValue && pausedAt < lastResumedAt.Value)
                return BadRequest(new { message = "Durdurma tarihi önceki durdurmanın bitişinden önce olamaz" });
```

**3) `src/Api/Controllers/TicketsController.cs`** (2. adımın hemen altında, `new TicketPause` bloğu içi, yaklaşık 829. satır)

Bul (dosyada tek geçer):
```csharp
                PausedAt = DateTime.UtcNow,
```

Şununla değiştir:
```csharp
                PausedAt = pausedAt,
```

**4) `src/Api/Controllers/TicketsController.cs`** (yaklaşık 865. satır, aynı metotta `new TicketAction` bloğu içi)

Bul:
```csharp
                toStatus == TicketStatus.PAUSED ? $"Sebep: {request.PauseReason}" : request.Notes,
```

Şununla değiştir:
```csharp
                toStatus == TicketStatus.PAUSED
                    ? $"Sebep: {request.PauseReason} (Durdurma tarihi: {pausedAt.ToLocalTime():dd.MM.yyyy HH:mm})"
                    : request.Notes,
```

**5) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 59. satır, `showInputToast` başı)

Bul:
```jsx
export function showInputToast(message) {
    return new Promise((resolve) => {
        let userInput = "";
```

Şununla değiştir:
```jsx
export function showInputToast(message) {
    return new Promise((resolve) => {
        let userInput = "";
        // Varsayılan durdurma tarihi: şu an (yerel saat, datetime-local formatında)
        const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        let dateInput = nowLocal;
```

**6) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 81. satır, sebep kutusunun altı)

Bul:
```jsx
                        onChange={(e) => (userInput = e.target.value)}
                    />
```

Şununla değiştir (ilk iki satır aynen kalıyor, altına tarih kutusu ekleniyor):
```jsx
                        onChange={(e) => (userInput = e.target.value)}
                    />

                    <div style={{ marginBottom: "4px" }}>Durdurma tarihi:</div>
                    <input
                        type="datetime-local"
                        defaultValue={nowLocal}
                        max={nowLocal}
                        style={{
                            width: "90%",
                            padding: "8px",
                            marginBottom: "10px",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                        }}
                        onChange={(e) => (dateInput = e.target.value)}
                    />
```

**7) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 110. satır, "Kaydet" butonunun `onClick`'i)

Bul:
```jsx
                            resolve(userInput || "");
```

Şununla değiştir:
```jsx
                            resolve({ text: userInput || "", date: dateInput });
```

**8) `frontend/src/components/TicketDetail.jsx`** (yaklaşık 395. satır, `handleStatusChange` içi)

Bul:
```jsx
        let pauseReason = null;

        if (newStatus === 'PAUSED') {
            // pauseReason = prompt('Lütfen duraklama sebebini giriniz:');
            pauseReason = await showInputToast("Lütfen duraklama sebebini giriniz:");
```

Şununla değiştir:
```jsx
        let pauseReason = null;
        let pausedAt = null;

        if (newStatus === 'PAUSED') {
            // pauseReason = prompt('Lütfen duraklama sebebini giriniz:');
            const pauseInput = await showInputToast("Lütfen duraklama sebebini giriniz:");
            pauseReason = pauseInput?.text ?? null;
            pausedAt = pauseInput?.date ? new Date(pauseInput.date).toISOString() : null;
```

**9) `frontend/src/components/TicketDetail.jsx`** (yaklaşık 430. satır, `statusData` nesnesi)

Bul:
```jsx
                PauseReason: pauseReason || null
            }
```

Şununla değiştir (ilk satırın sonuna virgül eklendi):
```jsx
                PauseReason: pauseReason || null,
                PausedAt: pausedAt
            }
```

**Sonra:**
- Backend'i yeniden başlatın: çalışan `dotnet run`'ı `Ctrl+C` ile durdurup `src/Api` klasöründe tekrar `dotnet run`.
- Frontend dosyalarını kaydedin (`npm run dev` açıksa kendiliğinden yenilenir).
- Veritabanı değişikliği (migration) **yok**.

**Kontrol:**
1. Açık bir sorunu durdurun → sebep penceresinde "Durdurma tarihi" alanı, şu anki tarih/saatle dolu gelmeli.
2. Tarihi birkaç gün geriye alın, sebep girin, onaylayın → sorunun **Durdurma geçmişi**nde
   başlangıç olarak seçtiğiniz tarih görünmeli; sorun geçmişinde not
   `Sebep: … (Durdurma tarihi: <seçilen tarih>)` olmalı.
3. Tarihi elle ileri bir tarihe yazıp deneyin → "Durdurma tarihi ileri bir tarih olamaz" hatası gelmeli.
4. Tarihi değiştirmeden durdurun → eskisi gibi şu anki saatle durmalı.

---

### D-004 — Devam (durdurma bitiş) tarihini seçebilme
- **Tarih:** 2026-09-24
- **Neden:** D-003 ile durdurma başlangıcı geçmişe girilebiliyordu ama bitişi hep
  "şu an" kaydediliyordu. Artık durdurma bitirilirken **Devam tarihi** seçilebiliyor
  (varsayılan: şu an). Geçmiş bir tarih seçilirse durdurmanın bitişi o tarih olur.
  İki yerde geçerli:
  - Sorun detayında, DURDURULDU durumundaki sorunun durumu değiştirilirken
    (sebep penceresi gibi bir pencerede sadece tarih sorulur),
  - **Durdurma Yönetimi** sayfasındaki "Devam Ettir" penceresinde (yeni "Devam Tarihi" alanı).

  Kurallar: ileri tarih olamaz; durdurmanın başlangıç tarihinden önce olamaz.
  Sorun geçmişindeki kaydın notuna `(Devam tarihi: 22.09.2026 09:00)` eklenir.
  Durdurma Yönetimi'nde hata olursa artık backend'in hata mesajı gösterilir.
- **Bölüm:** backend + frontend
- **Ön koşul:** D-003 uygulanmış olmalı.
- **Commit:** `D-004:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

#### Backend

**1) `src/Api/DTOs/TicketDTOs.cs`** (yaklaşık 47. satır — D-003'te değişen satır)

Bul:
```csharp
public record ChangeStatusRequest(string ToStatus, string? Notes, string? PauseReason, DateTime? PausedAt = null);
```

Şununla değiştir:
```csharp
public record ChangeStatusRequest(string ToStatus, string? Notes, string? PauseReason, DateTime? PausedAt = null, DateTime? ResumedAt = null);
```

**2) `src/Api/DTOs/TicketPauseDTOs.cs`** (yaklaşık 38. satır, `ResumeTicketPauseRequest`)

Bul:
```csharp
        long PauseId,
        string? ResumeNotes
    );
```

Şununla değiştir (`ResumeNotes`'tan sonra virgül ve yeni satır):
```csharp
        long PauseId,
        string? ResumeNotes,
        DateTime? ResumedAt = null
    );
```

**3) `src/Api/Controllers/TicketsController.cs`** (yaklaşık 836. satır, `ChangeStatus` içi)

Bul:
```csharp
        // Handle resuming - close active pause
        if (oldStatus == TicketStatus.PAUSED && toStatus != TicketStatus.PAUSED)
```

Şununla değiştir (araya bir satır eklendi):
```csharp
        // Handle resuming - close active pause
        var resumedAt = request.ResumedAt?.ToUniversalTime() ?? DateTime.UtcNow;
        if (oldStatus == TicketStatus.PAUSED && toStatus != TicketStatus.PAUSED)
```

**4) `src/Api/Controllers/TicketsController.cs`** (3. adımın birkaç satır altı)

Bul (dosyada tek geçer):
```csharp
                activePause.ResumedAt = DateTime.UtcNow;
```

Şununla değiştir:
```csharp
                // Geçmişe yönelik devam: ileri tarih olamaz, durdurma tarihinden önce olamaz
                if (resumedAt > DateTime.UtcNow.AddMinutes(1))
                    return BadRequest(new { message = "Devam tarihi ileri bir tarih olamaz" });
                if (resumedAt < activePause.PausedAt)
                    return BadRequest(new { message = "Devam tarihi durdurma tarihinden önce olamaz" });

                activePause.ResumedAt = resumedAt;
```

**5) `src/Api/Controllers/TicketsController.cs`** (aynı metotta `new TicketAction` içi — D-003'te değişen yer)

Bul:
```csharp
                    ? $"Sebep: {request.PauseReason} (Durdurma tarihi: {pausedAt.ToLocalTime():dd.MM.yyyy HH:mm})"
                    : request.Notes,
```

Şununla değiştir (ortaya iki satır eklendi):
```csharp
                    ? $"Sebep: {request.PauseReason} (Durdurma tarihi: {pausedAt.ToLocalTime():dd.MM.yyyy HH:mm})"
                : oldStatus == TicketStatus.PAUSED
                    ? $"{request.Notes} (Devam tarihi: {resumedAt.ToLocalTime():dd.MM.yyyy HH:mm})"
                    : request.Notes,
```

**6) `src/Api/Controllers/TicketPausesController.cs`** (yaklaşık 249. satır, `ResumePause` metodu)

Bul (dosyada tek geçer):
```csharp
            pause.ResumedAt = DateTime.UtcNow;
```

Şununla değiştir:
```csharp
            // Geçmişe yönelik devam: ileri tarih olamaz, durdurma tarihinden önce olamaz
            var resumedAt = request.ResumedAt?.ToUniversalTime() ?? DateTime.UtcNow;
            if (resumedAt > DateTime.UtcNow.AddMinutes(1))
                return BadRequest(new { message = "Devam tarihi ileri bir tarih olamaz" });
            if (resumedAt < pause.PausedAt)
                return BadRequest(new { message = "Devam tarihi durdurma tarihinden önce olamaz" });

            pause.ResumedAt = resumedAt;
```

**7) `src/Api/Controllers/TicketPausesController.cs`** (aynı metotta, yaklaşık 272. satır)

Bul:
```csharp
                Notes = request.ResumeNotes ?? "Duraklama sonlandırıldı",
```

Şununla değiştir:
```csharp
                Notes = $"{request.ResumeNotes ?? "Duraklama sonlandırıldı"} (Devam tarihi: {resumedAt.ToLocalTime():dd.MM.yyyy HH:mm})",
```

#### Frontend

**8) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 59. satır)

Bul:
```jsx
export function showInputToast(message) {
```

Şununla değiştir:
```jsx
export function showInputToast(message, dateLabel = "Durdurma tarihi:", withText = true) {
```

**9) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 71. satır, sebep kutusunun başı)

Bul:
```jsx
                    <input
                        type="text"
```

Şununla değiştir (`<input`'un önüne `{withText && ` eklendi):
```jsx
                    {withText && <input
                        type="text"
```

**10) `frontend/src/components/ConfirmToast.jsx`** (aynı kutunun sonu, yaklaşık 82. satır)

Bul:
```jsx
                        onChange={(e) => (userInput = e.target.value)}
                    />
```

Şununla değiştir (`/>`'nin sonuna `}` eklendi):
```jsx
                        onChange={(e) => (userInput = e.target.value)}
                    />}
```

**11) `frontend/src/components/ConfirmToast.jsx`** (yaklaşık 84. satır — D-003'te eklenen etiket)

Bul:
```jsx
                    <div style={{ marginBottom: "4px" }}>Durdurma tarihi:</div>
```

Şununla değiştir:
```jsx
                    <div style={{ marginBottom: "4px" }}>{dateLabel}</div>
```

**12) `frontend/src/components/TicketDetail.jsx`** (yaklaşık 414. satır, `handleStatusChange` içi)

Bul:
```jsx
        const confirm = await showConfirmToast(`Durumu "${statusLabel}" olarak değiştirmek istediğinize emin misiniz?`);
```

Bu satırın **hemen üstüne** şunu ekleyin (bulduğunuz satır aynen kalıyor):
```jsx
        // Durdurulmuş sorun devam ettiriliyorsa devam (durdurma bitiş) tarihini sor
        let resumedAt = null;
        if (formData.status === 'PAUSED' && newStatus !== 'PAUSED') {
            const resumeInput = await showInputToast("Durdurmanın bittiği tarihi seçiniz:", "Devam tarihi:", false);
            if (!resumeInput) { toast.info("İşlem iptal edildi."); return; }
            resumedAt = resumeInput.date ? new Date(resumeInput.date).toISOString() : null;
        }

```

**13) `frontend/src/components/TicketDetail.jsx`** (`statusData` nesnesi — D-003'te değişen yer)

Bul:
```jsx
                PausedAt: pausedAt
            }
```

Şununla değiştir (`pausedAt`'tan sonra virgül):
```jsx
                PausedAt: pausedAt,
                ResumedAt: resumedAt
            }
```

**14) `frontend/src/components/PauseManagement.jsx`** (yaklaşık 16. satır, en üstteki `useState`'ler)

Bul:
```jsx
    const [resumeNotes, setResumeNotes] = useState('');
```

Şununla değiştir:
```jsx
    const [resumeNotes, setResumeNotes] = useState('');
    const [resumeDate, setResumeDate] = useState('');
```

**15) `frontend/src/components/PauseManagement.jsx`** (yaklaşık 219. satır, `handleResume` içi)

Bul:
```jsx
            await ticketPausesAPI.resume(selectedPause.id, { resumeNotes });
```

Şununla değiştir:
```jsx
            await ticketPausesAPI.resume(selectedPause.id, {
                resumeNotes,
                resumedAt: resumeDate ? new Date(resumeDate).toISOString() : null
            });
```

**16) `frontend/src/components/PauseManagement.jsx`** (aynı fonksiyonun `catch` bloğu)

Bul:
```jsx
            toast.error('Duraklama sonlandırılırken hata oluştu');
```

Şununla değiştir:
```jsx
            toast.error(error.response?.data?.message || 'Duraklama sonlandırılırken hata oluştu');
```

**17) `frontend/src/components/PauseManagement.jsx`** (yaklaşık 535. satır, "Devam Ettir" butonunun `onClick`'i)

Bul (dosyada tek geçer):
```jsx
                                                                                        setShowResumeModal(true);
```

Şununla değiştir (üstüne iki satır eklendi):
```jsx
                                                                                        // Varsayılan devam tarihi: şu an (yerel saat)
                                                                                        setResumeDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                                                                                        setShowResumeModal(true);
```

**18) `frontend/src/components/PauseManagement.jsx`** (yaklaşık 595. satır, "Devam Ettir" penceresi)

Bul:
```jsx
                                placeholder="Duraklamanın neden sonlandırıldığını açıklayın..."
                            />
                        </div>
```

Şununla değiştir (altına yeni bir alan eklendi):
```jsx
                                placeholder="Duraklamanın neden sonlandırıldığını açıklayın..."
                            />
                        </div>

                        <div style={styles.modalField}>
                            <label style={styles.label}>Devam Tarihi</label>
                            <input
                                type="datetime-local"
                                value={resumeDate}
                                onChange={(e) => setResumeDate(e.target.value)}
                                style={styles.textarea}
                            />
                        </div>
```

**Sonra:**
- Backend'i yeniden başlatın (`Ctrl+C`, `src/Api` klasöründe `dotnet run`).
- Frontend dosyalarını kaydedin. Veritabanı değişikliği (migration) **yok**.

**Kontrol:**
1. Durdurulmuş bir sorunun detayında durumu (ör. AÇIK) değiştirin → önce sadece tarih
   soran bir pencere çıkmalı ("Devam tarihi", şu anki saatle dolu).
2. Tarihi geçmişe (ama durdurma başlangıcından sonraya) alıp onaylayın → sorunun
   **Durdurma geçmişi**nde bitiş o tarih olmalı; süre buna göre hesaplanmalı.
3. Tarihi durdurma başlangıcından önceye alın → "Devam tarihi durdurma tarihinden önce
   olamaz" hatası gelmeli, sorun DURDURULDU kalmalı.
4. **Durdurma Yönetimi** sayfasında aktif bir durdurmada "Devam Ettir" → pencerede
   "Devam Tarihi" alanı olmalı; geçmiş bir tarihle devam ettirin → bitiş o tarih olmalı.
5. Durdurma sebebi penceresi (D-003) eskisi gibi hem sebep hem tarih sormalı.

---

### D-005 — Excel'de durdurma tarihlerinin doğru aktarılması
- **Tarih:** 2026-09-24
- **Neden:** Excel'deki "Duraklatma N Başlangıç / Bitiş" sütunları gerçek durdurma
  kayıtlarından değil, sorun geçmişindeki durum değişikliği kayıtlarının **işlem
  saatinden** hesaplanıyordu. Sonuçları:
  - D-003/D-004 ile seçilen geçmiş tarihler Excel'e yansımıyordu (işlem saati çıkıyordu).
  - Eski çift kayıt hatası (D-002 öncesi) yüzünden bazı sorunlarda Excel, gerçek
    durdurma yerine **birkaç saniyelik** sahte bir durdurma gösteriyordu
    (geliştirme veritabanında #24: gerçek 13.01–28.01.2026, Excel'de 13.01 16:22–16:22).
  - Silinen durdurmalar Excel'de görünmeye devam ediyordu.

  Artık Excel, Durdurmalar sayfası ve sorun detayıyla **aynı kaynaktan** (durdurma
  kayıtları) okuyor.
- **Bilinen etki:** Durdurma kayıt tablosu kullanılmaya başlamadan önce (geliştirme
  veritabanında Ocak 2026 öncesi) yapılmış ve tabloda kaydı olmayan eski durdurmalar
  artık Excel'de **görünmez** (geliştirme veritabanında #11 ve #37). Bu durdurmalar
  Durdurmalar sayfasında ve sorun detayında zaten görünmüyordu. Tabloya aktarılmaları
  istenmedi.
- **Bölüm:** backend
- **Commit:** `D-005:` ile başlayan commit
- [ ] Kapalı ağda uygulandı

**1) `src/Api/Controllers/TicketsController.cs`** (yaklaşık 1109. satır, `ExportToExcel` metodu)

> Dikkat: `.Include(t => t.Actions)` dosyada **iki kez** geçer (biri ~295. satırda,
> ona dokunmayın). Değişecek olan, hemen altında `ActivityControlCommander` satırı olan,
> `ExportToExcel` içindekidir.

Bul:
```csharp
                .Include(t => t.Actions)
                .Include(t => t.ActivityControlCommander)
```

Şununla değiştir (sadece ilk satır değişti: `Actions` → `Pauses`):
```csharp
                .Include(t => t.Pauses)
                .Include(t => t.ActivityControlCommander)
```

**2) `src/Api/Services/ExcelExportService.cs`** (yaklaşık 269. satır, `GetPauseIntervals` fonksiyonu)

Fonksiyonun **gövdesinin tamamını** değiştirin: `private List<PauseInterval> GetPauseIntervals(Ticket ticket)`
satırının altındaki `{` ile fonksiyonun kapanış `}`'si arasındaki her şeyi (yaklaşık 40 satır;
`var result = new List<PauseInterval>();` ile başlar, `return result;` ile biter) silin.

Sonuç şöyle olmalı:
```csharp
        private List<PauseInterval> GetPauseIntervals(Ticket ticket)
        {
            // Durdurma kayıtlarından (ticket_pause) oku: seçilen geçmiş tarihler ve silinen durdurmalar doğru yansır
            return ticket.Pauses
                .OrderBy(p => p.PausedAt)
                .Select(p => new PauseInterval(p.PausedAt, p.ResumedAt))
                .ToList();
        }
```

<details>
<summary>Silinecek eski gövde (karşılaştırma için)</summary>

```csharp
            var result = new List<PauseInterval>();

            // Only StatusChange actions are relevant for status transitions
            var statusChanges = ticket.Actions
                .Where(a => a.ActionType == ActionType.StatusChange)
                .OrderBy(a => a.PerformedAt)
                .ToList();

            if (!statusChanges.Any())
                return result;

            for (int i = 0; i < statusChanges.Count; i++)
            {
                var current = statusChanges[i];

                // We only care about transitions TO PAUSED
                if (current.ToStatus == TicketStatus.PAUSED)
                {
                    var start = current.PerformedAt;

                    // Find next transition that LEAVES PAUSED
                    var next = statusChanges
                        .Skip(i + 1)
                        .FirstOrDefault(a => a.FromStatus == TicketStatus.PAUSED);

                    // If we never leave PAUSED, we ignore this incomplete interval
                    if (next != null)
                    {
                        result.Add(new PauseInterval(start, next.PerformedAt));

                        // Jump index to the exit action so we don't reuse it
                        i = statusChanges.IndexOf(next);
                    }
                    else
                    {
                        result.Add(new PauseInterval(start, null));
                    }
                }
            }

            return result;
```
</details>

**Sonra:** Backend'i yeniden başlatın (`Ctrl+C`, `src/Api` klasöründe `dotnet run`).
Frontend ve veritabanı değişikliği **yok**.

**Kontrol:**
1. Sorunlar sayfasından Excel'e aktarın.
2. Durdurulmuş bir sorunun "Duraklatma 1 Başlangıç / Bitiş" değerleri, o sorunun
   **Durdurma geçmişi**ndeki (sorun detayı) başlangıç/bitiş tarihleriyle aynı olmalı.
3. Geçmiş tarihle durdurulmuş/devam ettirilmiş bir sorunda Excel'de seçilen tarihler görünmeli.

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
