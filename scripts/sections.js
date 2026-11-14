/* Sezioni con dati propri. Ognuna registra indicatori (M), KPI e blocchi della scheda municipio.
   Se uno snapshot manca, la sezione non registra nulla e la pagina lo dice. */
window.HERO_KPIS = []; window.HOME_BLOCKS = []; window.MUN_HEAD = []; window.MUN_KPIS = []; window.MUN_BLOCKS = [];

/* l'Annuario ripete la lista d'attesa dei nidi: teniamo quella del file Dashboard Nidi, più completa */
{ const i = M.findIndex(m => m.id === "ann_nido_lista_attesa_finale"); if (i >= 0 && D.nidi) M.splice(i, 1); }

/* ---------------- popolazione per gli indicatori per abitante ---------------- */
const POP = id => A?.municipi[id]?.popolazione;
const POP_SRC = "residenti al 31/12/2025, Annuario 2025 Tab. 1.2";

/* ---------------- bilancio: PEG 2026 ---------------- */
if (D.bilancio_peg_2026) {
  const B = D.bilancio_peg_2026, sp = id => B.municipi[id]?.spese;
  const tit = (s, c) => (s?.per_titolo || []).find(t => t.codice === c)?.competenza_2026;
  const mis = (s, c) => (s?.per_missione || []).find(t => t.codice === c)?.competenza_2026;
  const PER = "competenza 2026", SRC = "PEG 2026-2028, Allegato A (DGC 110/2026)";
  const ab = (base, label, opts = {}) => M.push({ ...base, id: base.id + "_ab", label, unit: "eur_ab", per: true, src: base.src + " / " + POP_SRC, ...opts,
    get: id => { const v = base.get(id), p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });
  const tot = { id: "peg_spese", label: "Stanziamenti di spesa del municipio", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC,
    note: B.misura, get: id => sp(id)?.competenza_2026, roma: null };
  ab(tot, "Stanziamenti di spesa per abitante", { home: true, note: "Quanto il PEG 2026 assegna ai capitoli del municipio, diviso per i residenti. Non comprende la spesa dei dipartimenti centrali sul territorio." });
  M.push(tot);
  const corr = { id: "peg_correnti", label: "Spese correnti stanziate", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC, get: id => tit(sp(id), "U.1"), roma: null };
  const cap = { id: "peg_capitale", label: "Spese in conto capitale stanziate", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC, get: id => tit(sp(id), "U.2"), roma: null };
  M.push(corr, cap); ab(corr, "Spese correnti per abitante"); ab(cap, "Investimenti (conto capitale) per abitante");
  [["04", "Istruzione"], ["12", "Politiche sociali e famiglia"], ["10", "Strade e mobilità"], ["06", "Sport e giovani"], ["05", "Cultura"]].forEach(([c, l]) =>
    ab({ id: "peg_mis_" + c, src: SRC + ", missione " + c, group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, get: id => mis(sp(id), c) }, `${l}: stanziamenti per abitante`));

  HERO_KPIS.unshift(() => {
    const s = B.roma?.somma_15_municipi?.spese, r = B.roma?.spese;
    const m12 = s ? (tit(s, "U.1") || 0) + (tit(s, "U.2") || 0) : null, r12 = r ? (tit(r, "U.1") || 0) + (tit(r, "U.2") || 0) : null;
    return kpi("Stanziamenti 2026 dei 15 municipi", s?.competenza_2026, "eur", isNum(m12) && r12 ? `${f1.format(m12 / r12 * 100)}% delle spese correnti e d'investimento di Roma Capitale` : "", `<a href="#/fonti">PEG 2026-2028</a>`);
  });
  HERO_KPIS.unshift(() => kpi("Residenti", A?.roma?.popolazione, "int", "al 31/12/2025", "Annuario statistico 2025"));
  MUN_KPIS.unshift(id => { const v = sp(id)?.competenza_2026, p = POP(id);
    return kpi("Stanziamenti 2026", v, "eur", isNum(v) && p ? `${fEur.format(v / p)} per abitante` : "", "PEG 2026-2028"); });
  MUN_KPIS.unshift(id => kpi("Residenti", POP(id), "int", "al 31/12/2025", "Annuario 2025, Tab. 1.2"));

  MUN_BLOCKS.unshift(id => {
    const s = sp(id), e = B.municipi[id]?.entrate; if (!s) return "";
    const altri = s.di_cui_budget_gestito_da_altre_strutture?.competenza_2026;
    const top = (arr, n) => (arr || []).filter(x => x.competenza_2026 > 0).slice(0, n);
    return `<section class="block"><div class="head"><div><h2>Il bilancio del municipio</h2><p>Quanto il Piano esecutivo di gestione 2026 stanzia sui capitoli del municipio, e per cosa. Sono previsioni di spesa, non pagamenti.</p></div></div>
    <div class="grid g4">${kpi("Competenza 2026", s.competenza_2026, "eur", "spese che si possono impegnare nel 2026")}${kpi("Cassa 2026", s.cassa_2026, "eur", "pagamenti previsti nel 2026, anche di anni passati")}${kpi("Spese correnti", tit(s, "U.1"), "eur", "personale, servizi, contributi")}${kpi("Investimenti", tit(s, "U.2"), "eur", "opere e manutenzioni straordinarie")}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Per missione (competenza 2026)</h3>${barsList(top(s.per_missione, 10).map(x => ({ label: x.nome, v: x.competenza_2026 })), "eur")}</div>
      <div class="panel"><h3>Per tipo di spesa</h3>${barsList(top(s.per_macroaggregato, 8).map(x => ({ label: x.nome, v: x.competenza_2026 })), "eur")}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Programma</th><th class="num">Competenza 2026</th><th class="num">Cassa 2026</th><th class="num">Competenza 2027</th><th class="num">Competenza 2028</th></tr></thead><tbody>
      ${top(s.per_programma, 12).map(x => `<tr><td>${esc(x.codice)} ${esc(x.nome)}</td><td class="num">${fmt(x.competenza_2026, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.cassa_2026, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.competenza_2027, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.competenza_2028, "eur", s.competenza_2026)}</td></tr>`).join("")}
      <tr class="tot"><td>Totale municipio</td><td class="num">${fmt(s.competenza_2026, "eur")}</td><td class="num">${fmt(s.cassa_2026, "eur")}</td><td class="num">${fmt(s.competenza_2027, "eur")}</td><td class="num">${fmt(s.competenza_2028, "eur")}</td></tr>
    </tbody></table></div><p class="src">I 12 programmi con più risorse. Il calo nel 2027 e 2028 è normale: gli investimenti vengono iscritti anno per anno.</p>
    ${isNum(altri) ? `<div class="caveat"><b>Da sapere.</b> ${fmt(altri, "eur")} (${f1.format(altri / s.competenza_2026 * 100)}%) di questi stanziamenti sono su capitoli del municipio ma gestiti da altre strutture, soprattutto Risorse umane (stipendi) e Scuola. Le entrate assegnate al municipio sono ${fmt(e?.competenza_2026, "eur")}.</div>` : ""}
    ${srcLine("bilancio_peg_2026", "competenza e cassa 2026, risorse al 16/04/2026")}</section>`;
  });
}
/* ---------------- appalti ANAC ---------------- */
if (D.appalti_anac) {
  const P = D.appalti_anac, Y = "2025";
  const y = (id, yr = Y) => P.municipi[id]?.[yr];
  const cls = (o, c) => (o?.per_scelta_contraente || []).find(x => x.classe === c);
  /* importo netto (lordo meno i doppi conteggi) se lo snapshot lo ha; altrimenti l'importo lordo */
  const imp = o => isNum(o?.importo_netto) ? o.importo_netto : o?.importo_totale;
  const NETTO = IDS.some(id => isNum(y(id)?.importo_netto));
  const NOTA_NETTO = NETTO ? "Importo al netto dei doppi conteggi: accordi quadro e loro contratti attuativi nello stesso periodo, gare rilanciate. " : "";
  M.push({ id: "anac_importo", label: "Appalti avviati: importo dei CIG", unit: "eur", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, CIG del centro di costo del municipio", note: NOTA_NETTO + (P.misura || ""), get: id => imp(y(id)), roma: null });
  M.push({ id: "anac_n", label: "Appalti avviati: numero di CIG", unit: "int", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, CIG del centro di costo del municipio", get: id => y(id)?.n_cig, roma: null });
  M.push({ id: "anac_importo_ab", label: "Appalti avviati per abitante", unit: "eur_ab", per: true, group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC CIG / " + POP_SRC, note: NOTA_NETTO || undefined, get: id => { const v = imp(y(id)), p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });
  /* riferimento: la somma dei 15 municipi, calcolata dai dati dei municipi (non il totale di Roma Capitale, che comprende i dipartimenti) */
  const dirSum = (() => { let d = 0, n = 0; for (const id of IDS) { const o = y(id), c = cls(o, "affidamento_diretto"); if (!o || !c) return null; d += c.n_cig; n += o.n_cig; } return n > 0 ? d / n * 100 : null; })();
  M.push({ id: "anac_diretti", label: "Quota di CIG con affidamento diretto", unit: "pct", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, campo scelta del contraente", get: id => { const c = cls(y(id), "affidamento_diretto"); return c ? c.quota_n * 100 : null; },
    roma: dirSum, romaLabel: "somma dei municipi",
    note: "Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria: una quota alta non è da sola un'anomalia." });

  HERO_KPIS.push(() => {
    const tot = IDS.reduce((s, id) => s + (imp(y(id)) || 0), 0), R = P.roma?.[Y], r = imp(R), sm = R?.somma_municipi || {};
    const qImp = isNum(sm.quota_importo_netto) ? sm.quota_importo_netto * 100 : (isNum(r) && r > 0 ? tot / r * 100 : null);
    const qN = isNum(sm.quota_n) ? sm.quota_n * 100 : null;
    const sub = isNum(qImp) ? `${f1.format(qImp)}% dell'importo dei CIG di Roma Capitale (${euroLike(r)})${isNum(qN) ? `; il ${f1.format(qN)}% per numero di CIG` : ""}` : "";
    return kpi("Appalti avviati dai 15 municipi nel 2025", tot, "eur", sub + (NETTO ? ". Importi al netto dei doppi conteggi." : ""), `<a href="#/fonti">ANAC, CIG 2025</a>`);
  });
  MUN_KPIS.push(id => kpi("Appalti avviati nel 2025", imp(y(id)), "eur", `${fmt(y(id)?.n_cig, "int")} CIG`, "ANAC"));
  MUN_BLOCKS.push(id => {
    const a = y(id), b = y(id, "2026"); if (!a) return "";
    const proc = a.per_scelta_contraente.filter(x => x.n_cig > 0);
    const sv = a.sovrapposizioni, aq = sv?.attuativi_aq, gr = sv?.gare_rilanciate;
    const parti = [aq?.importo > 0 ? `accordi quadro e loro contratti attuativi nello stesso periodo (${fmt(aq.n_cig, "int")} CIG, ${euroLike(aq.importo)})` : "",
      gr?.importo > 0 ? `gare rilanciate (${fmt(gr.n_cig, "int")} CIG, ${euroLike(gr.importo)})` : ""].filter(Boolean);
    const doppi = sv?.importo > 0 ? `<p class="src">Doppi conteggi: ${euroLike(sv.importo)} dei ${euroLike(a.importo_totale)} lordi del 2025 sono contati due volte${parti.length ? `: ${parti.join("; ")}` : ""}. Li togliamo dall'importo. I grafici sotto usano l'importo lordo.</p>` : "";
    return `<section class="block"><div class="head"><div><h2>Appalti avviati dal municipio</h2><p>Gare e affidamenti registrati su ANAC dagli uffici del municipio. È il valore a base di gara o di aggiudicazione, non quanto è stato pagato, e può coprire più anni.</p></div></div>
    <div class="grid g4">${kpi("CIG nel 2025", a.n_cig, "int")}${kpi("Importo 2025", imp(a), "eur", isNum(a.importo_netto) ? "al netto dei doppi conteggi" : "")}${kpi("CIG nel 2026", b?.n_cig, "int", "1 gennaio - 30 settembre")}${kpi("Importo 2026", imp(b), "eur", "anno non concluso" + (isNum(b?.importo_netto) ? ", al netto dei doppi conteggi" : ""))}</div>
    ${doppi}
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Come è stato scelto il contraente (2025, importo)</h3>${barsList(proc.map(x => ({ label: x.etichetta, v: x.importo })), "eur")}
        <p class="src">Per numero di CIG: ${proc.map(x => `${esc(x.etichetta.split(" (")[0])} ${f1.format(x.quota_n * 100)}%`).join(" · ")}. Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria.</p></div>
      <div class="panel"><h3>Cosa si compra (2025, prime 5 categorie CPV)</h3>${barsList((a.top5_cpv_divisioni_per_importo || []).map(x => ({ label: x.etichetta, v: x.importo })), "eur")}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>CIG</th><th>Oggetto</th><th>Procedura</th><th>Data</th><th class="num">Importo</th></tr></thead><tbody>
      ${(a.top10_cig_per_importo || []).map(t => `<tr><td style="font-family:var(--mono)">${esc(t.cig)}</td><td>${esc(t.oggetto)}</td><td>${esc(String(t.scelta_contraente || "").toLowerCase())}</td><td style="white-space:nowrap">${esc(t.data_pubblicazione)}</td><td class="num">${fmt(Number(t.importo), "eur_exact")}</td></tr>`).join("")}
    </tbody></table></div><p class="src">I 10 CIG più grandi del 2025. Il sito non mostra le imprese che hanno vinto: il dataset dei CIG non le contiene.</p>
    ${srcLine("appalti_anac", "CIG con data di pubblicazione nel 2025 e dal 1/1 al 30/9/2026")}</section>`;
  });
}
/* ---------------- progetti PNRR, Giubileo e altri fondi ---------------- */
/* Progetti mostrati per luogo: sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio. */
if (D.progetti) {
  const P = D.progetti, pm = id => P.municipi[id];
  /* snapshot nuovo: importo_totale_euro conta solo i fondi del programma (CUP con lo stesso importo contato una volta) */
  const SOLO_PROG = IDS.some(id => isNum(pm(id)?.importo_schede_lordo_euro));
  const NOTA_IMP = SOLO_PROG ? " L'importo conta solo i fondi del programma; un CUP con lo stesso importo è contato una volta." : "";
  const GESTIONE = "I progetti sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio.";
  M.push({ id: "prog_importo", label: "Progetti con fondi straordinari: importo", unit: "eur", group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti di Roma Capitale (PNRR, Giubileo, PN Metro, fondi UE)",
    note: "Progetti collocati in un solo municipio; quelli di più municipi o di tutta la città restano a parte. " + GESTIONE + NOTA_IMP, get: id => pm(id)?.importo_totale_euro, roma: null });
  M.push({ id: "prog_n", label: "Progetti con fondi straordinari: numero", unit: "int", group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti di Roma Capitale", note: GESTIONE, get: id => pm(id)?.n_progetti, roma: null });
  M.push({ id: "prog_importo_ab", label: "Progetti con fondi straordinari per abitante", unit: "eur_ab", per: true, group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti / " + POP_SRC, note: GESTIONE + NOTA_IMP,
    get: id => { const v = pm(id)?.importo_totale_euro, p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });

  HERO_KPIS.push(() => {
    const c = P.cittadino || {}, sum = IDS.reduce((s, id) => s + (pm(id)?.importo_totale_euro || 0), 0);
    const all = sum + ["piu_municipi", "intermunicipale", "senza_municipio"].reduce((s, k) => s + (c[k]?.importo_totale_euro || 0), 0);
    return kpi("Progetti PNRR, Giubileo e fondi UE sul territorio dei municipi", sum, "eur", `su ${euroLike(all)} di progetti elencati da Roma Capitale. Li gestiscono per lo più i dipartimenti centrali.`, `<a href="#/fonti">pagine progetti</a>`);
  });
  HOME_BLOCKS.push(() => {
    const c = P.cittadino || {}, sum = IDS.reduce((s, id) => s + (pm(id)?.importo_totale_euro || 0), 0);
    const rows = [{ label: "In un solo municipio", v: sum }, { label: "Su più municipi", v: c.piu_municipi?.importo_totale_euro },
      { label: "Intermunicipali", v: c.intermunicipale?.importo_totale_euro }, { label: "Senza municipio indicato", v: c.senza_municipio?.importo_totale_euro }];
    return `<section class="block"><div class="head"><div><h2>Dove finiscono i fondi straordinari</h2><p>PNRR, Giubileo 2025, PN Metro e fondi UE gestiti da Roma Capitale. Più della metà dell'importo riguarda opere su più municipi o sull'intera città, quindi non entra nelle schede dei singoli municipi. ${GESTIONE}${NOTA_IMP}</p></div></div>
    <div class="panel">${barsList(rows, "eur")}</div>${srcLine("progetti", "elenco letto il " + dateIt(P.verificato))}</section>`;
  });
  MUN_KPIS.push(id => kpi("Progetti PNRR, Giubileo e fondi UE sul territorio", pm(id)?.importo_totale_euro, "eur", `${fmt(pm(id)?.n_progetti, "int")} progetti collocati nel municipio`, "Roma Capitale, pagine progetti"));
  const FONTE_MUN = { testo_scheda: "municipio indicato nel testo della scheda", testo_programma: "municipio indicato nel testo del programma", cup_per_municipio: "scheda unica per più municipi, con un CUP e un importo per ciascuno" };
  MUN_BLOCKS.push(id => {
    const m = pm(id); if (!m) return "";
    const progs = Object.entries(m.per_programma || {}).map(([k, v]) => ({ label: `${k} (${v.n_progetti})`, v: v.importo_totale_euro }));
    const hasProgImp = (m.progetti || []).some(p => isNum(p.importo_programma_euro));
    const impP = p => hasProgImp ? p.importo_programma_euro : p.importo;
    const NO_IMP = { "solo cifre di altre fonti": "altre fonti, non del programma", "importo non leggibile nella fonte": "non leggibile nella fonte" };
    const impCell = p => isNum(impP(p)) ? fmt(impP(p), "eur_exact") : `<small>${esc(NO_IMP[p.importo_programma_metodo] || "non disponibile")}</small>`;
    const list = [...(m.progetti || [])].sort((a, b) => (impP(b) ?? -1) - (impP(a) ?? -1));
    const intro = `Opere e servizi finanziati da PNRR, Giubileo 2025 e altri fondi straordinari che si trovano sul territorio del municipio. ${GESTIONE} ${hasProgImp ? "È la quota finanziata dal programma" : "È l'importo indicato nella scheda"}, non quanto è già stato pagato.` +
      (SOLO_PROG ? NOTA_IMP : " Alcuni importi sommano più fonti di finanziamento.");
    return `<section class="block"><div class="head"><div><h2>Progetti sul territorio</h2><p>${intro}</p></div></div>
    <div class="panel"><h3>Importo per programma</h3>${barsList(progs, "eur")}</div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Progetto</th><th>Programma</th><th>Stato</th><th class="num">${hasProgImp ? "Fondi del programma" : "Importo"}</th></tr></thead><tbody>
    ${list.map(p => { const note = [p.attuatore ? "Attuatore: " + p.attuatore : "", p.municipio_fonte && p.municipio_fonte !== "campo_scheda" ? (FONTE_MUN[p.municipio_fonte] || "municipio non indicato nel campo della scheda") : "", p.nota || ""].filter(Boolean);
      return `<tr><td><a href="${esc(safeUrl(p.link) || "#")}" target="_blank" rel="noopener">${esc(p.titolo)}</a>${p.cup?.length ? `<br><small class="src" style="margin:0">CUP ${p.cup.map(esc).join(", ")}</small>` : ""}${note.length ? `<br><small class="src" style="margin:0">${note.map(esc).join(" · ")}</small>` : ""}</td><td>${esc(p.programma)}</td><td>${esc(p.stato || "")}</td><td class="num" title="${esc(p.importo_testo || "")}">${impCell(p)}</td></tr>`; }).join("")}
    </tbody></table></div>${hasProgImp ? `<p class="src">La colonna conta solo i fondi del programma. Il testo completo dell'importo è nella scheda del progetto.</p>` : ""}${srcLine("progetti", "elenco letto il " + dateIt(P.verificato))}</section>`;
  });
}

/* ---------------- nidi ---------------- */
if (D.nidi) {
  const N = D.nidi, per = N.municipi["1"]?.anno_educativo || "";
  const add = (key, label, extra = {}) => M.push({ id: "nidi_" + key, label, unit: "int", group: "Servizi", snap: "nidi",
    periodo: "anno educativo " + per, src: "Dashboard Nidi 2025", note: N.misura, non: N.non_misura,
    get: id => N.municipi[id]?.[key], roma: N.roma?.[key], romaLabel: "somma dei municipi", ...extra });
  add("posti", "Posti nei nidi (comunali e convenzionati)");
  add("iscritti", "Bambini iscritti al nido");
  add("domande_valide", "Domande valide per il nido");
  add("lista_attesa_finale", "Bambini in lista d'attesa a fine anno");
  M.push({ id: "nidi_copertura", label: "Iscritti per 100 domande valide", unit: "dec", group: "Servizi", snap: "nidi",
    periodo: "anno educativo " + per, src: "Dashboard Nidi 2025, calcolo: iscritti / domande valide x 100",
    get: id => { const m = N.municipi[id]; return m && m.domande_valide > 0 ? m.iscritti / m.domande_valide * 100 : null; },
    roma: N.roma && N.roma.domande_valide > 0 ? N.roma.iscritti / N.roma.domande_valide * 100 : null, romaLabel: "somma dei municipi" });

  MUN_BLOCKS.push(id => {
    const m = N.municipi[id]; if (!m) return "";
    const years = Object.entries(m.serie_storica || {});
    const tip = Object.entries(m.posti_per_tipologia || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k.replace(" - ", ": "), v }));
    return `<section class="block"><div class="head"><div><h2>Asili nido</h2><p>Posti, iscritti e liste d'attesa del servizio comunale e dei nidi convenzionati nel municipio.</p></div></div>
    <div class="grid g4">${kpi("Strutture", m.n_strutture, "int")}${kpi("Posti", m.posti, "int")}${kpi("Iscritti", m.iscritti, "int")}${kpi("Lista d'attesa a fine anno", m.lista_attesa_finale, "int", `iniziale: ${fmt(m.lista_attesa_iniziale, "int")}`)}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Posti per tipo di gestione</h3>${barsList(tip, "int")}</div>
      <div class="panel"><h3>Lista d'attesa a fine anno, negli anni</h3>${barsList(years.map(([y, v]) => ({ label: y, v: v.lista_attesa_finale })), "int")}</div>
    </div>${srcLine("nidi")}</section>`;
  });
}

/* ---------------- politica ---------------- */
if (D.politica) {
  const P = D.politica;
  MUN_HEAD.push(id => {
    const m = P.municipi[id]; if (!m) return "";
    return `<p class="lede">Presidente: <b>${esc(m.presidente || "non indicato sulla pagina")}</b>${m.pagina ? ` · <a href="${esc(m.pagina)}" target="_blank" rel="noopener">pagina ufficiale</a>` : ""}</p>`;
  });
  MUN_BLOCKS.push(id => {
    const m = P.municipi[id]; if (!m) return "";
    const cons = m.consiglio?.consiglieri || [];
    const byGroup = {}; cons.forEach(c => { const g = c.gruppo || c.gruppo_da_simbolo || "Gruppo non indicato"; (byGroup[g] = byGroup[g] || []).push(c); });
    const groups = Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length);
    return `<section class="block"><div class="head"><div><h2>Chi governa il municipio</h2><p>Presidente, giunta e consiglio come pubblicati da Roma Capitale. Consiliatura iniziata nell'ottobre 2021.</p></div></div>
    <div class="grid g2">
      <div class="panel"><h3>Giunta</h3><ul class="people">
        <li><b>${esc(m.presidente || "n.d.")}</b> · Presidente${m.presidente_deleghe ? `<br><small>${esc(m.presidente_deleghe)}</small>` : ""}</li>
        ${(m.giunta || []).map(g => `<li><b>${esc(g.nome)}</b> · ${esc(g.ruolo || "")}${g.deleghe ? `<br><small>${esc(g.deleghe)}</small>` : ""}</li>`).join("")}</ul></div>
      <div class="panel"><h3>Consiglio: ${cons.length} consiglieri più il presidente, per gruppo</h3>
        ${barsList(groups.map(([g, l]) => ({ label: g, v: l.length })), "int")}
        <details><summary>Elenco dei consiglieri</summary><ul class="people">${cons.map(c => `<li>${esc(c.nome)}${c.ruolo ? ` · ${esc(c.ruolo)}` : ""}<br><small>${esc(c.gruppo || c.gruppo_da_simbolo || "")}</small></li>`).join("")}</ul></details></div>
    </div>${srcLine("politica", "composizione pubblicata al " + dateIt(P.verificato))}</section>`;
  });
}

/* Le pagine #/pnrr e #/giubileo-2025, i grafici della scheda municipio, Confronta e la mappa della pagina iniziale
   vengono da web/lib (scripts/da-web.js, generato con `cd web && npm run porta`). */
