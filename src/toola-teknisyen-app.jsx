import { useState, useEffect, useRef } from "react";
import {
  Menu, ChevronLeft, ChevronRight, History as HistoryIcon, Mic, Plus, Keyboard,
  ArrowUp, MapPin, Zap, Clock, AlertTriangle, Package, Wrench, User, Sparkles,
  CheckCircle2, PauseCircle, QrCode, HelpCircle, Camera, Video, Gauge, FileText,
  Image as ImageIcon, X, Brain, ClipboardList, MessageSquare, Navigation, Phone,
} from "lucide-react";

/* ---------------------------------------------------------------------
   Design tokens — extracted from the reference screens
--------------------------------------------------------------------- */
const INK = "#17181C";
const MUTED = "#82868D";
const CARD_BG = "#FFFFFF";
const DOCK_DARK = "#15171B";
const CARD_SHADOW = "0 10px 26px rgba(23,24,28,0.07), 0 2px 6px rgba(23,24,28,0.04)";
const FLOAT_SHADOW = "0 6px 16px rgba(23,24,28,0.10)";
const PAGE_GRADIENT =
  "linear-gradient(150deg, #E3F0E1 0%, #F1EFE8 38%, #FBE4DA 72%, #F6D9E4 100%)";
const TECH_NAME = "Emre";

/* ---------------------------------------------------------------------
   Data — same shape as the original repo's mock-data.ts, trimmed
--------------------------------------------------------------------- */
const TASK_LABEL = { ariza: "Arıza", bakim: "Bakım", kurulum: "Kurulum", test: "Test" };
const PRIORITY_LABEL = { dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek", kritik: "Kritik" };
// Four statuses only — a technician's world: to do, working on it, waiting, done.
// Legacy keys (yoldayim, teshis) alias to "Sahada" for previously stored data.
const STATUS_LABEL = {
  atandi: "Atandı", sahadayim: "Sahada", beklemede: "Beklemede", tamamlandi: "Tamamlandı",
  yoldayim: "Sahada", teshis: "Sahada",
};

const TASK_TONE = {
  ariza: ["#FDEAEA", "#C53434"], bakim: ["#E7F1FC", "#2563A6"],
  kurulum: ["#F1EAFB", "#7C3AED"], test: ["#E8F7EE", "#1F8A4C"],
};
const PRIORITY_TONE = {
  dusuk: ["#F1EFE9", "#82868D"], orta: ["#E7F1FC", "#2563A6"],
  yuksek: ["#FDF3E4", "#9C6B0A"], kritik: ["#E11D48", "#FFFFFF"],
};
const STATUS_TONE = {
  atandi: ["#F1EFE9", "#82868D"], sahadayim: ["#E8F7EE", "#1F8A4C"],
  beklemede: ["#FDF3E4", "#9C6B0A"], tamamlandi: ["#DCF3E3", "#1F8A4C"],
  yoldayim: ["#E8F7EE", "#1F8A4C"], teshis: ["#E8F7EE", "#1F8A4C"],
};

const HOLD_REASONS = [
  { id: "parca_bekliyor", label: "Parça bekliyor" },
  { id: "uzman_destegi", label: "Uzman desteği gerekiyor" },
  { id: "onay_bekliyor", label: "Amir onayı bekleniyor" },
  { id: "guvenlik_erisim", label: "Güvenlik / erişim engeli" },
  { id: "makine_durdurulamiyor", label: "Makine durdurulamıyor" },
  { id: "olcum_ekipmani", label: "Ölçüm/test ekipmanı gerekiyor" },
  { id: "tekrar_uretilemiyor", label: "Arıza tekrar üretilemiyor" },
  { id: "diger", label: "Diğer" },
];
const HOLD_LABEL = Object.fromEntries(HOLD_REASONS.map((r) => [r.id, r.label]));
// Next action is implied by the reason — the technician shouldn't have to type it.
// ONE closure-quality rule set — mirrored verbatim from the panel's
// src/lib/canonical.ts so the score the technician sees at closure equals
// the score the office audits. Five checks × 20 points.
function computeClosureQuality(c) {
  const missing = [];
  let score = 100;
  if (!c.symptom || !String(c.symptom).trim()) { score -= 20; missing.push("belirti"); }
  if (!c.rootCause || !String(c.rootCause).trim()) { score -= 20; missing.push("kök neden"); }
  if (!c.intervention || !String(c.intervention).trim()) { score -= 20; missing.push("müdahale"); }
  if (!c.outcome || !String(c.outcome).trim()) { score -= 20; missing.push("sonuç"); }
  if (!c.evidenceCount || c.evidenceCount < 1) { score -= 20; missing.push("kanıt"); }
  return { score: Math.max(0, score), missing };
}

// Published corporate memory (seed). In production this list is fed by the
// panel's approval queue; here it powers the "kurumsal hafızadan" badge and
// the one-tap "işe yaradı" feedback loop.
const SEED_MEMORY = [
  {
    id: "MEM-P-073", status: "published", uses: 12, sourceJob: "WO-1842", equipmentKind: "pompa",
    statement: "P-204'te yüksek ses ve titreşim varsa rulman değişiminden önce kaplin hizası kontrol edilmeli.",
  },
  {
    id: "MEM-P-081", status: "published", uses: 9, sourceJob: "WO-1701", equipmentKind: "klima",
    statement: "Düşük gaz basıncında şarj etmeden önce mutlaka kaçak testi yapılmalı.",
  },
];

const MEMORY_FEEDBACK_REASONS = [
  { id: "farkli", label: "Belirti farklıydı" },
  { id: "uygulanamadi", label: "Uygulanamadı" },
  { id: "denemistim", label: "Zaten denemiştim" },
];

const HOLD_NEXT = {
  parca_bekliyor: "Parça temini takip edilecek",
  uzman_destegi: "Uzman ekip yönlendirilecek",
  onay_bekliyor: "Amir onayı bekleniyor",
  guvenlik_erisim: "Erişim izni planlanacak",
  makine_durdurulamiyor: "Duruş penceresi planlanacak",
  olcum_ekipmani: "Ölçüm ekipmanı temin edilecek",
  tekrar_uretilemiyor: "Gözlem altında tutulacak",
  diger: "Merkez değerlendirecek",
};

// Rule: button count = sensor count. Kamera (eye), Ses (ear), Ölçüm (tool).
// Content categories (parça, hata kodu, öncesi/sonrası) are OPTIONAL one-tap
// tags AFTER capture — classification is ToolA's job, not the technician's.
const QUICK_EVIDENCE = [
  { type: "foto", label: "Fotoğraf / Video", icon: Camera, note: "Fotoğraf/video yakalandı" },
  { type: "ses", label: "Sesli gözlem", icon: Mic, note: "Sesli gözlem kaydedildi" },
];

const EVIDENCE_TAGS = ["Öncesi", "Sonrası", "Parça", "Hata kodu"];

// Typed measurements: gloves can tap a chip and punch a number; nobody
// should have to type "Yatak sıcaklığı 72°C" in the field.
const MEASURE_TYPES = [
  { id: "sicaklik", label: "Sıcaklık", unit: "°C" },
  { id: "titresim", label: "Titreşim", unit: "mm/s" },
  { id: "basinc", label: "Basınç", unit: "bar" },
  { id: "voltaj", label: "Voltaj", unit: "V" },
];

const SUGGESTED_BY_KIND = {
  pompa: ["Kaplin mi rulman mı nasıl ayırt ederim?", "Titreşim değeri normal mi?", "Kapanış için hangi ölçüm gerekli?"],
  klima: ["Önce filtre mi gaz mı kontrol edeyim?", "Gaz basıncı ne olmalı?", "Kapanış için hangi ölçüm gerekli?"],
  jenerator: ["Akü sağlıklı mı nasıl anlarım?", "Yağ değişimi ne zaman gerekir?"],
  konveyor: ["Hangi switch'leri sırayla test etmeliyim?", "Test etiketine ne yazayım?"],
  genel: ["Önce neyi kontrol etmeliyim?", "Bu ölçüm normal mi?"],
};

const ASSISTANT_SUGGESTIONS = [
  "Pompa titreşim eşiği ne kadar olmalı?",
  "Klima gaz basıncı düşükse ne kontrol edilir?",
  "Jeneratör akü testinde geçerli değer aralığı?",
  "Aktif işim için kapanışa yeterli kanıtım var mı?",
];

function seedJobs() {
  const now = Date.now();
  const hrs = (h) => new Date(now + h * 3600 * 1000).toISOString();
  return [
    {
      id: "job-1842", code: "WO-2041", taskType: "ariza",
      title: "Pompa P-204 yüksek ses ve titreşim",
      equipment: "Santrifüj Pompa P-204", location: "Ünite 2 · Pompa Odası",
      description: "Vardiya operatörü sabah 07:20'de olağandışı metalik ses ve titreşim bildirdi. Debi normal, sıcaklık artışı yok.",
      priority: "yuksek", status: "atandi", assignedBy: "Merkez Bakım · E. Yıldız", contactPhone: "+90 555 111 22 33",
      centralNote: "Son 90 günde 3 benzer kayıt var. Kaplin hizası ve yatak sıcaklığı öncelikli kontrol edilsin.",
      dueAt: hrs(4), featured: true,
      history: [
        { id: "h1", date: "12 gün önce", summary: "Yüksek titreşim", rootCause: "Kaplin hizasızlığı", intervention: "Lazer hizalama yapıldı" },
        { id: "h2", date: "38 gün önce", summary: "Ses ve ısınma", rootCause: "Rulman aşınması", intervention: "Rulman değiştirildi", partChanged: "SKF 6208-2RS" },
      ],
      bringItems: ["Titreşim ölçer", "Lazer hizalama seti", "Termal kamera", "Yedek kaplin elemanı"],
      evidence: [],
    },
    {
      id: "job-1843", code: "WO-2033", taskType: "ariza",
      title: "Klima Oda 304 soğutmuyor",
      equipment: "Split Klima 12k · Oda 304", location: "İdari Blok · 3. Kat",
      description: "Set 22°C, ölçülen 27°C. Fan çalışıyor, dış ünite sesi normal.",
      priority: "orta", status: "atandi", assignedBy: "Merkez Bakım · E. Yıldız", contactPhone: "+90 555 111 22 33", verifyRequired: true, seenAt: "2026-07-09T08:10:00Z",
      dueAt: hrs(8),
      history: [{ id: "h1", date: "1 yıl önce", summary: "Yıllık bakım", rootCause: "Rutin", intervention: "Filtre + gaz kontrolü" }],
      bringItems: ["Manometre seti", "Multimetre", "Gaz kontrol ekipmanı"],
      evidence: [],
    },
    {
      id: "job-1844", code: "WO-2019", taskType: "bakim",
      title: "Jeneratör G-12 haftalık kontrol",
      equipment: "Jeneratör G-12 · 250 kVA", location: "Enerji Merkezi",
      description: "Haftalık rutin: yağ, yakıt, akü, çalıştırma testi.",
      priority: "dusuk", status: "atandi", assignedBy: "Planlı Bakım", seenAt: "2026-07-08T07:30:00Z",
      dueAt: hrs(24),
      history: [{ id: "h1", date: "7 gün önce", summary: "Haftalık kontrol", rootCause: "Rutin", intervention: "Yağ, yakıt, akü kontrolü" }],
      bringItems: ["Multimetre", "Akü test cihazı"],
      evidence: [],
    },
    {
      id: "job-1846", code: "WO-2027", taskType: "test",
      title: "Konveyör güvenlik switch testi",
      equipment: "Konveyör K-3", location: "Paketleme · Hat 3",
      description: "Acil stop ve pull-cord switch testi. Aylık rutin.",
      priority: "orta", status: "atandi", assignedBy: "İSG", contactPhone: "+90 555 444 55 66", seenAt: "2026-07-08T07:30:00Z",
      history: [{ id: "h1", date: "30 gün önce", summary: "Aylık güvenlik testi", rootCause: "Rutin", intervention: "Tüm switch'ler test edildi · OK" }],
      bringItems: ["Multimetre", "Test etiketi", "LOTO seti"],
      evidence: [],
    },
  ];
}

/* ---------------------------------------------------------------------
   Small helpers
--------------------------------------------------------------------- */
function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} dk`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} sa`;
  return `${Math.round(hrs / 24)} gün`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

function formatDue(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const h = Math.round(diffMs / 3600000);
  if (h <= 0) return `${Math.abs(h)} saat gecikmiş`;
  if (h < 24) return `${h} saat içinde`;
  return `${Math.round(h / 24)} gün içinde`;
}

const PRIORITY_RANK = { kritik: 0, yuksek: 1, orta: 2, dusuk: 3 };
function sortByTriage(list) {
  return [...list].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return ad - bd;
  });
}

function jobKind(job) {
  const s = `${job.equipment} ${job.title}`.toLowerCase();
  if (s.includes("pompa")) return "pompa";
  if (s.includes("klima")) return "klima";
  if (s.includes("jenerat")) return "jenerator";
  if (s.includes("konvey")) return "konveyor";
  return "genel";
}

function renderBold(text) {
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: INK, fontWeight: 700 }}>{p}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildInitialAiMessage(job, memoryRec) {
  const base = buildInitialAiMessageBase(job);
  if (memoryRec) {
    base.memoryRef = memoryRec;
    base.sources = [{ label: "Kurumsal hafıza", detail: `${memoryRec.id} · ${memoryRec.uses} teşhis` }, ...(base.sources || [])];
  }
  return base;
}

function buildInitialAiMessageBase(job) {
  const kind = jobKind(job);
  const evCount = job.evidence.length;
  const evPart = evCount === 0 ? "Henüz kanıt yok" : `Topladığın ${evCount} kanıt`;

  if (kind === "pompa") {
    return {
      id: "ai-init", role: "ai",
      text: `${evPart} ve ekipman geçmişine göre en olası neden **kaplin hizasızlığı**. Önce yatak sıcaklığını, kaplin hizasını ve titreşim değerini kontrol etmeni öneririm.`,
      causes: [
        { title: "Kaplin hizasızlığı", pct: 66, detail: "Son çözümlerin çoğu hizalamayla kapanmış." },
        { title: "Yatak / rulman aşınması", pct: 28, detail: "38 gün önce rulman değiştirilmiş." },
        { title: "Kavitasyon", pct: 6, detail: "Debi normal olduğu için düşük ihtimal." },
      ],
      checks: [
        { label: "Kaplin hizası (lazer)", hint: "≤ 0.05 mm" },
        { label: "Yatak sıcaklığı", hint: "< 65°C" },
        { label: "Titreşim ölçümü", hint: "ISO 10816 Zone A/B" },
      ],
      sources: [
        { label: "Önceki kapanış", detail: "WO-1842 · kaplin hizası" },
        { label: "İş emri WO-1780", detail: "rulman değişimi" },
        { label: "Kılavuz", detail: "s.42" },
      ],
      actions: [
        { id: "checked", label: "Kontrolü yaptım", payload: "Kontrolü yaptım, sırada ne var?" },
        { id: "measure", label: "Ölçüm ekle" },
        { id: "confirm", label: "Sorun bu çıktı" },
        { id: "reject", label: "Sorun bu değil", payload: "Bu sorun değilmiş, başka ne olabilir?" },
      ],
    };
  }
  if (kind === "klima") {
    return {
      id: "ai-init", role: "ai",
      text: `${evPart} ve ekipman geçmişine göre soğutmama en çok **düşük gaz basıncı** ya da **tıkalı filtre** kaynaklı. Önce filtreyi kontrol et, sonra gaz basıncını ölç.`,
      causes: [
        { title: "Gaz kaçağı / düşük şarj", pct: 55 },
        { title: "Tıkalı filtre / evaporatör", pct: 30 },
        { title: "Kontaktör / elektriksel", pct: 8 },
      ],
      checks: [
        { label: "Filtre görsel kontrol" },
        { label: "Gaz basıncı ölçümü", hint: "dış ünite" },
        { label: "Üfleme sıcaklığı", hint: "iç ünite çıkışı" },
      ],
      sources: [
        { label: "Kılavuz", detail: "s.14" },
        { label: "Servis notu", detail: "genel arıza akışı" },
      ],
      actions: [
        { id: "checked", label: "Filtreyi kontrol ettim", payload: "Filtreyi kontrol ettim, sırada ne var?" },
        { id: "measure", label: "Gaz basıncı ölçümü ekle" },
        { id: "confirm", label: "Sorun bu çıktı" },
        { id: "reject", label: "Sorun bu değil", payload: "Bu sorun değilmiş, başka ne olabilir?" },
      ],
    };
  }
  return {
    id: "ai-init", role: "ai",
    text: `${evPart} ile başlıyoruz. Bu ekipmanda geçmiş kayıt sınırlı; önce görsel + işitsel kontrol, sonra bir referans ölçüm mantıklı.`,
    checks: [{ label: "Görsel kontrol" }, { label: "Referans ölçüm al ve önceki değerle karşılaştır" }],
    sources: [{ label: "Prosedür", detail: "Genel teşhis akışı" }],
    actions: [
      { id: "checked", label: "Görsel kontrolü yaptım", payload: "Görsel kontrolü yaptım, sırada ne var?" },
      { id: "measure", label: "Ölçüm ekle" },
      { id: "confirm", label: "Sorun bu çıktı" },
    ],
  };
}

