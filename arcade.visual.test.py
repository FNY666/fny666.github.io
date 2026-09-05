from pathlib import Path
import re

HTML = Path(__file__).with_name('arcade.html').read_text()
assert 'scene' in HTML, 'must have a scene shell'
assert 'portal-stage' in HTML, 'must have a portal stage'
assert 'portal' in HTML, 'must have the signature portal'
assert 'hero-copy' in HTML, 'must have focused hero copy'
assert 'feature-strip' in HTML, 'must have a featured game strip'
assert 'catalog-grid' in HTML, 'must have a catalog grid'
assert 'telemetry' not in HTML and 'system-box' not in HTML, 'old dashboard clutter must be removed'
assert 'signal-console' not in HTML, 'old lock console must be removed'
assert len(re.findall(r'class="[^"]*primary[^"]*"', HTML)) == 1, 'hero must have one primary action'
assert 'id="starfield"' in HTML, 'must have realtime ambient canvas'
assert 'requestAnimationFrame' in HTML, 'must animate live visual layer'
assert 'pointermove' in HTML, 'visual layer must respond to pointer movement'
assert 'scanline' in HTML, 'must have restrained motion layer'
assert 'width:min(680px,94vw)' in HTML, 'portal must be viewport-safe'
assert 'portal-stage{min-height:390px' in HTML, 'mobile portal must leave room for the entry action'
assert 'portal-chip{display:none}' in HTML, 'mobile must not stack a second floating label'
assert '@media (max-width:720px)' in HTML, 'must define mobile composition'
assert 'overflow-x:clip' in HTML, 'mobile page must hard-clip decorative overflow'
assert 'overflow:clip' in HTML, 'decorative layers must be clipped'
assert 'id="signals"' in HTML, 'must have signal catalog section'
assert re.search(r'<a class="[^"]*primary[^"]*"[^>]+href=', HTML), 'primary action must be a native link'
links = re.findall(r'<a class="[^"]*cab[^"]*"[^>]+href="([^"]+)"', HTML)
assert len(links) >= 33, f'expected 33 native links, got {len(links)}'
assert len(re.findall(r'<a class="[^"]*catalog-card[^"]*"[^>]+', HTML)) == 29, 'catalog must contain 29 cards'
indices = [int(x) for x in re.findall(r'<span class="game-index">(\d+)</span>', HTML)]
assert indices == list(range(1, 30)), f'game ids must be unique 01..29, got {indices}'
for url in links:
    assert url.startswith(('https://fny666.github.io/', 'neon-survivors.html')), url
assert '霓虹幸存者' in HTML and '星港调查员' in HTML and '量子弹珠' in HTML
print(f'ARCADE-PORTAL-STRUCTURE-OK native_links={len(links)} games=29')
