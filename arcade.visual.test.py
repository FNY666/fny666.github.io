from pathlib import Path
import re

HTML = Path(__file__).with_name('arcade.html').read_text()
assert 'scene' in HTML, 'must have a scene shell'
assert 'id="starfield"' in HTML, 'must have realtime starfield canvas'
assert 'orbit-core' in HTML, 'must have a spatial orbit core'
assert 'core-sphere' in HTML, 'must have a holographic core object'
assert 'signal-console' in HTML, 'must have a signal lock console'
assert 'signal-grid' in HTML, 'must have signal grid catalog'
assert 'requestAnimationFrame' in HTML, 'must animate live visual layer'
assert 'pointermove' in HTML, 'visual layer must respond to pointer movement'
assert 'scanline' in HTML, 'must have scanline layer'
assert 'width:84%;transform:rotateX(59deg)' in HTML, 'mobile orbit core must fit the viewport'
assert '.core-stage{order:1' in HTML, 'mobile must show the interactive core before copy'
assert 'id="signals"' in HTML, 'must have signal catalog section'
links = re.findall(r'<a class="[^"]*cab[^"]*"[^>]+href="([^"]+)"', HTML)
assert len(links) >= 33, f'expected 33 native links, got {len(links)}'
assert len(re.findall(r'<a class="signal-card[^>]+', HTML)) == 29, 'catalog must contain 29 signal cards'
indices = [int(x) for x in re.findall(r'<span class="signal-id">SIG-(\d+)</span>', HTML)]
assert indices == list(range(1,30)), f'signal ids must be unique SIG-01..29, got {indices}'
for url in links:
    assert url.startswith(('https://fny666.github.io/', 'neon-survivors.html')), url
assert '霓虹幸存者' in HTML and '星港调查员' in HTML and '量子弹珠' in HTML
print(f'ARCADE-HOLO-STRUCTURE-OK native_links={len(links)} signals=29')