function buildFollowUpAiMessage(job, question) {
  const q = question.toLowerCase();
  const kind = jobKind(job);
  let text;
  if (kind === "pompa") {
    if (q.includes("hiza")) text = "Hizalama normal çıktıysa **yatak/rulman aşınmasına** yönel. Sıcaklık ölçümünü referans al (< 65°C).";
    else if (q.includes("rulman")) text = "Rulman şüphesi güçlüyse ısı ve ses birlikte değerlendirilmeli. Değişim öncesi yatak sıcaklığını ölç.";
    else if (q.includes("kapat") || q.includes("kanıt")) text = "Kapanış için: kaplin hizası ölçümü, yatak sıcaklığı ve test sonrası ses kaydı yeterli olur.";
    else text = "Elimdeki kayıtlara göre kaplin hizası hâlâ en güçlü aday. İlgili ölçümü ekleyip devam edebiliriz.";
  } else if (kind === "klima") {
    text = q.includes("gaz")
      ? "Gaz basıncı düşükse önce kaçak testi (köpük/elektronik dedektör), sonra şarj miktarı kontrol edilir."
      : "Filtre temizse gaz basıncına geç. Set-ölçüm farkı 5°C üzerindeyse kaçak ihtimali yüksek.";
  } else {
    text = "Elimdeki prosedürlere göre birlikte ilerleyelim. Ölçüm veya fotoğraf eklersen daha net yönlendirebilirim.";
  }
  return {
    id: uid("ai"), role: "ai", text,
    sources: [{ label: "Bakım kılavuzu", detail: "ilgili bölüm" }],
    actions: [{ id: "confirm", label: "Kapanışa geç" }, { id: "hold", label: "Beklemeye al" }],
  };
}

function assistantMockAnswer(q) {
  const s = q.toLowerCase();
  if (s.includes("titreşim") || s.includes("pompa"))
    return "Santrifüj pompalarda genel eşik: RMS < 4.5 mm/s normal, 4.5–7.1 mm/s uyarı, >7.1 mm/s müdahale. Kaplin hizası ve yatak durumu birlikte değerlendirilmeli.";
  if (s.includes("klima") || s.includes("gaz"))
    return "Gaz basıncı düşükse önce kaçak testi, ardından şarj miktarı kontrol edilir. Filtre ve evaporatör hava akışı da doğrulanmalı.";
  if (s.includes("kanıt") || s.includes("kapan"))
    return "Kapanış için genelde: belirti fotoğrafı, ölçüm, müdahale sonrası fotoğraf ve test sonucu gerekir.";
  if (s.includes("kaplin"))
    return "Kaplin hizası için lazer hizalama toleransı genelde ≤ 0.05 mm olmalı. Sapma büyükse önce yeniden hizalama yapılır.";
  return "Elimdeki prosedürlere ve benzer vakalara göre birlikte adım adım ilerleyelim. Ekipman ya da iş numarası verirsen daha spesifik yanıtlayabilirim.";
}

// Routine jobs (bakım/test) close with a checklist + pass/fail, not a root
// cause — asking "kök neden" on a weekly generator check was a category error.
const CHECKLIST_BY_KIND = {
  jenerator: ["Yağ seviyesi", "Yakıt seviyesi", "Akü voltajı", "Test çalıştırma"],
  konveyor: ["Acil stop butonları", "Kapı switch'leri", "Hız sensörü", "Test etiketi"],
  klima: ["Filtre temizliği", "Gaz basıncı", "Drenaj hattı", "Test çalıştırma"],
  pompa: ["Yağlama", "Kaplin görsel kontrol", "Titreşim ölçümü", "Test çalıştırma"],
  genel: ["Görsel kontrol", "Fonksiyon testi", "Temizlik", "Etiketleme"],
};

function routineClosure(job, checks, note) {
  // Three honest states: geçti / kaldı / yapılamadı (N-A). Forcing a binary
  // choice on an untestable item (machine running, no access) forces a lie.
  const failed = checks.filter((c) => c.state === "kaldi");
  const na = checks.filter((c) => c.state === "na");
  const done = checks.length - na.length;
  const naNote = na.length ? ` ${na.length} kalem yapılamadı (${na.map((x) => x.label).join(", ")}).` : "";
  return {
    symptom: job.taskType === "test" ? "Periyodik güvenlik testi" : "Planlı bakım",
    rootCause: "Rutin",
    intervention: `${checks.length} kalemden ${done} kontrol edildi — ${done - failed.length}/${done} geçti.${naNote}` + (note.trim() ? ` Not: ${note.trim()}` : ""),
    partUsed: undefined,
    outcome: failed.length
      ? `${failed.length} kalem takip gerektiriyor: ${failed.map((f) => f.label).join(", ")}`
      : na.length
        ? `Kontrol edilenler geçti; ${na.length} kalem sonraki ziyarete kaldı`
        : "Tüm kalemler geçti",
    memoryCandidate: failed.length
      ? note.trim()
        ? `${job.equipment} · ${failed[0].label}: ${note.trim().slice(0, 160)}`
        : `${job.equipment}: rutinde takılan ilk kalem → ${failed[0].label}.`
      : null,
    failedItems: failed.map((f) => f.label),
    rawNote: note.trim() || undefined,
  };
}

function draftClosure(job, note) {
  const text = note.toLowerCase();
  const partMatch = text.match(/(rulman|kaplin|filtre|conta|kayış|sensör|kart|fan)/);
  return {
    symptom: job.title,
    rootCause: text.includes("hiza") ? "Kaplin hizasızlığı"
      : text.includes("rulman") ? "Yatak / rulman aşınması"
      : text.includes("filtre") ? "Tıkalı filtre"
      : "Belirtiye özel — teknisyen notundan çıkarıldı",
    intervention: note.trim() || "Saha müdahalesi yapıldı.",
    partUsed: partMatch ? partMatch[1] : undefined,
    outcome: text.includes("kesildi") || text.includes("normal") || text.includes("çözüldü")
      ? "Belirti giderildi, çalışma normale döndü" : "Müdahale tamamlandı",
    memoryCandidate: `${job.equipment}: benzer belirtide ilk kontrol → ${text.includes("hiza") ? "kaplin hizası" : "görsel kontrol ve ölçüm"}.`,
  };
}

// Values that draftClosure/routineClosure emit when the note wasn't specific
// enough to infer a real root cause or intervention. Treat these as "no data",
// never as a real technical decision — otherwise the gap detector fires on
// noise ("intervention differs from initial check" when the intervention is
// literally the string "Saha müdahalesi yapıldı").
const DECISION_PLACEHOLDERS = [
  "belirtiye özel — teknisyen notundan çıkarıldı",
  "belirtiye ozel — teknisyen notundan cikarildi",
  "saha müdahalesi yapıldı",
  "saha müdahalesi yapıldı.",
  "saha mudahalesi yapildi",
  "müdahale tamamlandı",
  "mudahale tamamlandi",
  "belirlenemedi",
  "diğer",
  "diger",
  "rutin",
  "planlı bakım",
  "planli bakim",
  "periyodik güvenlik testi",
  "periyodik guvenlik testi",
];
function isPlaceholderValue(v) {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  if (s.length < 4) return true;
  return DECISION_PLACEHOLDERS.some((p) => s === p || s.startsWith(p));
}

// Very light equipment classification — used only to pick a realistic
// placeholder example inside the decision-gap textarea. Never affects logic.
function equipmentKind(job) {
  const t = `${job?.equipment || ""} ${job?.title || ""}`.toLowerCase();
  if (/(klima|split|vrf|çiller|chiller|soğutma|sogutma|fan coil)/.test(t)) return "klima";
  if (/(kompresör|kompresor)/.test(t)) return "kompresor";
  if (/(pompa|pump)/.test(t)) return "pompa";
  if (/(motor|rulman|kaplin|titreşim|titresim)/.test(t)) return "motor";
  if (/(pano|kart|sensör|sensor|plc|invertör|invertor)/.test(t)) return "elektrik";
  return "genel";
}
function decisionPlaceholderFor(job) {
  switch (equipmentKind(job)) {
    case "klima":
      return "Örn: Gaz basıncı normaldi ancak filtre tamamen tıkalıydı; bu yüzden gaz kaçağı yerine hava akışı problemine yöneldim.";
    case "kompresor":
      return "Örn: Hat basıncı sınırdaydı ama çek valfte kaçak sesi vardı; bu yüzden regülatör ayarı yerine valfi söktüm.";
    case "pompa":
      return "Örn: Debi düşüktü ama emiş hattında hava vardı; bu yüzden salmastra yerine emiş körlemesini kontrol ettim.";
    case "motor":
      return "Örn: Yatak sıcaklığı normaldi ama titreşim Zone C'deydi; bu yüzden rulman yerine kaplin hizasına yöneldim.";
    case "elektrik":
      return "Örn: Sigorta sağlamdı ama kontaktör bobininde gerilim düşüktü; bu yüzden yükü değil kumanda devresini kontrol ettim.";
    default:
      return "Ölçümler ve gözlemler bu karara nasıl yönlendirdi, kısaca anlat.";
  }
}

// Knowledge Gap Detector — only fires on a real, high-value technical decision:
//   • initial diagnosis and final root cause are different AND both are real
//     (not placeholder strings),
//   • suggested check and performed intervention are different AND intervention
//     is real,
//   • kurumsal hafıza önerisi reddedildi ve elimizde gerçek bir kök neden var.
// Returns null on routine work, placeholder-only closures, or otherwise
// well-explained closures — those go straight to the existing review screen.
function detectDecisionGap(job, aiMessages, fields) {
  if (!job || !fields) return null;
  const norm = (s) => (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  const overlap = (a, b) => {
    const A = norm(a).split(/\s+/).filter((w) => w.length > 3);
    const B = norm(b);
    return A.some((w) => B.includes(w));
  };
  const aiWithCauses = (aiMessages || []).filter((m) => m.role === "ai" && m.causes && m.causes.length);
  const initialDiagnosis = aiWithCauses.length ? aiWithCauses[0].causes[0].title : null;
  const initialChecks = aiWithCauses.length ? (aiWithCauses[0].checks || []).map((c) => c.label) : [];

  const finalRootCause = fields.rootCause || "";
  const intervention = fields.intervention || "";
  const outcome = fields.outcome || "";

  const rootIsReal = !isPlaceholderValue(finalRootCause);
  const interventionIsReal = !isPlaceholderValue(intervention);
  const initialIsReal = initialDiagnosis && !isPlaceholderValue(initialDiagnosis);

  const causeDiffers =
    initialIsReal && rootIsReal &&
    !overlap(initialDiagnosis, finalRootCause) && !overlap(finalRootCause, initialDiagnosis);

  const checkDiffers =
    initialChecks.length && interventionIsReal &&
    !initialChecks.some((c) => overlap(c, intervention));

  const memRejected =
    job.memoryFeedback &&
    (job.memoryFeedback.verdict === "notthis" ||
     job.memoryFeedback.verdict === "didnt-work" ||
     job.memoryFeedback.verdict === "rejected") &&
    rootIsReal;

  if (!causeDiffers && !checkDiffers && !memRejected) return null;

  let question;
  if (causeDiffers) {
    question = `İlk olası neden "${initialDiagnosis}" idi. Ancak gerçek kök neden "${finalRootCause}" olarak belirlendi. "${initialDiagnosis}" ihtimalini elemenize hangi ölçüm veya gözlem neden oldu?`;
  } else if (memRejected) {
    question = `Kurumsal hafıza önerisi bu işte yaramadı. "${finalRootCause}" kararını almanızı sağlayan gözlem veya ölçüm neydi?`;
  } else {
    question = `Önerilen kontroller "${initialChecks.slice(0, 2).join(", ")}" iken siz "${intervention.slice(0, 80)}${intervention.length > 80 ? "…" : ""}" yaptınız. Bu yöne sizi ne yönlendirdi?`;
  }

  const contextText = causeDiffers
    ? `İlk teşhis "${initialDiagnosis}" idi; iş "${finalRootCause}" olarak çözüldü.`
    : memRejected
      ? `Kurumsal hafıza önerisi reddedildi; kök neden "${finalRootCause}" olarak belirlendi.`
      : `Önerilen kontrol ile yapılan müdahale farklı.`;

  return {
    initialDiagnosis: initialIsReal ? initialDiagnosis : null,
    finalRootCause: rootIsReal ? finalRootCause : null,
    intervention: interventionIsReal ? intervention : null,
    outcome: isPlaceholderValue(outcome) ? null : outcome,
    question,
    contextText,
    reason: causeDiffers ? "cause_differs" : memRejected ? "memory_rejected" : "intervention_differs",
    // legacy alias so any older reader keeps working
    initialCause: initialIsReal ? initialDiagnosis : null,
    rootCause: rootIsReal ? finalRootCause : null,
  };
}

// Turns an AI-diagnosis conversation into a starter note for Close, so confirming
// "sorun bu çıktı" doesn't throw away what was just figured out together.
function summarizeDiagnosis(job, messages) {
  if (!messages || messages.length === 0) return "";
  const aiWithCauses = messages.filter((m) => m.role === "ai" && m.causes && m.causes.length);
  const top = aiWithCauses.length ? aiWithCauses[aiWithCauses.length - 1].causes[0] : null;
  if (!top) return "";
  const userNotes = messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");
  return `${top.title}. ${userNotes}`.trim();
}

/* ---------------------------------------------------------------------
   UI atoms
--------------------------------------------------------------------- */
function IconBtn({ icon: Icon, onClick, size = 18 }) {
  return (
    <button
      type="button" onClick={onClick} aria-label="action"
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: 40, height: 40, background: "rgba(255,255,255,0.72)", boxShadow: FLOAT_SHADOW, backdropFilter: "blur(10px)", border: "none" }}
    >
      <Icon size={size} style={{ color: INK }} strokeWidth={2} />
    </button>
  );
}

// Navigation is a single tree: home is the only root, every other screen backs
// out with the chevron. No hamburger — three duplicated destinations don't earn
// a hidden menu.
function TopBar({ mode, onBack, right }) {
  return (
    <div
      className="flex items-center justify-between pt-1 pb-3"
      style={{ position: "sticky", top: 0, zIndex: 30, pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>
        {mode === "back" ? <IconBtn icon={ChevronLeft} onClick={onBack} /> : <div style={{ width: 40, height: 40 }} />}
      </div>
      <div style={{ pointerEvents: "auto" }}>{right || <div style={{ width: 40, height: 40 }} />}</div>
    </div>
  );
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {Icon ? <Icon size={12} style={{ color: MUTED }} /> : null}
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{children}</span>
    </div>
  );
}

function Chip({ bg, fg, children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
function TaskChip({ type }) { const [bg, fg] = TASK_TONE[type]; return <Chip bg={bg} fg={fg}>{TASK_LABEL[type]}</Chip>; }
function PriorityChip({ priority }) { const [bg, fg] = PRIORITY_TONE[priority]; return <Chip bg={bg} fg={fg}>{PRIORITY_LABEL[priority]}</Chip>; }
function StatusChip({ status }) { const [bg, fg] = STATUS_TONE[status]; return <Chip bg={bg} fg={fg}>{STATUS_LABEL[status]}</Chip>; }

// InfoRow can be tappable: pass onClick + actionIcon (e.g. map for location, phone
// for the assigner) and the row becomes a one-touch action instead of dead text.
function InfoRow({ icon: Icon, label, value, onClick, actionIcon: ActionIcon }) {
  const inner = (
    <>
      <Icon size={15} style={{ color: MUTED, marginTop: 2, flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
        <div className="text-sm mt-0.5" style={{ color: onClick ? "#2563A6" : INK }}>{value}</div>
      </div>
      {onClick && ActionIcon ? (
        <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, background: "#E7F1FC" }}>
          <ActionIcon size={14} style={{ color: "#2563A6" }} />
        </div>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-3 py-2.5 text-left" style={{ background: "none", border: "none" }}>
        {inner}
      </button>
    );
  }
  return <div className="flex items-start gap-3 px-3 py-2.5">{inner}</div>;
}

function FieldCard({ label, value, onChange, multiline, placeholder }) {
  return (
    <div className="rounded-2xl px-4 py-2.5" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder}
          className="mt-1 w-full resize-none bg-transparent text-sm outline-none" style={{ color: INK }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="mt-1 w-full bg-transparent text-sm outline-none" style={{ color: INK }} />
      )}
    </div>
  );
}

function CauseRow({ title, detail, pct, rank }) {
  const fill = rank === 0 ? "#15171B" : rank === 1 ? "#B7B2A6" : "#DAD6CC";
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: INK }}>{title}</span>
        <span className="text-xs font-semibold" style={{ color: rank === 0 ? INK : MUTED }}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: "#EEECE6" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
      {detail ? <p className="mt-1 text-xs" style={{ color: MUTED }}>{detail}</p> : null}
    </div>
  );
}

