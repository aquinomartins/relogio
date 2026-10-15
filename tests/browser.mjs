// Optional browser validation; no browser tooling is needed to run the site.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CLOCK_URL || 'http://127.0.0.1:8000/';
const artifacts = process.env.ARTIFACTS_DIR || '/tmp/relogio-checks';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true, args: ['--no-sandbox'],
});
const errors = [];
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}
async function readAngles(page) {
  return page.evaluate(() => Object.fromEntries(['hour', 'minute', 'second'].map(name => [name,
    +document.querySelector(`#${name}-hand`).getAttribute('transform').match(/rotate\(([^ ]+)/)[1],
  ])));
}
function near(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  async function changeMotion(value) {
    // Wait for the native media event before advancing the synthetic clock.
    await page.evaluate(() => {
      window.mediaChanged = new Promise(resolve => {
        matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => resolve(), { once: true });
      });
    });
    await page.emulateMedia({ reducedMotion: value });
    await page.evaluate(() => window.mediaChanged);
  }
  await page.goto(`${base}?reference=09:30:08`);
  await page.waitForSelector('#second-hand');

  await check('12 índices, 48 traços, 12 horas e escala externa com orientação correta', async () => {
    assert.equal(await page.locator('.major-index').count(), 12);
    assert.equal(await page.locator('.minor-tick').count(), 48);
    assert.equal(await page.locator('.hour-number').count(), 12);
    const numbers = await page.locator('.outer-number').evaluateAll(nodes => nodes.map(node => [
      node.dataset.value, +node.getAttribute('transform').match(/rotate\(([^)]+)/)[1],
    ]));
    assert.deepEqual(numbers, ['60','05','10','15','20','25','30','35','40','45','50','55']
      .map((value, i) => [value, [0,30,60,90,-60,-30,0,30,60,-90,-60,-30][i]]));
  });

  await check('referências 12:00, 03:15, 09:30 e milissegundos ficam pausadas', async () => {
    for (const [time, expected] of [
      ['12:00:00', [0, 0, 0]], ['03:15:00', [97.5, 90, 0]],
      ['09:30:00', [285, 180, 0]], ['09:30:08.125', [285.0677083333333, 180.8125, 48.75]],
    ]) {
      await page.goto(`${base}?reference=${time}`);
      const angles = await readAngles(page);
      ['hour', 'minute', 'second'].forEach((name, i) => near(angles[name], expected[i]));
      await page.waitForTimeout(80);
      assert.deepEqual(await readAngles(page), angles);
    }
  });

  await check('textos externos cabem em desktop, celular e paisagem; mostrador permanece circular', async () => {
    for (const [width, height, name] of [[1440,1000,'desktop'],[320,568,'mobile'],[844,390,'landscape']]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}?reference=09:30:08`);
      const layout = await page.evaluate(() => {
        const svg = document.querySelector('#clock');
        const matrix = svg.getScreenCTM();
        return {
          scaleX: matrix.a, scaleY: matrix.d,
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          clipped: [...document.querySelectorAll('.outer-number')].some(node => {
            const b = node.getBBox(), m = node.getScreenCTM();
            return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].some(([x,y]) => {
              const p = new DOMPoint(x,y).matrixTransform(m);
              return p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight;
            });
          }),
        };
      });
      near(layout.scaleX, layout.scaleY);
      assert.equal(layout.overflow, false);
      assert.equal(layout.clipped, false);
      await page.screenshot({ path: join(artifacts, `${name}.png`) });
    }
  });

  await check('sombras rasterizadas mantêm a direção da página em quatro posições', async () => {
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.goto(`${base}?reference=12:00:00`);
    const shifts = await page.evaluate(async () => {
      const style = await (await fetch('styles.css')).text();
      const results = [];
      for (const angle of [0, 90, 180, 270]) {
        const clone = document.querySelector('#clock').cloneNode(true);
        const defs = clone.querySelector('defs');
        const hand = clone.querySelector('#hour-shadow');
        hand.querySelector('#hour-hand').setAttribute('transform', `rotate(${angle} 500 500)`);
        clone.replaceChildren(defs, hand);
        const css = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        css.textContent = style;
        clone.prepend(css);
        clone.setAttribute('width', 1000);
        clone.setAttribute('height', 1000);
        clone.setAttribute('style', 'width:1000px;height:1000px;max-width:none;max-height:none');
        async function raster() {
          const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1000;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0);
          URL.revokeObjectURL(url);
          return ctx.getImageData(0, 0, 1000, 1000).data;
        }
        const shadowed = await raster();
        hand.removeAttribute('filter');
        const plain = await raster();
        // Compare opposite sides of the straight shaft, away from the asymmetric
        // tip/hub. The centroid of the visible shadow is biased by occlusion.
        const radians = angle * Math.PI / 180;
        const px = 500 + Math.sin(radians) * 130;
        const py = 500 - Math.cos(radians) * 130;
        const axisX = angle % 180 === 0 ? 1 : 0;
        const axisY = 1 - axisX;
        function sample(sign) {
          const x = Math.round(px + sign * axisX * 13);
          const y = Math.round(py + sign * axisY * 13);
          let alpha = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const i = ((y + dy) * 1000 + x + dx) * 4 + 3;
            alpha += Math.max(0, shadowed[i] - plain[i]);
          }
          return alpha / 9;
        }
        results.push({ angle, axis: axisX ? 'right' : 'down', positive: sample(1), negative: sample(-1) });
      }
      return results;
    });
    for (const shift of shifts) {
      assert.ok(shift.positive > shift.negative + 3, JSON.stringify(shift));
    }
    console.log('  Alfa da sombra nos dois lados da haste:', shifts);
  });

  await check('hora local, movimento contínuo, virada de minuto e texto acessível', async () => {
    // Freeze the browser clock to test the same instants deterministically.
    await page.clock.install({ time: new Date('2026-10-15T12:30:59.900Z') });
    await page.clock.pauseAt(new Date('2026-10-15T12:30:59.900Z'));
    await page.goto(base);
    let angles = await readAngles(page);
    near(angles.second, 359.4);
    assert.equal(await page.locator('#clock').getAttribute('data-mode'), 'local');
    await page.clock.runFor(80);
    const partial = await readAngles(page);
    assert.ok(partial.second > angles.second && partial.second < 360);
    await page.clock.runFor(64);
    angles = await readAngles(page);
    assert.ok(angles.second < 1 && angles.minute > 186);
    assert.match(await page.locator('#clock-time').textContent(), /Horário local: 09:31:00/);
    assert.equal(await page.locator('#clock-time').getAttribute('aria-live'), 'off');
    assert.equal(await page.locator('#clock').getAttribute('aria-hidden'), 'true');
  });

  await check('aba oculta suspende atualizações e retorna diretamente à hora atual', async () => {
    const before = await readAngles(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(61000);
    assert.deepEqual(await readAngles(page), before);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const now = await page.evaluate(() => ({ s: new Date().getSeconds(), ms: new Date().getMilliseconds() }));
    near((await readAngles(page)).second, (now.s + now.ms / 1000) * 6);
  });

  await check('movimento reduzido atualiza uma vez por segundo e permite alternar a preferência', async () => {
    await changeMotion('reduce');
    await page.clock.runFor(32);
    const initial = await readAngles(page);
    near(initial.second % 6, 0);
    await page.clock.runFor(100);
    assert.deepEqual(await readAngles(page), initial);
    await page.clock.runFor(1000);
    near(((await readAngles(page)).second - initial.second + 360) % 360, 6);
    await changeMotion('no-preference');
    await page.clock.runFor(32);
    assert.notEqual((await readAngles(page)).second % 6, 0);
    await changeMotion('reduce');
    await page.clock.runFor(32);
    await page.screenshot({ path: join(artifacts, 'reduced-motion.png') });
  });

  await check('referência inválida usa horário real e referência vazia usa 09:30:08', async () => {
    await page.goto(`${base}?reference=24:00:00`);
    assert.equal(await page.locator('#clock').getAttribute('data-mode'), 'local');
    await page.goto(`${base}?reference`);
    near((await readAngles(page)).second, 48);
  });

  await check('nenhum erro de JavaScript durante a navegação', async () => assert.deepEqual(errors, []));
  console.log(`${passed} verificações concluídas. Capturas em ${artifacts}`);
} finally {
  await browser.close();
}
