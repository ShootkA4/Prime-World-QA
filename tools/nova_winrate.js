// Винрейт и средний рейтинг за последние N матчей на playnova.ru/stats/show.
// Как запускать: найти игрока (капчу проходишь сам) → вкладка «Результаты матчей» →
// F12 → Console → вставить этот файл целиком → Enter.
// Скрипт только читает таблицу на странице и прокручивает её, к серверу сам не обращается.
(async () => {
  const LIMIT = 100;                 // сколько матчей считать
  const SKIP = [[1500, 1599]];       // диапазоны рейтинга, которые не считаем; [] — считать всё
  const PAUSE_MS = 700;              // пауза после прокрутки, чтобы подгрузились строки

  const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})/;
  const ROW_RE = /(Победа|Поражение)\s+(\d{3,5})\s+([+\-−]\s*\d+)?/;
  const rows = new Map();            // ключ — дата и время матча

  const skipped = r => SKIP.some(([a, b]) => r >= a && r <= b);
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // Строка таблицы — любой элемент, где ровно одна дата и есть результат матча.
  function collect() {
    let added = 0, sample = null;
    for (const el of document.querySelectorAll('tr, [role="row"], li, div')) {
      const t = el.innerText;
      if (!t || t.length > 300) continue;
      if ((t.match(/\d{2}\.\d{2}\.\d{4}/g) || []).length !== 1) continue;
      const d = t.match(DATE_RE), r = t.match(ROW_RE);
      if (!d || !r) continue;
      sample = sample || el;
      const key = d[0];
      if (rows.has(key)) continue;
      rows.set(key, {
        date: key,
        time: new Date(+d[3], d[2] - 1, +d[1], +d[4], +d[5]).getTime(),
        win: r[1] === 'Победа',
        rating: +r[2],
        change: r[3] ? r[3].replace(/\s/g, '').replace('−', '-') : '',
        noDuration: /\s—\s/.test(t),
      });
      added++;
    }
    return { added, sample };
  }

  function scroller(el) {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 5) return p;
    }
    return document.scrollingElement;
  }

  const counted = () => [...rows.values()].filter(x => !skipped(x.rating)).length;

  let { sample } = collect();
  if (!sample) { alert('Не нашёл таблицу матчей. Открой вкладку «Результаты матчей».'); return; }
  const box = scroller(sample);
  box.scrollTop = 0;
  await sleep(PAUSE_MS);

  for (let idle = 0; counted() < LIMIT && idle < 6; ) {
    const before = box.scrollTop;
    box.scrollTop += box.clientHeight * 0.8;
    await sleep(PAUSE_MS);
    const { added } = collect();
    idle = added === 0 && box.scrollTop === before ? idle + 1 : 0;
  }

  const all = [...rows.values()].sort((a, b) => b.time - a.time);
  const used = all.filter(x => !skipped(x.rating)).slice(0, LIMIT);
  if (!used.length) { alert('Подходящих матчей нет.'); return; }
  const lastUsed = used[used.length - 1].time;
  const dropped = all.filter(x => skipped(x.rating) && x.time >= lastUsed).length;

  const wins = used.filter(x => x.win).length;
  const avg = used.reduce((s, x) => s + x.rating, 0) / used.length;
  const name = (document.querySelector('input[type="text"]') || {}).value || '?';
  const summary =
    `${name}: ${used.length} матчей (${used[0].date} … ${used[used.length - 1].date})\n` +
    `Победы ${wins} / Поражения ${used.length - wins} — винрейт ${(100 * wins / used.length).toFixed(1)}%\n` +
    `Средний рейтинг ${avg.toFixed(0)}` +
    (SKIP.length ? `\nНе считали (рейтинг ${SKIP.map(s => s.join('–')).join(', ')}): ${dropped}` : '') +
    (used.length < LIMIT ? `\nВнимание: нашлось только ${used.length} подходящих матчей` : '');

  console.table(used.map(({ date, win, rating, change, noDuration }) =>
    ({ date, result: win ? 'Победа' : 'Поражение', rating, change, noDuration })));
  console.log(summary);
  alert(summary);
})();