function CheckRow({ label, hint }) {
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <div className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2" style={{ borderColor: "#D8D5CC" }} />
      <div>
        <span style={{ color: INK }}>{label}</span>
        {hint ? <span className="ml-1 text-xs" style={{ color: MUTED }}>· {hint}</span> : null}
      </div>
    </div>
  );
}

// Asymmetric-friction feedback: "işe yaradı" is one tap and done; "yaramadı"
// reveals three optional one-tap reasons (skippable). Positive = zero friction,
// negative = one tap of context so the approver can act on it.
function MemoryFeedback({ feedback, onFeedback }) {
  const [showReasons, setShowReasons] = useState(false);
  if (feedback) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: feedback.verdict === "worked" ? "#1F8A4C" : MUTED }}>
        <CheckCircle2 size={13} />
        {feedback.verdict === "worked" ? "İşe yaradı — hafıza kaydına işlendi." : "Geri bildirimin kaydedildi, onaycıya iletilecek."}
      </div>
    );
  }
  if (showReasons) {
    return (
      <div className="mt-2">
        <div className="text-xs font-medium mb-1.5" style={{ color: MUTED }}>Neden yaramadı? (istersen)</div>
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_FEEDBACK_REASONS.map((r) => (
            <button key={r.id} type="button" onClick={() => onFeedback("not_worked", r.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "#fff", color: INK, boxShadow: FLOAT_SHADOW, border: "none" }}>
              {r.label}
            </button>
          ))}
          <button type="button" onClick={() => onFeedback("not_worked", null)}
            className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "none", color: MUTED, border: "none" }}>
            Atla
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-xs" style={{ color: MUTED }}>Bu öneri işe yaradı mı?</span>
      <button type="button" onClick={() => onFeedback("worked", null)}
        className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: DOCK_DARK, color: "#fff", border: "none" }}>
        İşe yaradı ✓
      </button>
      <button type="button" onClick={() => setShowReasons(true)}
        className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "#fff", color: INK, boxShadow: FLOAT_SHADOW, border: "none" }}>
        Yaramadı
      </button>
    </div>
  );
}

function AiAnswerCard({ msg, onAction, onSourceClick, memoryFeedback, onMemoryFeedback }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#6C8F73" }}>
        <Sparkles size={12} /> ToolA
      </div>
      <div className="rounded-3xl p-4" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <p className="text-sm leading-relaxed">{renderBold(msg.text)}</p>
        {msg.causes ? (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1EFE8" }}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Olası nedenler</div>
            {msg.causes.map((c, i) => <CauseRow key={i} {...c} rank={i} />)}
          </div>
        ) : null}
        {msg.checks ? (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1EFE8" }}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Önerilen kontroller</div>
            {msg.checks.map((c, i) => <CheckRow key={i} {...c} />)}
          </div>
        ) : null}
        {msg.memoryRef ? (
          <div className="mt-3 rounded-2xl px-3 py-2.5" style={{ background: "#EFF6F1" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#1F8A4C" }}>
              <Sparkles size={12} /> Kurumsal hafızadan · {msg.memoryRef.uses} teşhiste doğrulandı
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: INK }}>“{msg.memoryRef.statement}”</p>
            {onMemoryFeedback ? <MemoryFeedback feedback={memoryFeedback} onFeedback={onMemoryFeedback} /> : null}
          </div>
        ) : null}
        {msg.sources ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => (
              <button key={i} type="button" onClick={() => onSourceClick && onSourceClick(s)}
                className="rounded-full px-2.5 py-1 text-xs" style={{ background: "#F5F3EE", color: MUTED, border: "none" }}>
                ↳ <span className="font-medium" style={{ color: INK }}>{s.label}</span> · {s.detail}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {msg.actions ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {msg.actions.map((a) => (
            <button key={a.id} type="button" onClick={() => onAction(a)}
              className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "#fff", color: INK, boxShadow: FLOAT_SHADOW, border: "none" }}>
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DockIconBtn({ icon: Icon, onClick, dark }) {
  return (
    <button type="button" onClick={onClick} aria-label="action"
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 44, height: 44, border: "none",
        background: dark ? DOCK_DARK : "rgba(255,255,255,0.75)",
        boxShadow: dark ? "0 14px 28px rgba(21,23,27,0.35)" : FLOAT_SHADOW,
      }}>
      <Icon size={18} style={{ color: dark ? "#fff" : INK }} />
    </button>
  );
}

// Unified bottom dock. Every control has ONE distinct job:
//   keyboard  → floating composer (text on top; attach row + round send button, like the reference)
//   mic pill  → push-to-talk: HOLD to speak, RELEASE to send — the reply follows immediately
//   +         → context quick actions (menu supplied by the screen; hidden if none)
// On screens without their own chat (onAsk only), mic/keyboard route to the assistant.
function Dock({ placeholder = "ToolA'ya sor…", onSend, onAsk, primaryAction, plusItems, hideMic }) {
  const [mode, setMode] = useState(null); // null | "text" | "voice" | "plus"
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [listening, setListening] = useState(false);
  const [voiceState, setVoiceState] = useState(null); // "listening" | "hint" | "error"
  const [voiceText, setVoiceText] = useState("");
  const ref = useRef(null);
  const recRef = useRef(null);
  const voiceTextRef = useRef("");
  const holdRef = useRef({ active: false, startedAt: 0 });
  const hintTimerRef = useRef(null);

  useEffect(() => { if (mode === "text") ref.current?.focus(); }, [mode]);
  useEffect(() => () => {
    try { recRef.current?.stop(); } catch (e) { /* ignore */ }
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  },
  {
    id: "job-1985", code: "WO-1985", taskType: "ariza",
    title: "Kompresör hava kaçağı", equipment: "Kompresör C-3", location: "Gebze Fabrikası · Kompresör Odası",
    description: "Hat basıncı düşüyor; çek valf bölgesinde kaçak sesi. Makine üretimdeyken durdurulamadı.",
    priority: "orta", status: "beklemede", assignedBy: "Merkez Bakım · E. Yıldız",
    seenAt: "2026-07-08T09:00:00Z",
    hold: {
      reason: "makine_durdurulamiyor",
      note: "Üretim penceresi bekleniyor.",
      nextAction: "Duruş penceresi planlanacak",
      owner: "Üretim Planlama",
      heldAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      unblockedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      unblockNote: "duruş penceresi bu gece 22:00'de onaylandı",
    },
    history: [], evidence: [],
  }, []);

  function openText() {
    if (onSend) setMode("text");
    else if (onAsk) onAsk();
  }

  function addAttachment(label) {
    setAttachments((a) => [...a, { id: uid("att"), label }]);
    ref.current?.focus();
  }
  function removeAttachment(id) { setAttachments((a) => a.filter((x) => x.id !== id)); }

  function submit() {
    const v = value.trim();
    const att = attachments.map((a) => `[${a.label}]`).join(" ");
    const msg = [v, att].filter(Boolean).join(" ");
    if (!msg) return;
    onSend(msg);
    setValue(""); setAttachments([]);
    // Stay in text mode and keep focus so the next message needs zero taps.
    requestAnimationFrame(() => ref.current?.focus());
  }

  function cancelAll() {
    try { recRef.current?.stop(); } catch (e) { /* ignore */ }
    holdRef.current.active = false;
    setListening(false); setVoiceState(null); setVoiceText("");
    setMode(null); setValue(""); setAttachments([]);
  }

  /* ---- push-to-talk: hold the black pill, speak, release to send ---- */
  function startHold(e) {
    if (!onSend) { if (onAsk) onAsk(); return; }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    holdRef.current = { active: true, startedAt: Date.now() };
    voiceTextRef.current = ""; setVoiceText("");
    setMode("voice");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceState("error"); return; }
    try {
      const rec = new SR();
      rec.lang = "tr-TR";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev) => {
        const t = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
        voiceTextRef.current = t; setVoiceText(t);
      };
      rec.onerror = () => { setListening(false); setVoiceState("error"); };
      rec.onend = () => {
        setListening(false);
        if (holdRef.current.active) rec._ended = true;
        else finalizeVoice();
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      setVoiceState("listening");
    } catch (err) { setVoiceState("error"); }
  }

  function endHold() {
    if (!holdRef.current.active) return;
    holdRef.current.active = false;
    if (voiceState === "error") return; // keep the fallback panel open
    const rec = recRef.current;
    if (rec && !rec._ended) {
      try { rec.stop(); } catch (e) { finalizeVoice(); } // onend → finalizeVoice
    } else {
      finalizeVoice();
    }
  }

  function finalizeVoice() {
    const t = voiceTextRef.current.trim();
    if (t) {
      onSend(t);
      voiceTextRef.current = ""; setVoiceText("");
      setVoiceState(null); setMode(null);
    } else {
      setVoiceState("hint");
      hintTimerRef.current = setTimeout(() => {
        setVoiceState(null);
        setMode((m) => (m === "voice" ? null : m));
      }, 1600);
    }
  }

  /* ---- Voice panel (visible while holding, or when hint/error) ---- */
  if (mode === "voice") {
    const title = voiceState === "error" ? "Mikrofon kullanılamıyor"
      : voiceState === "hint" ? "Basılı tutarak konuş"
      : "Dinliyorum…";
    const sub = voiceState === "error" ? "Bu ortamda mikrofona erişilemiyor — klavyeyle devam edebilirsin."
      : voiceState === "hint" ? "Siyah butona basılı tut, konuş; bırakınca mesajın gönderilir."
      : (voiceText || "Bırakınca gönderilir.");
    return (
      <div className="rounded-3xl p-4" style={{ background: DOCK_DARK, boxShadow: "0 16px 34px rgba(23,24,28,0.35)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 44, height: 44, background: "rgba(255,255,255,0.12)", animation: listening ? "toola-pulse 1.4s ease-in-out infinite" : "none" }}>
            <Mic size={18} style={{ color: "#fff" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>{sub}</div>
          </div>
        </div>
        {voiceState === "error" ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setVoiceState(null); setMode("text"); }}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold" style={{ background: "#fff", color: INK, border: "none" }}>
              Klavyeyle yaz
            </button>
            <button type="button" onClick={cancelAll}
              className="rounded-full px-4 py-2.5 text-sm font-medium" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "none" }}>
              Vazgeç
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---- Floating composer (reference-style: text on top, attach row + round send) ---- */
  if (mode === "text") {
    const hasContent = value.trim().length > 0 || attachments.length > 0;
    return (
      <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", boxShadow: "0 16px 34px rgba(23,24,28,0.18)" }}>
        <textarea
          ref={ref} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape") cancelAll();
          }}
          className="w-full resize-none bg-transparent text-base outline-none" style={{ color: INK, maxHeight: 110 }}
        />
        {attachments.length > 0 ? (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#F1EFE9", color: INK }}>
                {a.label}
                <button type="button" onClick={() => removeAttachment(a.id)} aria-label="Kaldır" style={{ background: "none", border: "none", padding: 0, display: "flex" }}>
                  <X size={12} style={{ color: MUTED }} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-5">
          <button type="button" onClick={() => addAttachment("Görsel")} aria-label="Görsel ekle" style={{ background: "none", border: "none", padding: 0 }}>
            <ImageIcon size={20} style={{ color: INK }} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => addAttachment("Fotoğraf")} aria-label="Fotoğraf çek" style={{ background: "none", border: "none", padding: 0 }}>
            <Camera size={20} style={{ color: INK }} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => addAttachment("Dosya")} aria-label="Dosya ekle" style={{ background: "none", border: "none", padding: 0 }}>
            <FileText size={20} style={{ color: INK }} strokeWidth={1.8} />
          </button>
          <div className="flex-1" />
          <button type="button" onClick={cancelAll} className="text-xs font-medium" style={{ color: MUTED, background: "none", border: "none" }}>
            Vazgeç
          </button>
          <button type="button" onClick={submit} onPointerDown={(e) => e.preventDefault()} aria-label="Gönder"
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 44, height: 44, background: hasContent ? DOCK_DARK : "#C9C6BE", color: "#fff", border: "none", transition: "background 160ms" }}>
            <ArrowUp size={19} />
          </button>
        </div>
      </div>
    );
  }

  /* ---- Collapsed bar (with optional + quick-action menu above) ---- */
  return (
    <div>
      {mode === "plus" && plusItems?.length ? (
        <div className="mb-2 rounded-3xl p-2" style={{ background: "#fff", boxShadow: "0 16px 34px rgba(23,24,28,0.18)" }}>
          {plusItems.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.label} type="button" onClick={() => { setMode(null); it.onClick(); }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left" style={{ background: "none", border: "none" }}>
                <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: 36, height: 36, background: it.tone || "#F1EFE9" }}>
                  <Icon size={16} style={{ color: it.fg || INK }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: INK }}>{it.label}</div>
                  {it.desc ? <div className="text-xs" style={{ color: MUTED }}>{it.desc}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {plusItems?.length ? (
          <DockIconBtn icon={mode === "plus" ? X : Plus} onClick={() => setMode(mode === "plus" ? null : "plus")} />
        ) : null}
        {primaryAction ? (
          <>
            {hideMic ? null : <DockIconBtn icon={Mic} onClick={() => { if (onAsk) onAsk(); }} dark />}
            <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}
              className="flex-1 rounded-full py-3.5 text-sm font-semibold flex items-center justify-center gap-1"
              style={{
                border: "none",
                background: primaryAction.disabled ? "#DEDBD3" : DOCK_DARK,
                color: primaryAction.disabled ? "#9A968C" : "#fff",
                boxShadow: primaryAction.disabled ? "none" : "0 14px 28px rgba(21,23,27,0.35)",
              }}>
              {primaryAction.label}
            </button>
          </>
        ) : (
          <button type="button" aria-label={onSend ? "Basılı tutarak konuş" : "ToolA'ya sor"}
            onClick={onSend ? undefined : () => { if (onAsk) onAsk(); }}
            onPointerDown={onSend ? startHold : undefined}
            onPointerUp={onSend ? endHold : undefined}
            onPointerCancel={onSend ? endHold : undefined}
            onContextMenu={(e) => e.preventDefault()}
            className="flex items-center justify-center rounded-full py-3.5"
            style={{
              width: "54%", background: DOCK_DARK, color: "#fff", boxShadow: "0 14px 28px rgba(21,23,27,0.35)", border: "none",
              touchAction: "none", WebkitUserSelect: "none", userSelect: "none",
            }}>
            <Mic size={19} />
          </button>
        )}
        <DockIconBtn icon={Keyboard} onClick={openText} />
      </div>
    </div>
  );
}

function BottomDock({ children, onHeight }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeight || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    onHeight(el.offsetHeight);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 20px 22px" }}>{children}</div>;
}

function BottomSheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(20,20,20,0.35)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl p-5"
        style={{ background: "#FBFAF7", maxHeight: "72%", overflowY: "auto", boxShadow: "0 -10px 30px rgba(0,0,0,0.2)" }}
      >
        {children}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full py-3 text-sm font-semibold" style={{ background: "#F1EFE9", color: INK, border: "none" }}>
          Kapat
        </button>
      </div>
    </div>
  );
}

// Zero distance between the signature moment and the evidence itself:
// tapping a chip on the closure review opens the evidence full-size.
// Photos show a framed placeholder in this demo (the native build renders
// the real image here); measurements are first-class already — big value,
// unit and the same threshold interpretation the field saw.
const EV_ICON = { foto: Camera, video: Video, ses: Mic, olcum: Gauge, hata_kodu: Zap, parca_foto: Package, not: FileText };

// One strip, both steps: measurements first, tap = full-size preview,
// "+ Düzenle" bridges to the evidence screen (management stays there).
function EvidenceStrip({ job, goto, onPreview, label }) {
  return (
    <div className="mt-3">
      <SectionLabel>{label ?? `Kanıtlar (${job.evidence.length})`}</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...job.evidence].sort((a, b) => (a.type === "olcum" ? -1 : 0) - (b.type === "olcum" ? -1 : 0)).map((ev) => {
          const Icon = EV_ICON[ev.type] || Camera;
          return (
            <button key={ev.id} type="button" onClick={() => onPreview(ev)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
              style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK, border: "none" }}>
              <Icon size={13} style={{ color: "#6C8F73" }} />
              {ev.type === "olcum" && ev.value ? ev.value : ev.label}
              {(ev.tags || []).slice(0, 2).map((tag) => (
                <span key={tag} className="text-[10px] font-medium rounded-full px-1.5 py-0.5" style={{ background: "#E7F1FC", color: "#2563A6" }}>{tag}</span>
              ))}
            </button>
          );
        })}
        <button type="button" onClick={() => goto("evidence", job.id)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: "#F1EFE9", color: MUTED, border: "none" }}>
          <Plus size={12} /> Düzenle
        </button>
      </div>
    </div>
  );
}

function EvidencePreviewSheet({ ev, job, onClose }) {
  if (!ev) return null;
  const Icon = EV_ICON[ev.type] || Camera;
  const isVisual = ev.type === "foto" || ev.type === "video" || ev.type === "parca_foto";
  const isMeasure = ev.type === "olcum";
  const hint = isMeasure && ev.measureType != null && ev.measureValue != null
    ? measurementHint(job, ev.measureType, String(ev.measureValue)) : null;
  return (
    <BottomSheet open onClose={onClose}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: "#6C8F73" }} />
        <span className="text-sm font-semibold" style={{ color: INK }}>{ev.label}</span>
        {(ev.tags || []).map((tag) => (
          <span key={tag} className="text-xs font-medium rounded-full px-2 py-0.5" style={{ background: "#E7F1FC", color: "#2563A6" }}>{tag}</span>
        ))}
      </div>

      {isVisual ? (
        <div className="mt-3 rounded-2xl flex flex-col items-center justify-center"
          style={{ height: 210, background: "linear-gradient(135deg, #E8E5DC 0%, #DDD9CE 60%, #D2CEC2 100%)", border: "1px solid #E6E2D8" }}>
          {ev.type === "video" ? <Video size={34} style={{ color: "#9A968C" }} /> : <Camera size={34} style={{ color: "#9A968C" }} />}
          <span className="mt-2 text-xs" style={{ color: MUTED }}>{ev.note || ev.value || "Görsel kanıt"}</span>
          <span className="mt-1 text-[10px]" style={{ color: "#B4B0A6" }}>Gerçek görüntü native sürümde burada açılır</span>
        </div>
      ) : null}

      {isMeasure ? (
        <div className="mt-3 rounded-2xl p-5 text-center" style={{ background: "#F4F2EC" }}>
          <div className="text-4xl font-bold" style={{ color: INK }}>
            {ev.measureValue != null ? ev.measureValue : (ev.value || "").replace(/^[^:]*:\s*/, "")}
            {ev.measureUnit ? <span className="text-lg font-semibold ml-1" style={{ color: MUTED }}>{ev.measureUnit}</span> : null}
          </div>
          {ev.value ? <div className="mt-1 text-xs" style={{ color: MUTED }}>{ev.value}</div> : null}
          {hint ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ background: hint.ok ? "#DCF3E3" : "#FDF3E4", color: hint.ok ? "#1F8A4C" : "#9C6B0A" }}>
              {hint.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {hint.text}
            </div>
          ) : null}
        </div>
      ) : null}

      {ev.type === "ses" ? (
        <div className="mt-3 rounded-2xl p-5 flex items-center justify-center gap-1" style={{ background: "#F4F2EC", height: 110 }}>
          {[8, 16, 24, 14, 28, 18, 10, 22, 30, 16, 9, 20, 26, 12, 17, 24, 11].map((h, i) => (
            <span key={i} style={{ width: 4, height: h * 2, borderRadius: 4, background: i % 3 === 0 ? "#6C8F73" : "#C9C5BA", display: "inline-block" }} />
          ))}
        </div>
      ) : null}

      {!isVisual && !isMeasure && ev.type !== "ses" ? (
        <p className="mt-3 text-sm rounded-2xl p-4" style={{ background: "#F4F2EC", color: INK }}>{ev.value || ev.note || "—"}</p>
      ) : null}

      <div className="mt-3 text-xs" style={{ color: MUTED }}>
        {ev.createdAt ? new Date(ev.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : ""}
      </div>
    </BottomSheet>
  );
}

function SourceSheet({ source, onClose }) {
  return (
    <BottomSheet open={!!source} onClose={onClose}>
      {source ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Kaynak</div>
          <div className="mt-1 text-lg font-bold" style={{ color: INK }}>{source.label}</div>
          <div className="mt-1 text-sm" style={{ color: MUTED }}>{source.detail}</div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: INK }}>
            Bu cevap bu kayda dayanıyor. Gerçek kurulumda burada ilgili doküman sayfası veya geçmiş iş emrinin tam kaydı açılır — demo verisinde yalnızca başlık ve özet gösteriliyor.
          </p>
        </>
      ) : null}
    </BottomSheet>
  );
}

function NewJobSheet({ open, onClose, onCreate, jobs }) {
  const [title, setTitle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [location, setLocation] = useState("");
  const canCreate = title.trim().length > 0 && equipment.trim().length > 0;
  // Duplicate guard: the same fault reported over two channels should not
  // become two jobs. Warn (don't block) when an open job matches the equipment.
  const dup = equipment.trim().length >= 3
    ? (jobs || []).find((j) => j.status !== "tamamlandi" && j.equipment.toLowerCase().includes(equipment.trim().toLowerCase()))
    : null;
  function create() {
    onCreate({ title: title.trim(), equipment: equipment.trim(), location: location.trim() || "Belirtilmedi" });
    setTitle(""); setEquipment(""); setLocation("");
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="text-lg font-bold" style={{ color: INK }}>Yeni iş bildir</div>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>Sahada fark ettiğin bir sorunu kaydet. Kayıt sana atanır ve merkeze bildirilir.</p>
      <div className="mt-3 flex flex-col gap-2">
        <FieldCard label="Sorun" value={title} onChange={setTitle} placeholder="Örn: Fan V-2 anormal ses" />
        <FieldCard label="Ekipman" value={equipment} onChange={setEquipment} placeholder="Örn: Havalandırma Fanı V-2" />
        <FieldCard label="Lokasyon" value={location} onChange={setLocation} placeholder="Örn: Ünite 1 · Çatı" />
      </div>
      {dup ? (
        <div className="mt-2 rounded-2xl px-4 py-3 text-xs" style={{ background: "#FDF3E4", color: "#9C6B0A" }}>
          Bu ekipmanda zaten açık bir iş var: <strong>{dup.code} · {dup.title}</strong> ({STATUS_LABEL[dup.status]}). Aynı arızaysa yeni iş açma.
        </div>
      ) : null}
      <button type="button" disabled={!canCreate} onClick={create}
        className="mt-3 w-full rounded-full py-3 text-sm font-semibold"
        style={{ background: canCreate ? DOCK_DARK : "#DEDBD3", color: canCreate ? "#fff" : "#9A968C", border: "none" }}>
        İşi oluştur
      </button>
    </BottomSheet>
  );
}

function QrSheet({ open, onClose, jobs, onPick }) {
  const candidates = jobs.filter((j) => j.status !== "tamamlandi");
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="text-lg font-bold" style={{ color: INK }}>QR / Barkod tara</div>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>Gerçek kurulumda kamera açılır ve ekipman etiketi okunur. Demo için bir etiket seç:</p>
      <div className="mt-3 flex flex-col gap-2">
        {candidates.map((j) => (
          <button key={j.id} type="button" onClick={() => onPick(j.id)}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left" style={{ background: "#F5F3EE", border: "none" }}>
            <QrCode size={18} style={{ color: MUTED, flexShrink: 0 }} />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: INK }}>{j.equipment}</div>
              <div className="text-xs truncate" style={{ color: MUTED }}>{j.location}</div>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

function ProfileSheet({ open, onClose, onReset, jobs }) {
  const openCount = jobs.filter((j) => j.status !== "tamamlandi" && j.status !== "beklemede").length;
  const heldCount = jobs.filter((j) => j.status === "beklemede").length;
  const doneCount = jobs.filter((j) => j.status === "tamamlandi").length;
  const stats = [
    { label: "Açık", value: openCount },
    { label: "Beklemede", value: heldCount },
    { label: "Tamamlanan", value: doneCount },
  ];
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 52, height: 52, background: DOCK_DARK }}>
          <span className="text-lg font-bold" style={{ color: "#fff" }}>{TECH_NAME[0]}</span>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: INK }}>{TECH_NAME}</div>
          <div className="text-xs" style={{ color: MUTED }}>Saha Teknisyeni · Gündüz vardiyası</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: "#F5F3EE" }}>
            <div className="text-lg font-bold" style={{ color: INK }}>{s.value}</div>
            <div className="text-xs" style={{ color: MUTED }}>{s.label}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onReset} className="mt-4 w-full rounded-2xl px-3 py-3 text-sm font-medium text-left" style={{ color: "#C53434", background: "#FDEAEA", border: "none" }}>
        Örnek verileri sıfırla
      </button>
    </BottomSheet>
  );
}

// Quick actions for the + button on job-context screens.
function jobPlusItems(goto, job) {
  if (!job) return [];
  return [
    { icon: Camera, label: "Kanıt ekle", desc: "Fotoğraf, ölçüm veya not", tone: "#E8F7EE", fg: "#1F8A4C", onClick: () => goto("evidence", job.id) },
  ];
}

/* ---------------------------------------------------------------------
   Screens
--------------------------------------------------------------------- */
function EmptyState() {
  return <div className="mt-10 text-center text-sm" style={{ color: MUTED }}>İş bulunamadı.</div>;
}

function JobMiniCard({ job, onClick, muted }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-left rounded-3xl p-4"
      style={{ width: 200, background: CARD_BG, boxShadow: CARD_SHADOW, opacity: muted ? 0.7 : 1, border: "none" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <TaskChip type={job.taskType} />
        <PriorityChip priority={job.priority} />
        {job.status === "atandi" && !job.seenAt ? (
          <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "#FDF3E4", color: "#9C6B0A" }}>Yeni</span>
        ) : null}
        {job.status === "beklemede" && job.hold ? (
          job.hold.unblockedAt ? (
            <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "#DCF3E3", color: "#1F8A4C" }}>Önün açıldı</span>
          ) : (
            <span className="text-xs font-semibold rounded-full px-2 py-0.5 truncate" style={{ background: "#FDF3E4", color: "#9C6B0A", maxWidth: 118 }}>
              {HOLD_LABEL[job.hold.reason] || "Bekliyor"} · {timeAgo(job.hold.heldAt)}
            </span>
          )
        ) : null}
      </div>
      <div className="text-sm font-semibold" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.title}
      </div>
      <div className="mt-1.5 text-xs truncate" style={{ color: MUTED }}>{job.equipment}</div>
      <div className="text-xs truncate" style={{ color: MUTED }}>{job.location}</div>
      {job.dueAt ? <div className="mt-1 text-xs font-medium" style={{ color: "#9C6B0A" }}>{formatDue(job.dueAt)}</div> : null}
      {job.status === "beklemede" && job.hold ? (
        <div className="mt-1 text-xs font-medium truncate" style={{ color: job.hold.unblockedAt ? "#1F8A4C" : MUTED }}>
          {job.hold.unblockedAt ? "İşe dönebilirsin →" : job.hold.owner || HOLD_NEXT[job.hold.reason] || ""}
        </div>
      ) : null}
    </button>
  );
}

function HomeScreen({ jobs, goto, plusItems }) {
  const open = sortByTriage(jobs.filter((j) => j.status !== "tamamlandi" && j.status !== "beklemede"));
  const held = jobs.filter((j) => j.status === "beklemede");
  const done = jobs.filter((j) => j.status === "tamamlandi");
  const featured = open[0];
  const rest = open.filter((j) => j.id !== featured?.id);
  const greeting = getGreeting();

  return (
    <>
      <div className="mt-2">
        <h1 className="text-3xl font-bold leading-tight" style={{ color: INK }}>{greeting}, {TECH_NAME}.</h1>
        {featured ? (
          <p className="mt-2 text-lg leading-snug" style={{ color: INK }}>
            {!featured.seenAt ? "Sana yeni bir iş atandı: " : "Sıradaki işin "}<strong>{featured.title}</strong>{featured.dueAt ? `, ${formatDue(featured.dueAt)}` : ""}.
          </p>
        ) : (
          <p className="mt-2 text-lg" style={{ color: MUTED }}>Şu an açık işin yok. Keyfine bak.</p>
        )}
      </div>

      {featured ? (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => goto("jobDetail", featured.id)} className="rounded-full px-4 py-2.5 text-sm font-semibold" style={{ background: DOCK_DARK, color: "#fff", border: "none" }}>
            İşi aç
          </button>
          <button type="button" onClick={() => goto("route")} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.7)", color: INK, backdropFilter: "blur(6px)", border: "none" }}>
            <Navigation size={14} /> Rota
          </button>
          <button type="button" onClick={() => goto("history")} className="rounded-full px-4 py-2.5 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.7)", color: INK, backdropFilter: "blur(6px)", border: "none" }}>
            Geçmişi gör
          </button>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="mt-7">
          <SectionLabel>Devam eden işler</SectionLabel>
          <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {rest.map((j) => <JobMiniCard key={j.id} job={j} onClick={() => goto("jobDetail", j.id)} />)}
          </div>
        </div>
      ) : null}

      {held.length > 0 ? (
        <div className="mt-6">
          <SectionLabel>Beklemede</SectionLabel>
          <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {held.map((j) => <JobMiniCard key={j.id} job={j} onClick={() => goto("jobDetail", j.id)} muted />)}
          </div>
        </div>
      ) : null}

      {done.length > 0 ? (
        <button type="button" onClick={() => goto("history")} className="mt-6 flex w-full items-center justify-between rounded-3xl px-4 py-3 text-sm" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
          <span style={{ color: INK }}>{done.length} iş tamamlandı</span>
          <ChevronRight size={16} style={{ color: MUTED }} />
        </button>
      ) : null}

      <div style={{ height: 130 }} />
      <BottomDock>
        <Dock onAsk={() => goto("assistant")} plusItems={plusItems} />
      </BottomDock>
    </>
  );
}

function JobDetailScreen({ job, goto, resumeJob, markSeen }) {
  const [openHistory, setOpenHistory] = useState(null);
  useEffect(() => {
    if (job && !job.seenAt) markSeen(job.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);
  if (!job) return <EmptyState />;
  const isHeld = job.status === "beklemede";
  // The primary button names its destination — "Devam et" promises nothing;
  // a technician should know what happens before tapping.
  const primaryLabel = job.status === "tamamlandi" ? "Özeti gör" : isHeld ? "İşe geri dön" : "Kanıt topla";
  function onPrimary() {
    if (job.status === "tamamlandi") goto("summary", job.id);
    else if (isHeld) { resumeJob(job.id); goto("evidence", job.id); }
    else goto("evidence", job.id);
  }
  const repeatCount = (job.history?.length || 0) + 1;
  const isRepeat = (job.history?.length || 0) >= 2;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <TaskChip type={job.taskType} />
        <PriorityChip priority={job.priority} />
        <StatusChip status={job.status} />
        {isRepeat ? <Chip bg="#FDEAEA" fg="#C53434">Tekrarlayan · {repeatCount}. kayıt</Chip> : null}
      </div>
      <h1 className="mt-3 text-2xl font-bold leading-snug" style={{ color: INK }}>{job.title}</h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{job.description}</p>

      <div className="mt-4 toola-divide rounded-3xl" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <InfoRow icon={Zap} label="Ekipman" value={job.equipment} />
        <InfoRow icon={MapPin} label="Lokasyon" value={job.location} actionIcon={Navigation}
          onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(job.location)}`, "_blank")} />
        <InfoRow icon={User} label="Atayan" value={job.assignedBy} actionIcon={job.contactPhone ? Phone : undefined}
          onClick={job.contactPhone ? () => window.open(`tel:${job.contactPhone.replace(/\s/g, "")}`, "_self") : undefined} />
        {job.dueAt ? <InfoRow icon={Clock} label="Son tarih" value={new Date(job.dueAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} /> : null}
      </div>

      {isHeld && job.hold ? (
        <div className="mt-4 rounded-3xl p-4" style={{ background: job.hold.unblockedAt ? "#DCF3E3" : "#FDF3E4" }}>
          <div className="flex items-center gap-2">
            {job.hold.unblockedAt
              ? <CheckCircle2 size={16} style={{ color: "#1F8A4C", flexShrink: 0 }} />
              : <PauseCircle size={16} style={{ color: "#9C6B0A", flexShrink: 0 }} />}
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: job.hold.unblockedAt ? "#1F8A4C" : "#9C6B0A" }}>
              {job.hold.unblockedAt
                ? `Önün açıldı · ${HOLD_LABEL[job.hold.reason] || "engel"} çözüldü`
                : `Beklemede · ${HOLD_LABEL[job.hold.reason] || "Bekliyor"}`}
            </div>
          </div>
          {job.hold.unblockedAt ? (
            <p className="mt-1.5 text-sm" style={{ color: INK }}>Merkez bildirdi: {job.hold.unblockNote || "engel kaldırıldı"}. "İşe geri dön" ile kaldığın yerden devam et.</p>
          ) : null}
          {job.hold.note || job.hold.whyNotClosing ? (
            <p className="mt-1.5 text-sm" style={{ color: INK }}>{job.hold.note || job.hold.whyNotClosing}</p>
          ) : null}
          <button type="button" onClick={() => goto("summary", job.id)} className="mt-2 text-xs font-semibold" style={{ color: "#9C6B0A", background: "none", border: "none", padding: 0 }}>
            Bekleme özetini gör →
          </button>
        </div>
      ) : null}

      {job.centralNote ? (
        <div className="mt-4 rounded-3xl p-4 flex gap-2" style={{ background: "#FDF3E4" }}>
          <AlertTriangle size={16} style={{ color: "#9C6B0A", marginTop: 2, flexShrink: 0 }} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9C6B0A" }}>Merkez notu</div>
            <p className="mt-0.5 text-sm" style={{ color: INK }}>{job.centralNote}</p>
          </div>
        </div>
      ) : null}

      {job.bringItems?.length ? (
        <div className="mt-5">
          <SectionLabel icon={Package}>Yanına al</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.bringItems.map((it, i) => (
              <span key={i} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK }}>
                {it}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {job.history?.length ? (
        <div className="mt-5">
          <SectionLabel icon={HistoryIcon}>Ekipman geçmişi</SectionLabel>
          <div className="mt-2 toola-divide rounded-3xl" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
            {job.history.map((h) => (
              <button key={h.id} type="button" onClick={() => setOpenHistory(h)} className="w-full px-3 py-2.5 text-sm text-left" style={{ background: "none", border: "none" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: MUTED }}>{h.date}</span>
                  <ChevronRight size={14} style={{ color: MUTED }} />
                </div>
                <div className="font-medium mt-0.5" style={{ color: INK }}>{h.summary}</div>
                <div className="text-xs mt-0.5" style={{ color: MUTED }}>→ {h.action}{h.partChanged ? ` (${h.partChanged})` : ""}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock primaryAction={{ label: primaryLabel, onClick: onPrimary }} onAsk={() => goto("ai", job.id)} plusItems={jobPlusItems(goto, job)} />
      </BottomDock>

      <BottomSheet open={!!openHistory} onClose={() => setOpenHistory(null)}>
        {openHistory ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{openHistory.date}</div>
            <div className="mt-1 text-lg font-bold" style={{ color: INK }}>{openHistory.summary}</div>
            <div className="mt-3 toola-divide rounded-2xl" style={{ background: "#F5F3EE" }}>
              <SummaryRow label="Kök neden" value={openHistory.rootCause} />
              <SummaryRow label="Müdahale" value={openHistory.intervention} />
              {openHistory.partChanged ? <SummaryRow label="Kullanılan parça" value={openHistory.partChanged} /> : null}
            </div>
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

function VerifyBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-medium"
      style={{ background: active ? DOCK_DARK : CARD_BG, color: active ? "#fff" : INK, boxShadow: CARD_SHADOW, border: "none" }}>
      <Icon size={15} /> {label}
    </button>
  );
}

function measurementHint(job, typeId, value) {
  const num = parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(num)) return null;
  const kind = jobKind(job);
  if (kind === "pompa" && typeId === "sicaklik") {
    return num < 65
      ? { ok: true, text: "Yatak sıcaklığı normal aralıkta (< 65°C)." }
      : { ok: false, text: "Yatak sıcaklığı eşiğin üzerinde (< 65°C beklenir) — dikkatli değerlendir." };
  }
  if (kind === "pompa" && typeId === "titresim") {
    return num <= 2.8
      ? { ok: true, text: "Titreşim ISO 10816 Zone A/B aralığında (≤ 2.8 mm/s)." }
      : { ok: false, text: "Titreşim ISO 10816 eşiğinin üzerinde (≤ 2.8 mm/s beklenir)." };
  }
  if (kind === "jenerator" && typeId === "voltaj") {
    return num >= 12.4
      ? { ok: true, text: "Akü voltajı sağlıklı aralıkta (≥ 12.4V)." }
      : { ok: false, text: "Akü voltajı düşük (≥ 12.4V beklenir) — şarj/redresör kontrol edilmeli." };
  }
  return null;
}

function EvidenceScreen({ job, goto, addEvidence, removeEvidence, toggleEvidenceTag, setStatus, setVerify }) {
  const measureInputRef = useRef(null);



  const [measurement, setMeasurement] = useState("");
  const [measureType, setMeasureType] = useState("sicaklik");
  const [measureSheetOpen, setMeasureSheetOpen] = useState(false);
  const [tagTarget, setTagTarget] = useState(null); // last captured evidence id
  const [verifyChoice, setVerifyChoice] = useState(() => job?.verify ?? null);
  if (!job) return <EmptyState />;
  const count = job.evidence.length;
  const mType = MEASURE_TYPES.find((t) => t.id === measureType) || MEASURE_TYPES[0];
  const mHint = measurementHint(job, measureType, measurement);

  function openMeasureSheet() {
    setMeasureSheetOpen(true);
    setTimeout(() => { measureInputRef.current?.focus(); }, 50);
  }
  function closeMeasureSheet() {
    setMeasureSheetOpen(false);
    setMeasurement("");
  }
  function submitMeasurement() {
    if (!measurement.trim()) return;
    addEvidence(job.id, { type: "olcum", label: "Ölçüm", value: `${mType.label}: ${measurement.trim()} ${mType.unit}`, measureType: mType.id, measureValue: parseFloat(measurement.replace(",", ".")), measureUnit: mType.unit });
    setMeasurement("");
    setMeasureSheetOpen(false);
  }


  function chooseVerify(v) {
    setVerifyChoice(v);
    setVerify(job.id, v);
  }

  function advance(screen) {
    if (job.status === "atandi") setStatus(job.id, "sahadayim");
    goto(screen, job.id);
  }

  return (
    <>
      <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>Kanıt topla</h1>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{job.code} · {job.title}</p>

      {job.verifyRequired ? (
      <div className="mt-4">
        <SectionLabel>Ekipman doğrulandı mı?</SectionLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <VerifyBtn active={verifyChoice === "qr"} onClick={() => chooseVerify("qr")} icon={QrCode} label="QR / barkod" />
          <VerifyBtn active={verifyChoice === "manuel"} onClick={() => chooseVerify("manuel")} icon={CheckCircle2} label="Manuel" />
          <VerifyBtn active={verifyChoice === "belirsiz"} onClick={() => chooseVerify("belirsiz")} icon={HelpCircle} label="Emin değilim" />
        </div>
        {verifyChoice === "belirsiz" ? (
          <div className="mt-2 rounded-2xl px-4 py-3 text-xs" style={{ background: "#FDF3E4", color: "#9C6B0A" }}>
            Belirsiz doğrulama kapanışta merkeze iletilecek — özet ekranında görünür.
          </div>
        ) : null}
      </div>
      ) : null}

      <p className="mt-4 text-sm" style={{ color: MUTED }}>En az bir kanıt topla: fotoğraf, ölçüm veya kısa not.</p>

      <div className="mt-3">
        <SectionLabel>Kanıt ekle</SectionLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {QUICK_EVIDENCE.map((q) => {
            const Icon = q.icon;
            return (
              <button key={q.type} type="button"
                onClick={() => {
                  const extra = q.type === "ses"
                    ? (() => {
                        const mockLines = [
                          "Klik sesi geliyor, kompresör çalışmıyor.",
                          "Fan dönüyor ama soğutma yok, üfleme ılık.",
                          "Dış üniteden titreşim ve metalik ses var.",
                          "Kapasitör şişmiş, ölçümde değer düşük çıkıyor.",
                        ];
                        const duration = 8 + Math.floor(Math.random() * 20);
                        return { duration, transcript: mockLines[Math.floor(Math.random() * mockLines.length)] };
                      })()
                    : {};
                  const evId = addEvidence(job.id, { type: q.type, label: q.label, note: q.note, ...extra });
                  setTagTarget(evId);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 px-2 text-xs font-medium" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK, border: "none" }}>
                <Icon size={19} style={{ color: "#6C8F73", flexShrink: 0 }} /> {q.label}
              </button>
            );
          })}
          <button type="button"
            onClick={openMeasureSheet}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 px-2 text-xs font-medium" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK, border: "none" }}>
            <Gauge size={19} style={{ color: "#6C8F73", flexShrink: 0 }} /> Ölçüm
          </button>

        </div>

        {tagTarget && job.evidence.some((e) => e.id === tagTarget) ? (
          <div className="mt-2 rounded-2xl px-3 py-2.5" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: MUTED }}>Etiketle (istersen)</span>
              <button type="button" onClick={() => setTagTarget(null)} className="text-xs font-semibold" style={{ background: "none", border: "none", color: MUTED }}>Tamam</button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EVIDENCE_TAGS.map((tag) => {
                const active = (job.evidence.find((e) => e.id === tagTarget)?.tags || []).includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => toggleEvidenceTag(job.id, tagTarget, tag)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: active ? DOCK_DARK : "#F1EFE9", color: active ? "#fff" : INK, border: "none" }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>



      {count > 0 ? (
        <div className="mt-4">
          <SectionLabel>Eklenenler · {count}</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {job.evidence.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "#F1EFE9", color: MUTED }}>
                    {ev.label}{ev.type === "ses" && ev.duration ? ` · ${ev.duration} sn` : ""}
                  </span>
                  {(ev.tags || []).map((tag) => (
                    <span key={tag} className="ml-1 text-xs font-medium rounded-full px-2 py-0.5" style={{ background: "#E7F1FC", color: "#2563A6" }}>{tag}</span>
                  ))}
                  {ev.type === "ses" && ev.transcript ? (
                    <p className="mt-1 italic" style={{ color: INK }}>"{ev.transcript}"</p>
                  ) : ev.value ? (
                    <p className="mt-1" style={{ color: INK }}>{ev.value}</p>
                  ) : ev.note ? (
                    <p className="mt-1" style={{ color: MUTED }}>{ev.note}</p>
                  ) : null}
                </div>
                <button type="button" onClick={() => removeEvidence(job.id, ev.id)} aria-label="Kaldır" style={{ background: "none", border: "none" }}>
                  <X size={15} style={{ color: MUTED }} />
                </button>
              </div>
            ))}
          </div>
        </div>

      ) : (
        <div className="mt-4 rounded-2xl px-4 py-3 text-xs" style={{ background: "#F1EFE9", color: MUTED }}>
          Devam etmek için en az bir kanıt ekle.
        </div>
      )}

      <div style={{ height: 100 }} />
      <BottomDock>
        <div className="flex items-stretch gap-2">
          <DockActionBtn icon={Brain} label="AI ile Teşhis" onClick={() => advance("ai")} />
          <DockActionBtn icon={CheckCircle2} label="Çözdüm, Kapat" onClick={() => advance("close")} disabled={count === 0} />
          <DockActionBtn icon={PauseCircle} label="Destek Bekle" onClick={() => advance("hold")} />
        </div>
      </BottomDock>

      {measureSheetOpen ? (
        <div
          onClick={closeMeasureSheet}
          style={{ position: "fixed", inset: 0, background: "rgba(23,24,26,0.35)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { e.currentTarget._touchY = e.touches[0].clientY; }}
            onTouchMove={(e) => {
              const start = e.currentTarget._touchY;
              if (start != null && e.touches[0].clientY - start > 60) { e.currentTarget._touchY = null; closeMeasureSheet(); }
            }}
            style={{ width: "100%", maxWidth: 390, background: "#F5F2EA", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "12px 20px 24px", boxShadow: "0 -12px 32px rgba(0,0,0,0.18)" }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#D9D4C7" }} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: INK }}>Ölçüm ekle</h3>
              <button type="button" onClick={closeMeasureSheet} aria-label="Kapat" style={{ background: "none", border: "none" }}>
                <X size={18} style={{ color: MUTED }} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {MEASURE_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setMeasureType(t.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: measureType === t.id ? DOCK_DARK : CARD_BG, color: measureType === t.id ? "#fff" : INK, boxShadow: CARD_SHADOW, border: "none" }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
                <input ref={measureInputRef} value={measurement} onChange={(e) => setMeasurement(e.target.value)} inputMode="decimal" placeholder="Değer"
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: INK, minWidth: 0 }}
                  onKeyDown={(e) => { if (e.key === "Enter") submitMeasurement(); }} />
                <span className="text-sm font-medium shrink-0" style={{ color: MUTED }}>{mType.unit}</span>
              </div>
            </div>

            {mHint ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: mHint.ok ? "#1F8A4C" : "#C53434" }}>
                {mHint.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {mHint.text}
              </div>
            ) : null}

            <button type="button" disabled={!measurement.trim()} onClick={submitMeasurement}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold"
              style={{ background: measurement.trim() ? DOCK_DARK : "#DEDBD3", color: measurement.trim() ? "#fff" : "#9A968C", border: "none" }}>
              Ölçümü ekle
            </button>
          </div>
        </div>
      ) : null}
    </>

  );
}

// Push-to-talk capsule used OUTSIDE the dock: hold, speak, release — the
// transcript lands in the caller's note. Voice is the primary input on the
// closure and hold screens; typing stays available as the quiet fallback.
function HoldTalkButton({ onTranscript, label = "Basılı tut, anlat" }) {
  const [listening, setListening] = useState(false);
  const [state, setState] = useState(null); // null | "listening" | "error"
  const [text, setText] = useState("");
  const recRef = useRef(null);
  const textRef = useRef("");
  const activeRef = useRef(false);

  useEffect(() => () => { try { recRef.current?.stop(); } catch (e) { /* ignore */ } }, []);

  function start(e) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    activeRef.current = true;
    textRef.current = ""; setText("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setState("error"); return; }
    try {
      const rec = new SR();
      rec.lang = "tr-TR";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev) => {
        const t = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
        textRef.current = t; setText(t);
      };
      rec.onerror = () => { setListening(false); setState("error"); };
      rec.onend = () => {
        setListening(false);
        if (activeRef.current) rec._ended = true;
        else finish();
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      setState("listening");
    } catch (err) { setState("error"); }
  }

  function end() {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (state === "error") return;
    const rec = recRef.current;
    if (rec && !rec._ended) { try { rec.stop(); } catch (e) { finish(); } }
    else finish();
  }

  function finish() {
    const t = textRef.current.trim();
    if (t) onTranscript(t);
    textRef.current = ""; setText(""); setState(null);
  }

  return (
    <div>
      <button type="button"
        onPointerDown={start} onPointerUp={end} onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full flex items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold"
        style={{
          background: DOCK_DARK, color: "#fff", border: "none", boxShadow: "0 14px 28px rgba(21,23,27,0.35)",
          touchAction: "none", WebkitUserSelect: "none", userSelect: "none",
          animation: listening ? "toola-pulse 1.4s ease-in-out infinite" : "none",
        }}>
        <Mic size={17} /> {listening ? "Dinliyorum… bırakınca eklenir" : label}
      </button>
      {state === "listening" && text ? (
        <p className="mt-2 px-1 text-sm" style={{ color: MUTED }}>{text}</p>
      ) : null}
      {state === "error" ? (
        <p className="mt-2 px-1 text-xs" style={{ color: "#9C6B0A" }}>Bu ortamda mikrofona erişilemiyor — aşağıya yazabilirsin.</p>
      ) : null}
    </div>
  );
}

// Sticky action bar: the three next-step choices live ONLY here now (flow cards
// were removed as duplicates) — always one tap away without scrolling.
function DockActionBtn({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-3xl py-2.5 text-xs font-semibold"
      style={{
        background: disabled ? "#DEDBD3" : DOCK_DARK,
        color: disabled ? "#9A968C" : "#fff",
        border: "none",
        boxShadow: disabled ? "none" : "0 14px 28px rgba(21,23,27,0.35)",
        minWidth: 0,
      }}
    >
      <Icon size={16} />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

function AiChatScreen({ job, goto, messages, ensureChat, appendChat, memory, onMemoryFeedback }) {
  const archived = job ? job.status === "tamamlandi" : false;
  const [thinking, setThinking] = useState(false);
  const [openSource, setOpenSource] = useState(null);
  const endRef = useRef(null);
  const [dockH, setDockH] = useState(96);

  // Follow the conversation: any new message, the "düşünüyor" indicator, or
  // the composer growing (keyboard opened) glides the end-sentinel into view.
  // Small delay lets the answer card lay out its full height first; the
  // initial single message stays at top.
  useEffect(() => {
    if (messages.length <= 1 && !thinking) return;
    const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
    return () => clearTimeout(t);
  }, [messages.length, thinking, dockH]);

  const memoryRec = job ? memory?.published?.find((m) => m.status === "published" && m.equipmentKind === jobKind(job)) : null;
  useEffect(() => {
    if (!job) return;
    ensureChat(job.id, [buildInitialAiMessage(job, memoryRec)]);
    // Asking ToolA a question is an activity, not a job status — no side effects here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  if (!job) return <EmptyState />;

  function send(text) {
    if (archived) return;
    appendChat(job.id, { id: uid("u"), role: "user", text });
    setThinking(true);
    setTimeout(() => {
      appendChat(job.id, buildFollowUpAiMessage(job, text));
      setThinking(false);
    }, 650);
  }

  function onAction(a) {
    if (a.id === "measure") { goto("evidence", job.id); return; }
    if (a.id === "confirm") { goto("close", job.id); return; }
    if (a.id === "hold") { goto("hold", job.id); return; }
    send(a.payload || a.label);
  }

  const suggestions = SUGGESTED_BY_KIND[jobKind(job)];

  return (
    <>
      <div className="rounded-3xl px-4 py-3 mb-3" style={{ background: "rgba(255,255,255,0.55)" }}>
        <div className="text-sm font-semibold" style={{ color: INK }}>{job.title}</div>
        <div className="text-xs mt-0.5" style={{ color: MUTED }}>{job.equipment} · {job.location}</div>
        <span className="mt-2 inline-block text-xs rounded-full px-2 py-1" style={{ background: "#fff", color: MUTED }}>{job.evidence.length} kanıt</span>
      </div>

      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end mb-3">
            <div className="rounded-3xl px-4 py-2.5 text-sm" style={{ background: DOCK_DARK, color: "#fff", borderBottomRightRadius: 6, maxWidth: "80%" }}>{m.text}</div>
          </div>
        ) : (
          <AiAnswerCard key={m.id} msg={m} onAction={onAction} onSourceClick={setOpenSource}
            memoryFeedback={job.memoryFeedback} onMemoryFeedback={(verdict, reason) => onMemoryFeedback(job.id, m.memoryRef?.id, verdict, reason)} />
        ),
      )}

      {thinking ? (
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: MUTED }}>
          <Sparkles size={12} /> ToolA düşünüyor…
        </div>
      ) : null}

      {messages.length <= 1 && !thinking ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "#fff", color: INK, boxShadow: FLOAT_SHADOW, border: "none" }}>
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={endRef} style={{ height: dockH + 14 }} />
      <BottomDock onHeight={setDockH}>
        {archived ? (
          <div className="flex items-center gap-2 rounded-full px-4 py-3"
            style={{ background: "rgba(255,255,255,0.92)", boxShadow: FLOAT_SHADOW, backdropFilter: "blur(10px)" }}>
            <HistoryIcon size={15} style={{ color: MUTED, flexShrink: 0 }} />
            <span className="flex-1 text-xs" style={{ color: MUTED }}>İş kapatıldı — bu sohbet salt-okunur arşiv.</span>
            <button type="button" onClick={() => goto("summary", job.id)}
              className="rounded-full px-3.5 py-2 text-xs font-semibold shrink-0" style={{ background: DOCK_DARK, color: "#fff", border: "none" }}>
              Özeti gör
            </button>
          </div>
        ) : (
          <Dock onSend={send} plusItems={jobPlusItems(goto, job)} />
        )}
      </BottomDock>

      <SourceSheet source={openSource} onClose={() => setOpenSource(null)} />
    </>
  );
}

function CloseScreen({ job, goto, closeJob, aiMessages, createFollowUp, addEvidence }) {
  const [step, setStep] = useState("write");
  const [note, setNote] = useState(() => summarizeDiagnosis(job, aiMessages));
  const [fields, setFields] = useState(null);
  const [followUp, setFollowUp] = useState(null); // {id, code} of the created follow-up job
  const [previewEv, setPreviewEv] = useState(null); // evidence tapped for full-size preview
  const [gapInfo, setGapInfo] = useState(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionSkip, setDecisionSkip] = useState(null); // "unknown" | "unimportant" | null
  const isRoutine = job ? job.taskType === "bakim" || job.taskType === "test" : false;
  const [checks, setChecks] = useState(() =>
    job ? (CHECKLIST_BY_KIND[jobKind(job)] || CHECKLIST_BY_KIND.genel).map((label) => ({ label, state: null })) : []
  );
  if (!job) return <EmptyState />;
  const hasEvidence = job.evidence.length > 0;
  const canReview = isRoutine ? checks.every((c) => c.state) : note.trim().length >= 10;
  const seeded = !isRoutine && note.trim().length > 0;

  function setCheck(i, state) {
    setChecks((xs) => xs.map((c, idx) => (idx === i ? { ...c, state } : c)));
  }

  function proceed() {
    const f = isRoutine ? routineClosure(job, checks, note) : draftClosure(job, note);
    setFields(f);
    if (!isRoutine) {
      const gap = detectDecisionGap(job, aiMessages, f);
      if (gap) { setGapInfo(gap); setStep("decision-gap"); return; }
    }
    setStep("review");
  }
  function confirm() {
    const usedMemoryId = job.memoryFeedback?.verdict === "worked" ? job.memoryFeedback.memId : undefined;
    const technicalDecision = decisionReason.trim()
      ? {
          decisionReason: decisionReason.trim(),
          initialDiagnosis: gapInfo?.initialDiagnosis || null,
          finalRootCause: gapInfo?.finalRootCause || fields.rootCause || null,
          intervention: gapInfo?.intervention || fields.intervention || null,
          outcome: gapInfo?.outcome || fields.outcome || null,
          evidenceIds: job.evidence.map((e) => e.id),
          recordedAt: new Date().toISOString(),
        }
      : decisionSkip
        ? { skipped: decisionSkip, recordedAt: new Date().toISOString() }
        : undefined;
    closeJob(job.id, { ...fields, usedMemoryId, followUp, testDone: true, technicalDecision, closedAt: new Date().toISOString() });
    goto("summary", job.id);
  }

  if (step === "write") {
    return (
      <>
        <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>
          {isRoutine ? "Kontrolleri işaretle" : "Ne yaptın, sonuç ne oldu?"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          {isRoutine
            ? "Rutin işte kök neden sorulmaz — kalemleri geçti/kaldı olarak işaretle, yeter."
            : "Basılı tut ve anlat — ToolA belirti, kök neden, müdahale ve sonuç olarak yapılandıracak."}
        </p>
        {hasEvidence ? (
          <EvidenceStrip job={job} goto={goto} onPreview={setPreviewEv} />
        ) : null}
        {isRoutine ? (
          <div className="mt-4 flex flex-col gap-2">
            {checks.map((c, i) => {
              // One-tap, item-labelled photo: evidence stays mandatory at job
              // level; per item it's a convenience, visually louder on "Kaldı"
              // (that photo becomes the follow-up job's backbone).
              const itemEv = job.evidence.some((e) => (e.tags || []).includes(c.label));
              return (
              <div key={c.label} className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
                <button type="button" aria-label={`${c.label} için fotoğraf ekle`}
                  onClick={() => addEvidence(job.id, { type: "foto", label: "Kamera", note: `${c.label} fotoğrafı`, tags: [c.label] })}
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 32, height: 32, border: "none",
                    background: itemEv ? "#DCF3E3" : c.state === "kaldi" ? "#FDF3E4" : "#F1EFE9",
                    color: itemEv ? "#1F8A4C" : c.state === "kaldi" ? "#9C6B0A" : MUTED }}>
                  {itemEv ? <CheckCircle2 size={15} /> : <Camera size={15} />}
                </button>
                <span className="flex-1 text-sm" style={{ color: INK }}>{c.label}</span>
                <button type="button" onClick={() => setCheck(i, "gecti")}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: c.state === "gecti" ? "#1F8A4C" : "#F1EFE9", color: c.state === "gecti" ? "#fff" : MUTED, border: "none" }}>
                  Geçti
                </button>
                <button type="button" onClick={() => setCheck(i, "kaldi")}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: c.state === "kaldi" ? "#C53434" : "#F1EFE9", color: c.state === "kaldi" ? "#fff" : MUTED, border: "none" }}>
                  Kaldı
                </button>
                <button type="button" onClick={() => setCheck(i, "na")}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: c.state === "na" ? MUTED : "#F1EFE9", color: c.state === "na" ? "#fff" : MUTED, border: "none" }}>
                  Yapılamadı
                </button>
              </div>
              );
            })}
          </div>
        ) : null}
        <div className="mt-4">
          <HoldTalkButton label={isRoutine ? "Basılı tut, bulgularını anlat" : "Basılı tut, yaptığını anlat"}
            onTranscript={(t) => setNote((n) => (n.trim() ? n.trim() + " " + t : t))} />
        </div>
        {seeded ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6C8F73" }}>
            <Sparkles size={12} /> ToolA sohbetindeki teşhisle dolduruldu, düzenleyebilirsin.
          </div>
        ) : null}
        <div className="mt-3">
          <SectionLabel>{isRoutine ? "Not (istersen)" : `Notun${note.trim() ? "" : " (istersen yaz)"}`}</SectionLabel>
          <textarea rows={isRoutine ? 2 : 5} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={isRoutine ? "Örn: Akü voltajı sınıra yakın, takipte." : "Örn: Kaplin hizası bozuktu. Hizalama yaptım. Testte ses kesildi."}
            className="mt-2 w-full rounded-3xl p-4 text-sm outline-none" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK }} />
        </div>
        {!hasEvidence ? (
          <div className="mt-4 rounded-2xl px-4 py-3 text-xs" style={{ background: "#FDF3E4", color: "#9C6B0A" }}>
            Kanıt olmadan iş kapatılamaz. Kanıt ekranına dönüp en az bir kanıt ekle.
          </div>
        ) : null}
        <div style={{ height: 100 }} />
        <BottomDock>
          <Dock primaryAction={{ label: "Kapanışı oluştur", onClick: proceed, disabled: !canReview }} onAsk={() => goto("ai", job.id)} plusItems={jobPlusItems(goto, job)} />
        </BottomDock>
        {previewEv ? <EvidencePreviewSheet ev={previewEv} job={job} onClose={() => setPreviewEv(null)} /> : null}
      </>
    );
  }

  if (step === "decision-gap") {
    // Only real evidence — never fabricate measurements. If the technician
    // hasn't attached any, we show none rather than sample chips.
    const measurements = job.evidence.filter((e) => e.type === "olcum");
    const photos = job.evidence.filter((e) => e.type === "foto" || e.type === "parca_foto");
    const audios = job.evidence.filter((e) => e.type === "ses");
    const tests = job.evidence.filter((e) => e.type === "hata_kodu");
    const contextChips = [
      job?.code ? { key: "code", text: job.code } : null,
      job?.equipment ? { key: "equip", text: job.equipment } : null,
      gapInfo?.initialDiagnosis ? { key: "init", text: `İlk teşhis: ${gapInfo.initialDiagnosis}` } : null,
      gapInfo?.finalRootCause ? { key: "root", text: `Gerçek kök neden: ${gapInfo.finalRootCause}` } : null,
      gapInfo?.intervention ? { key: "int", text: `Müdahale: ${gapInfo.intervention.slice(0, 60)}${gapInfo.intervention.length > 60 ? "…" : ""}` } : null,
      gapInfo?.outcome ? { key: "out", text: `Sonuç: ${gapInfo.outcome}` } : null,
    ].filter(Boolean);
    const evidenceChips = [
      ...measurements.map((m) => ({ key: m.id, text: m.value || `${m.measureType || "Ölçüm"}: ${m.measureValue || ""} ${m.measureUnit || ""}`.trim() })),
      photos.length ? { key: "ph", text: `${photos.length} fotoğraf` } : null,
      audios.length ? { key: "au", text: `${audios.length} ses kaydı` } : null,
      tests.length ? { key: "tt", text: `${tests.length} test/hata kodu` } : null,
    ].filter(Boolean);
    return (
      <>
        <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#9C6B0A" }}>
          <Sparkles size={12} /> KARAR NOKTASI
        </div>
        <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>
          ToolA bir teknik karar noktası buldu
        </h1>
        <div className="mt-3 rounded-3xl p-4" style={{ background: "#FDF3E4" }}>
          <p className="text-sm" style={{ color: INK }}>{gapInfo?.contextText}</p>
        </div>
        <div className="mt-4 rounded-3xl p-4" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Soru</div>
          <p className="mt-1.5 text-base font-semibold" style={{ color: INK }}>{gapInfo?.question}</p>
          {contextChips.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {contextChips.map((c) => (
                <span key={c.key} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#F1EFE9", color: INK }}>
                  {c.text}
                </span>
              ))}
            </div>
          ) : null}
          {evidenceChips.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {evidenceChips.map((c) => (
                <span key={c.key} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#E7F1FC", color: "#2563A6" }}>
                  {c.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <HoldTalkButton label="Basılı tut, kararını anlat"
            onTranscript={(t) => { setDecisionSkip(null); setDecisionReason((n) => (n.trim() ? n.trim() + " " + t : t)); }} />
        </div>
        <div className="mt-3">
          <SectionLabel>Karar gerekçen</SectionLabel>
          <textarea rows={4} value={decisionReason} onChange={(e) => { setDecisionSkip(null); setDecisionReason(e.target.value); }}
            placeholder={decisionPlaceholderFor(job)}
            className="mt-2 w-full rounded-3xl p-4 text-sm outline-none" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setDecisionSkip("unknown"); setDecisionReason(""); setStep("review"); }}
            className="rounded-full px-3.5 py-2 text-xs font-semibold" style={{ background: "#F1EFE9", color: MUTED, border: "none" }}>
            Bu bilgi bende yok
          </button>
          <button type="button" onClick={() => { setDecisionSkip("unimportant"); setDecisionReason(""); setStep("review"); }}
            className="rounded-full px-3.5 py-2 text-xs font-semibold" style={{ background: "#F1EFE9", color: MUTED, border: "none" }}>
            Bu karar önemli değildi
          </button>
        </div>
        <div style={{ height: 160 }} />
        <BottomDock>
          <Dock hideMic primaryAction={{ label: "Cevabı kaydet ve özeti gör", onClick: () => setStep("review"), disabled: decisionReason.trim().length < 3 }} />
        </BottomDock>
      </>
    );
  }



  return (
    <>
      <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>Kapanış özeti doğru mu?</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>ToolA notunu yapılandırdı. Gerekirse alanları düzenle.</p>
      <div className="mt-4 flex flex-col gap-2">
        <FieldCard label="Belirti" value={fields.symptom} onChange={(v) => setFields({ ...fields, symptom: v })} />
        <FieldCard label="Kök neden" value={fields.rootCause} onChange={(v) => setFields({ ...fields, rootCause: v })} />
        <FieldCard label="Müdahale" value={fields.intervention} onChange={(v) => setFields({ ...fields, intervention: v })} multiline />
        <FieldCard label="Kullanılan parça" value={fields.partUsed || ""} onChange={(v) => setFields({ ...fields, partUsed: v })} placeholder="Yoksa boş bırak" />
        <FieldCard label="Sonuç" value={fields.outcome} onChange={(v) => setFields({ ...fields, outcome: v })} />
      </div>
      {(() => {
        // ONE rule set with the panel: the score shown here equals the score
        // the office audits — quality problems get fixed at the source.
        const q = computeClosureQuality({ ...fields, evidenceCount: job.evidence.length });
        const good = q.score >= 80;
        return (
          <div className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: good ? "#E8F7EE" : "#FDF3E4" }}>
            <Gauge size={15} style={{ color: good ? "#1F8A4C" : "#9C6B0A", flexShrink: 0 }} />
            <span className="text-xs font-semibold" style={{ color: good ? "#1F8A4C" : "#9C6B0A" }}>AI-ready %{q.score}</span>
            <span className="flex-1 text-xs" style={{ color: MUTED }}>
              {q.missing.length ? `· Eksik: ${q.missing.join(", ")}` : "· Tüm alanlar tam"}
            </span>
            {q.missing.includes("kanıt") ? (
              <button type="button" onClick={() => goto("evidence", job.id)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold shrink-0" style={{ background: DOCK_DARK, color: "#fff", border: "none" }}>
                Kanıt ekle
              </button>
            ) : null}
          </div>
        );
      })()}
      <EvidenceStrip job={job} goto={goto} onPreview={setPreviewEv} label={`Bu kapanışa eklenecek kanıtlar (${job.evidence.length})`} />

      {gapInfo && decisionReason.trim() ? (
      <div className="mt-4 rounded-3xl p-4" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9C6B0A" }}>Teknik karar gerekçesi</div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#FDF3E4", color: "#9C6B0A" }}>decisionReason</span>
        </div>
        <textarea rows={3} value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)}
          className="mt-2 w-full rounded-2xl p-3 text-sm outline-none" style={{ background: "#F1EFE9", color: INK, border: "none" }} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gapInfo.initialCause ? (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#F1EFE9", color: INK }}>İlk teşhis: {gapInfo.initialCause}</span>
          ) : null}
          {job.evidence.filter((e) => e.type === "olcum").map((m) => (
            <span key={m.id} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#F1EFE9", color: INK }}>{m.value}</span>
          ))}
          <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#F1EFE9", color: INK }}>Kanıt: {job.evidence.length}</span>
        </div>
      </div>
      ) : null}


      {fields.memoryCandidate ? (
      <div className="mt-4 rounded-3xl p-4" style={{ background: "#E7F1FC" }}>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2563A6" }}>Hafızaya aday not</div>
        <p className="mt-1 text-sm" style={{ color: INK }}>{fields.memoryCandidate}</p>
      </div>
      ) : null}
      {fields.failedItems && fields.failedItems.length ? (
      <div className="mt-3 rounded-3xl p-4" style={{ background: "#FDF3E4" }}>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9C6B0A" }}>Kalan kalem: {fields.failedItems.join(", ")}</div>
        {followUp ? (
          <div className="mt-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: "#1F8A4C" }}>
            <CheckCircle2 size={15} /> Takip işi açıldı: {followUp.code}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-xs" style={{ color: MUTED }}>Kalan kalem takipsiz kalmasın.</p>
            <button type="button" onClick={() => setFollowUp(createFollowUp(job, fields.failedItems, fields.rawNote))}
              className="rounded-full px-3.5 py-2 text-xs font-semibold" style={{ background: DOCK_DARK, color: "#fff", border: "none" }}>
              Takip işi aç
            </button>
          </div>
        )}
      </div>
      ) : null}
      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock primaryAction={{ label: "Onayla ve gönder", onClick: confirm, disabled: !hasEvidence }} onAsk={() => goto("ai", job.id)} />
      </BottomDock>
      {previewEv ? <EvidencePreviewSheet ev={previewEv} job={job} onClose={() => setPreviewEv(null)} /> : null}
    </>
  );
}

function HoldScreen({ job, goto, holdJob }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  if (!job) return <EmptyState />;

  // One tap (reason) is enough to hold; the note is welcome but optional —
  // a blocked technician wants to move on, not fill out a form.
  const canSubmit = !!reason;

  function submit() {
    holdJob(job.id, {
      reason,
      note: note.trim(),
      nextAction: HOLD_NEXT[reason] || "Merkez değerlendirecek",
      heldAt: new Date().toISOString(),
    });
    goto("summary", job.id);
  }

  return (
    <>
      <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>Neden bekliyorsun?</h1>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>Nedeni seç, yeter. İstersen kısa bir not bırak — sonraki adımı ToolA nedenden türetir.</p>

      <div className="mt-4">
        <div className="grid grid-cols-2 gap-2">
          {HOLD_REASONS.map((r) => (
            <button key={r.id} type="button" onClick={() => setReason(r.id)} className="rounded-2xl px-3 py-2.5 text-left text-xs font-medium"
              style={{ background: reason === r.id ? DOCK_DARK : CARD_BG, color: reason === r.id ? "#fff" : INK, boxShadow: CARD_SHADOW, border: "none" }}>
              {r.label}
            </button>
          ))}
        </div>
        {reason ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6C8F73" }}>
            <Sparkles size={12} /> Sonraki adım: {HOLD_NEXT[reason]}
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <SectionLabel>Not (istersen)</SectionLabel>
        <div className="mt-2">
          <HoldTalkButton label="Basılı tut, durumu anlat"
            onTranscript={(t) => setNote((n) => (n.trim() ? n.trim() + " " + t : t))} />
        </div>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: Rulman stokta yok, depoya haber verildi."
          className="mt-2 w-full rounded-3xl p-4 text-sm outline-none" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK }} />
      </div>

      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock primaryAction={{ label: "Beklemeye al", onClick: submit, disabled: !canSubmit }} onAsk={() => goto("ai", job.id)} plusItems={jobPlusItems(goto, job)} />
      </BottomDock>
    </>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
      <div className="text-sm mt-0.5" style={{ color: INK }}>{value}</div>
    </div>
  );
}

function SummaryScreen({ job, goto, hasChat }) {
  const [previewEv, setPreviewEv] = useState(null);
  if (!job) return <EmptyState />;
  const closed = job.status === "tamamlandi" && job.closure;
  const held = job.status === "beklemede" && job.hold;
  return (
    <>
      <div className="mt-1 rounded-3xl p-4 flex items-center gap-3" style={{ background: closed ? "#DCF3E3" : held ? "#FDF3E4" : "#F1EFE9" }}>
        {closed ? <CheckCircle2 size={22} style={{ color: "#1F8A4C" }} /> : <PauseCircle size={22} style={{ color: "#9C6B0A" }} />}
        <div>
          <div className="text-sm font-semibold" style={{ color: INK }}>{closed ? "Kanıtlı kapanış tamamlandı" : held ? "İş beklemede" : ""}</div>
          <div className="text-xs" style={{ color: MUTED }}>
            {closed ? new Date(job.closure.closedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
              : held ? new Date(job.hold.heldAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-3xl p-4" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="text-sm font-semibold" style={{ color: INK }}>{job.title}</div>
        <div className="text-xs mt-0.5" style={{ color: MUTED }}>{job.equipment} · {job.location}</div>
      </div>

      {job.verify === "belirsiz" ? (
        <div className="mt-4 rounded-3xl p-4 flex gap-2" style={{ background: "#FDF3E4" }}>
          <AlertTriangle size={16} style={{ color: "#9C6B0A", marginTop: 2, flexShrink: 0 }} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9C6B0A" }}>Ekipman doğrulaması belirsiz</div>
            <p className="mt-0.5 text-sm" style={{ color: INK }}>Bu kayıt merkeze iletildi — teyit gerekebilir.</p>
          </div>
        </div>
      ) : null}

      {closed && typeof job.closure.qualityScore === "number" ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: job.closure.qualityScore >= 80 ? "#E8F7EE" : "#FDF3E4" }}>
          <Gauge size={15} style={{ color: job.closure.qualityScore >= 80 ? "#1F8A4C" : "#9C6B0A", flexShrink: 0 }} />
          <span className="text-xs font-semibold" style={{ color: job.closure.qualityScore >= 80 ? "#1F8A4C" : "#9C6B0A" }}>
            AI-ready %{job.closure.qualityScore}
          </span>
          <span className="text-xs" style={{ color: MUTED }}>· Bu skor merkezde de aynı kurallarla görünür</span>
        </div>
      ) : null}

      {closed ? (
        <div className="mt-4 toola-divide rounded-3xl" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <SummaryRow label="Belirti" value={job.closure.symptom} />
          <SummaryRow label="Kök neden" value={job.closure.rootCause} />
          <SummaryRow label="Müdahale" value={job.closure.intervention} />
          {job.closure.partUsed ? <SummaryRow label="Kullanılan parça" value={job.closure.partUsed} /> : null}
          <SummaryRow label="Sonuç" value={job.closure.outcome} />
        </div>
      ) : null}

      {closed && job.closure.memoryCandidate ? (
        <div className="mt-4 rounded-3xl p-4" style={{ background: "#E7F1FC" }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2563A6" }}>Hafıza adayın merkez onayında</div>
          <p className="mt-1 text-sm" style={{ color: INK }}>“{job.closure.memoryCandidate}”</p>
          <p className="mt-1.5 text-xs" style={{ color: MUTED }}>Onaylanırsa, benzer arızada ekip arkadaşlarına senin çözümün önerilecek.</p>
        </div>
      ) : null}

      {closed && hasChat ? (
        <button type="button" onClick={() => goto("ai", job.id)}
          className="mt-3 w-full flex items-center justify-between rounded-3xl p-4 text-left"
          style={{ background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Teşhis sohbeti</div>
            <div className="mt-0.5 text-sm font-medium" style={{ color: INK }}>Bu teşhise nasıl varıldı — salt-okunur arşiv</div>
          </div>
          <ChevronRight size={17} style={{ color: MUTED }} />
        </button>
      ) : null}

      {closed && job.closure.followUp ? (
        <button type="button" onClick={() => goto("jobDetail", job.closure.followUp.id)}
          className="mt-3 w-full flex items-center justify-between rounded-3xl p-4 text-left"
          style={{ background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9C6B0A" }}>Takip işi</div>
            <div className="mt-0.5 text-sm font-medium" style={{ color: INK }}>{job.closure.followUp.code} · kalan kalem için açıldı</div>
          </div>
          <ChevronRight size={17} style={{ color: MUTED }} />
        </button>
      ) : null}

      {held ? (
        <div className="mt-4 toola-divide rounded-3xl" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <SummaryRow label="Neden" value={HOLD_LABEL[job.hold.reason]} />
          {job.hold.note ? <SummaryRow label="Not" value={job.hold.note} /> : null}
          {job.hold.whyNotClosing ? <SummaryRow label="Kapanmama sebebi" value={job.hold.whyNotClosing} /> : null}
          <SummaryRow label="Sonraki aksiyon" value={job.hold.nextAction} />
          {job.hold.owner ? <SummaryRow label="Sorumlu" value={job.hold.owner} /> : null}
        </div>
      ) : null}

      <div className="mt-4">
        <SectionLabel>Kanıtlar ({job.evidence.length})</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job.evidence.length === 0 ? (
            <span className="text-sm" style={{ color: MUTED }}>Kanıt yok.</span>
          ) : (
            job.evidence.map((ev) => {
              const Icon = EV_ICON[ev.type] || Camera;
              return (
                <button key={ev.id} type="button" onClick={() => setPreviewEv(ev)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                  style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK, border: "none" }}>
                  <Icon size={13} style={{ color: "#6C8F73" }} />
                  {ev.label}{ev.value ? `: ${ev.value}` : ""}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock primaryAction={{ label: "İşlerime dön", onClick: () => goto("home") }} onAsk={() => goto("ai", job.id)} />
      </BottomDock>
      {previewEv ? <EvidencePreviewSheet ev={previewEv} job={job} onClose={() => setPreviewEv(null)} /> : null}
    </>
  );
}

function SuggestionCard({ icon: Icon, tone, fg, title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-left rounded-3xl p-4" style={{ width: 176, background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
      <div className="flex items-center justify-center rounded-2xl mb-3" style={{ width: 34, height: 34, background: tone }}>
        <Icon size={16} style={{ color: fg }} />
      </div>
      <div className="text-sm font-semibold leading-snug" style={{ color: INK }}>{title}</div>
      <div className="mt-1 text-xs" style={{ color: MUTED, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{desc}</div>
    </button>
  );
}

function AssistantScreen({ messages, ensureChat, appendChat, plusItems }) {
  const [thinking, setThinking] = useState(false);
  const [openSource, setOpenSource] = useState(null);
  const endRef = useRef(null);
  const [dockH, setDockH] = useState(100);

  useEffect(() => {
    if (messages.length === 0 && !thinking) return;
    const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
    return () => clearTimeout(t);
  }, [messages.length, thinking, dockH]);

  function send(text) {
    ensureChat("assistant", []);
    appendChat("assistant", { id: uid("u"), role: "user", text });
    setThinking(true);
    setTimeout(() => {
      appendChat("assistant", {
        id: uid("a"), role: "ai", text: assistantMockAnswer(text),
        sources: [{ label: "Bakım kılavuzu s.42", detail: "İlgili prosedür bölümü" }, { label: "Benzer vaka #1783", detail: "Son 90 gün" }],
      });
      setThinking(false);
    }, 700);
  }

  const greeting = getGreeting();

  return (
    <>
      {messages.length === 0 ? (
        <div className="mt-2">
          <h1 className="text-3xl font-bold leading-tight" style={{ color: INK }}>{greeting}, {TECH_NAME}.</h1>
          <p className="mt-2 text-lg" style={{ color: INK }}>Sana nasıl yardımcı olabilirim? İstediğini sor.</p>

          <div className="mt-7">
            <SectionLabel>Devam eden</SectionLabel>
            <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar pb-1">
              <SuggestionCard icon={Zap} tone="#FDF3E4" fg="#9C6B0A" title="P-204 kaplin hizası" desc="Lazer hizalama toleransı ≤0.05mm olmalı." onClick={() => send("P-204 için kaplin hizası toleransı nedir?")} />
              <SuggestionCard icon={Gauge} tone="#E7F1FC" fg="#2563A6" title="Klima gaz basıncı" desc="Düşük şarjda önce kaçak testi yapılır." onClick={() => send("Klima gaz basıncı düşükse önce ne kontrol edilir?")} />
            </div>
          </div>

          <div className="mt-6">
            <SectionLabel>Yeni fikirler</SectionLabel>
            <div className="mt-2 flex flex-col gap-2">
              {ASSISTANT_SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="text-left rounded-2xl px-4 py-3 text-sm" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: INK, border: "none" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 pb-2">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end mb-3">
                <div className="rounded-3xl px-4 py-2.5 text-sm" style={{ background: DOCK_DARK, color: "#fff", borderBottomRightRadius: 6, maxWidth: "80%" }}>{m.text}</div>
              </div>
            ) : (
              <AiAnswerCard key={m.id} msg={m} onAction={() => {}} onSourceClick={setOpenSource} />
            ),
          )}
          {thinking ? <div className="text-xs" style={{ color: MUTED }}>ToolA yazıyor…</div> : null}
        </div>
      )}
      <div ref={endRef} style={{ height: dockH + 14 }} />
      <BottomDock onHeight={setDockH}>
        <Dock onSend={send} plusItems={plusItems} />
      </BottomDock>

      <SourceSheet source={openSource} onClose={() => setOpenSource(null)} />
    </>
  );
}

// Today's route: open jobs in triage order as a numbered stop timeline.
// A live map can't load in this preview; the screen keeps the same IA so a
// native build can swap the background for a real map without redesigning.
function RouteScreen({ jobs, goto, plusItems }) {
  const stops = sortByTriage(jobs.filter((j) => j.status !== "tamamlandi" && j.status !== "beklemede"));
  const mapsDirUrl = stops.length > 0
    ? `https://www.google.com/maps/dir/${stops.map((j) => encodeURIComponent(j.location)).join("/")}`
    : null;

  return (
    <>
      <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: INK }}>Bugünün rotası</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>
        {stops.length > 0 ? `${stops.length} durak · öncelik ve termine göre sıralandı.` : "Bugün için açık durak yok."}
      </p>

      <div className="mt-4 flex flex-col">
        {stops.map((j, i) => (
          <div key={j.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center rounded-full shrink-0 text-xs font-bold"
                style={{ width: 28, height: 28, background: DOCK_DARK, color: "#fff" }}>
                {i + 1}
              </div>
              {i < stops.length - 1 ? <div style={{ width: 2, flex: 1, background: "#DEDBD3", margin: "4px 0" }} /> : null}
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <div role="button" tabIndex={0} onClick={() => goto("jobDetail", j.id)}
                onKeyDown={(e) => { if (e.key === "Enter") goto("jobDetail", j.id); }}
                className="rounded-3xl p-4 cursor-pointer" style={{ background: CARD_BG, boxShadow: CARD_SHADOW }}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold" style={{ color: INK }}>{j.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>{j.equipment} · {j.location}</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <PriorityChip priority={j.priority} />
                      {j.dueAt ? <span className="text-xs font-medium" style={{ color: "#9C6B0A" }}>{formatDue(j.dueAt)}</span> : null}
                    </div>
                  </div>
                  <button type="button" aria-label="Haritada aç"
                    onClick={(e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${encodeURIComponent(j.location)}`, "_blank"); }}
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: 32, height: 32, background: "#E7F1FC", border: "none" }}>
                    <Navigation size={14} style={{ color: "#2563A6" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock
          primaryAction={mapsDirUrl ? { label: "Rotayı haritada aç", onClick: () => window.open(mapsDirUrl, "_blank") } : { label: "İşlerime dön", onClick: () => goto("home") }}
          onAsk={() => goto("assistant")} plusItems={plusItems} />
      </BottomDock>
    </>
  );
}

function HistoryScreen({ jobs, goto, plusItems }) {
  const held = jobs.filter((j) => j.status === "beklemede");
  const done = jobs.filter((j) => j.status === "tamamlandi");
  return (
    <>
      <h1 className="mt-1 text-3xl font-bold" style={{ color: INK }}>Geçmiş</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>Kapanan, beklemede ve eski kayıtların.</p>

      {held.length > 0 ? (
        <div className="mt-6">
          <SectionLabel>Beklemedeki işler</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {held.map((j) => (
              <button key={j.id} type="button" onClick={() => goto("jobDetail", j.id)} className="flex items-center gap-3 rounded-3xl p-3 text-left" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
                <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: 36, height: 36, background: "#FDF3E4" }}>
                  <PauseCircle size={17} style={{ color: "#9C6B0A" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" style={{ color: INK }}>{j.title}</div>
                  <div className="text-xs truncate" style={{ color: MUTED }}>{j.equipment} · {j.location}</div>
                </div>
                <ChevronRight size={16} style={{ color: MUTED }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionLabel>Kapanan işler{done.length ? ` (${done.length})` : ""}</SectionLabel>
        {done.length === 0 ? (
          <div className="mt-2 rounded-3xl p-6 text-center text-sm" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, color: MUTED }}>Henüz tamamlanan iş yok.</div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {done.map((j) => (
              <button key={j.id} type="button" onClick={() => goto("summary", j.id)} className="flex items-center gap-3 rounded-3xl p-3 text-left" style={{ background: CARD_BG, boxShadow: CARD_SHADOW, border: "none" }}>
                <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: 36, height: 36, background: "#DCF3E3" }}>
                  <CheckCircle2 size={17} style={{ color: "#1F8A4C" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" style={{ color: INK }}>{j.title}</div>
                  <div className="text-xs truncate" style={{ color: MUTED }}>Kök neden: {j.closure?.rootCause}</div>
                </div>
                <ChevronRight size={16} style={{ color: MUTED }} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ height: 100 }} />
      <BottomDock>
        <Dock onAsk={() => goto("assistant")} plusItems={plusItems} />
      </BottomDock>
    </>
  );
}

/* ---------------------------------------------------------------------
   Root
--------------------------------------------------------------------- */
export default function ToolAApp() {
  const [jobs, setJobs] = useState(seedJobs);
  const [chats, setChats] = useState({}); // { [jobId | "assistant"]: Message[] } — lifted so chats survive navigation
  const [route, setRoute] = useState({ screen: "home", jobId: null });
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [memory, setMemory] = useState({ published: SEED_MEMORY, candidates: [] });

  // Persist the memory store alongside jobs.
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("toola-memory-v1");
        if (res && res.value) setMemory(JSON.parse(res.value));
      } catch (e) { /* seed stays */ }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try { await window.storage.set("toola-memory-v1", JSON.stringify(memory)); } catch (e) { /* ignore */ }
    })();
  }, [memory]);

  function addMemoryCandidate(cand) {
    setMemory((m) => ({ ...m, candidates: [cand, ...m.candidates] }));
  }

  // Feedback loop: "işe yaradı" increments the published record's usage —
  // the counter the panel shows next to each memory record.
  function onMemoryFeedback(jobId, memId, verdict, reason) {
    updateJob(jobId, (j) => ({ ...j, memoryFeedback: { memId, verdict, reason, at: new Date().toISOString() } }));
    if (verdict === "worked" && memId) {
      setMemory((m) => ({ ...m, published: m.published.map((r) => (r.id === memId ? { ...r, uses: r.uses + 1 } : r)) }));
    }
  }
  const scrollRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const normalizeStatus = (j) => (j.status === "teshis" || j.status === "yoldayim" ? { ...j, status: "sahadayim" } : j);
        // v2 storage: canonical field names (intervention/outcome). Old v1
        // records are migrated once, then live under the v2 key.
        const migrate = (j) => {
          let c = j.closure;
          if (c && (c.action !== undefined || c.result !== undefined)) {
            c = { ...c, intervention: c.intervention ?? c.action, outcome: c.outcome ?? c.result };
            delete c.action; delete c.result;
          }
          const status = j.status === "teshis" || j.status === "yoldayim" ? "sahadayim" : j.status;
          return { ...j, status, closure: c };
        };
        let res = await window.storage.get("toola-jobs-v2").catch(() => null);
        if (!res || !res.value) {
          const old = await window.storage.get("toola-jobs-v1").catch(() => null);
          if (old && old.value) res = { value: JSON.stringify(JSON.parse(old.value).map(migrate)) };
        }
        if (res && res.value) setJobs(JSON.parse(res.value).map(normalizeStatus));
      } catch (e) { /* nothing stored yet */ }
      try {
        const res2 = await window.storage.get("toola-chats-v1");
        if (res2 && res2.value) setChats(JSON.parse(res2.value));
      } catch (e) { /* nothing stored yet */ }
      loadedRef.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try { await window.storage.set("toola-jobs-v2", JSON.stringify(jobs)); } catch (e) { /* ignore */ }
    })();
  }, [jobs]);

  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try { await window.storage.set("toola-chats-v1", JSON.stringify(chats)); } catch (e) { /* ignore */ }
    })();
  }, [chats]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [route.screen, route.jobId]);


  function goto(screen, jobId) {
    setRoute((r) => ({ screen, jobId: jobId ?? r.jobId }));
  }

  function updateJob(id, fn) { setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j))); }
  function addEvidence(id, ev) {
    const evId = uid("ev");
    updateJob(id, (j) => ({ ...j, evidence: [...j.evidence, { ...ev, id: evId, createdAt: new Date().toISOString() }] }));
    return evId;
  }
  function toggleEvidenceTag(id, evId, tag) {
    updateJob(id, (j) => ({
      ...j,
      evidence: j.evidence.map((e) => {
        if (e.id !== evId) return e;
        const tags = e.tags || [];
        return { ...e, tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] };
      }),
    }));
  }
  function removeEvidence(id, evId) { updateJob(id, (j) => ({ ...j, evidence: j.evidence.filter((e) => e.id !== evId) })); }
  function setStatus(id, status) { updateJob(id, (j) => ({ ...j, status })); }
  // Assignment signal: opening a job's detail marks it as seen — the office
  // side reads this as "görüldü ✓" without asking the technician for a tap.
  function markSeen(id) { updateJob(id, (j) => (j.seenAt ? j : { ...j, seenAt: new Date().toISOString() })); }
  // Resuming a held job: back to "Sahada", hold record kept for the trail.
  function resumeJob(id) { updateJob(id, (j) => ({ ...j, status: "sahadayim", resumedAt: new Date().toISOString() })); }
  function setVerify(id, verify) { updateJob(id, (j) => ({ ...j, verify })); }
  function closeJob(id, closure) {
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    const q = computeClosureQuality({ ...closure, evidenceCount: j.evidence.length });
    const full = { ...closure, technician: TECH_NAME, qualityScore: q.score };
    // P1: every closure with a candidate sentence feeds the memory pipeline.
    if (full.memoryCandidate) {
      addMemoryCandidate({
        id: uid("memc"), statement: full.memoryCandidate, equipment: j.equipment,
        sourceJob: j.code, technician: TECH_NAME, createdAt: new Date().toISOString(),
        symptom: full.symptom, rootCause: full.rootCause, intervention: full.intervention, outcome: full.outcome,
      });
    }
    updateJob(id, (x) => ({ ...x, status: "tamamlandi", closure: full, hold: undefined }));
  }
  function holdJob(id, hold) { updateJob(id, (j) => ({ ...j, status: "beklemede", hold })); }

  // "Kaldı → takip işi": we OFFER, never auto-create. Opening a job in the
  // technician's name without asking would erode trust; asking costs one tap.
  function createFollowUp(fromJob, failedLabels, note) {
    const id = uid("job");
    const code = `SB-${String(Date.now()).slice(-4)}`;
    // returns {id, code} so the closure can link to the follow-up job
    const job = {
      id, code, taskType: "ariza",
      title: `${fromJob.equipment}: ${failedLabels[0]} takibi`,
      equipment: fromJob.equipment, location: fromJob.location,
      description: `${fromJob.code} rutin kontrolünde "${failedLabels.join(", ")}" kaldı — düzeltici iş.` + (note ? ` Teknisyen notu: ${note.slice(0, 200)}` : ""),
      priority: "orta", status: "atandi",
      assignedBy: `Rutin kontrol takibi · ${fromJob.code}`,
      seenAt: new Date().toISOString(),
      history: [], bringItems: [], evidence: [],
    };
    setJobs((js) => [job, ...js]);
    return { id, code };
  }

  function addJob({ title, equipment, location }) {
    const id = uid("job");
    const job = {
      id, code: `SB-${String(Date.now()).slice(-4)}`, taskType: "ariza", title, equipment, location,
      description: "Saha bildirimi — teknisyen tarafından oluşturuldu.", priority: "orta", status: "atandi",
      assignedBy: `Saha bildirimi · ${TECH_NAME}`, history: [], bringItems: [], evidence: [],
    };
    setJobs((js) => [job, ...js]);
    setNewJobOpen(false);
    setRoute({ screen: "jobDetail", jobId: id });
  }

  function clearChat(key) {
    setChats((c) => { const n = { ...c }; delete n[key]; return n; });
  }
  function appendChat(key, msg) { setChats((c) => ({ ...c, [key]: [...(c[key] || []), msg] })); }
  function ensureChat(key, initMessages) { setChats((c) => (c[key] ? c : { ...c, [key]: initMessages })); }

  async function resetDemo() {
    const fresh = seedJobs();
    setJobs(fresh);
    setChats({});
    try { await window.storage.set("toola-jobs-v2", JSON.stringify(fresh)); } catch (e) { /* ignore */ }
    try { await window.storage.set("toola-chats-v1", JSON.stringify({})); } catch (e) { /* ignore */ }
    setRoute({ screen: "home", jobId: null });
    setProfileOpen(false);
  }

  const activeJob = jobs.find((j) => j.id === route.jobId);

  // + menu on global screens: report a new job, or jump to a job via QR.
  const globalPlus = [
    { icon: Wrench, label: "Yeni iş bildir", desc: "Sahada fark ettiğin sorunu kaydet", tone: "#DCF3E3", fg: "#1F8A4C", onClick: () => setNewJobOpen(true) },
    { icon: QrCode, label: "QR ile ekipman bul", desc: "Etiket okut, ilgili işe atla", tone: "#E7F1FC", fg: "#2563A6", onClick: () => setQrOpen(true) },
  ];
  const profileBtn = <IconBtn icon={User} onClick={() => setProfileOpen(true)} />;

  let body = null, topMode = "none", topOnBack = () => goto("home"), topRight = null;

  switch (route.screen) {
    case "jobDetail":
      body = <JobDetailScreen job={activeJob} goto={goto} resumeJob={resumeJob} markSeen={markSeen} />;
      topMode = "back"; topOnBack = () => goto("home");
      break;
    case "evidence":
      body = (
        <EvidenceScreen job={activeJob} goto={goto} addEvidence={addEvidence} removeEvidence={removeEvidence} toggleEvidenceTag={toggleEvidenceTag}
          setStatus={setStatus} setVerify={setVerify} />
      );
      topMode = "back"; topOnBack = () => goto("jobDetail");
      break;
    case "ai":
      body = (
        <AiChatScreen job={activeJob} goto={goto} memory={memory} onMemoryFeedback={onMemoryFeedback}
          messages={activeJob ? chats[activeJob.id] || [] : []} ensureChat={ensureChat} appendChat={appendChat} />
      );
      topMode = "back"; topOnBack = () => goto("evidence");
      topRight = activeJob ? <span className="text-xs font-semibold" style={{ color: MUTED }}>{activeJob.code}</span> : null;
      break;
    case "close":
      body = <CloseScreen job={activeJob} goto={goto} closeJob={closeJob} aiMessages={activeJob ? chats[activeJob.id] || [] : []} createFollowUp={createFollowUp} addEvidence={addEvidence} />;
      topMode = "back"; topOnBack = () => goto("evidence");
      break;
    case "hold":
      body = <HoldScreen job={activeJob} goto={goto} holdJob={holdJob} />;
      topMode = "back"; topOnBack = () => goto("evidence");
      break;
    case "summary":
      body = <SummaryScreen job={activeJob} goto={goto} hasChat={Boolean(activeJob && (chats[activeJob.id] || []).length > 1)} />;
      topMode = "back"; topOnBack = () => goto("home");
      break;
    case "assistant":
      body = <AssistantScreen messages={chats.assistant || []} ensureChat={ensureChat} appendChat={appendChat} plusItems={globalPlus} />;
      topMode = "back"; topOnBack = () => goto("home");
      topRight = (chats.assistant || []).length > 0 ? (
        <button type="button" onClick={() => clearChat("assistant")}
          className="rounded-full px-3.5 py-2 text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.9)", color: INK, boxShadow: FLOAT_SHADOW, backdropFilter: "blur(10px)", border: "none" }}>
          + Yeni konuşma
        </button>
      ) : null;
      break;
    case "history":
      body = <HistoryScreen jobs={jobs} goto={goto} plusItems={globalPlus} />;
      topMode = "back"; topOnBack = () => goto("home"); topRight = profileBtn;
      break;
    case "route":
      body = <RouteScreen jobs={jobs} goto={goto} plusItems={globalPlus} />;
      topMode = "back"; topOnBack = () => goto("home"); topRight = profileBtn;
      break;
    default:
      body = <HomeScreen jobs={jobs} goto={goto} plusItems={globalPlus} />;
      topMode = "none"; topRight = profileBtn;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#EAE7E0", padding: 20 }}>
      <style>{`
        .toola-divide > *:not(:first-child) { border-top: 1px solid #F1EFE8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes toola-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.14); opacity: 0.7; } }
        textarea, input { font-family: inherit; }
      `}</style>
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 390, height: "min(844px, 100vh - 40px)", borderRadius: 36, background: PAGE_GRADIENT, boxShadow: "0 40px 80px rgba(20,20,20,0.28), 0 10px 24px rgba(20,20,20,0.15)" }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: "18px 20px 0" }}>
          <div className="flex items-center justify-center gap-1.5 pb-1">
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#1F8A4C", display: "inline-block" }} />
            <span className="text-xs font-medium" style={{ color: MUTED }}>Çevrimdışı hazır · senkronize</span>
          </div>
          <TopBar mode={topMode} onBack={topOnBack} right={topRight} />
          {body}
        </div>
        <NewJobSheet open={newJobOpen} onClose={() => setNewJobOpen(false)} onCreate={addJob} jobs={jobs} />
        <QrSheet open={qrOpen} onClose={() => setQrOpen(false)} jobs={jobs} onPick={(id) => { setQrOpen(false); setRoute({ screen: "jobDetail", jobId: id }); }} />
        <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} onReset={resetDemo} jobs={jobs} />
      </div>
    </div>
  );
}
