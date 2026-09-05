from html.parser import HTMLParser
from pathlib import Path

HTML = Path(__file__).with_name('arcade.html').read_text()

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags=[]
        self.ids=set()
        self.classes=[]
        self.urls=[]
        self.text=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        self.tags.append(tag)
        if attrs.get('id'): self.ids.add(attrs['id'])
        if attrs.get('class'): self.classes.extend(attrs['class'].split())
        if attrs.get('class') and 'cab' in attrs['class'].split() and attrs.get('href'):
            self.urls.append(attrs['href'])
    def handle_data(self, data):
        self.text.append(data)

p=Parser(); p.feed(HTML)
assert 'scene' in p.classes, 'must have a spatial scene shell'
assert 'featured' in p.ids, 'must have a featured hero section'
assert 'catalog' in p.ids, 'must have a browsable catalog'
assert 'data-category' in HTML, 'games must carry category metadata'
assert 'prefers-reduced-motion' in HTML, 'must respect reduced motion'
assert 'aria-label' in HTML, 'interactive controls need accessible labels'
assert len(__import__('re').findall(r'<a class="[^"]*cab[^"]*"[^>]+href="[^"]+"', HTML)) >= 33, 'game entrances must be native links'
assert len(p.urls) >= 26, f'expected all game entrances, got {len(p.urls)}'
indices = [int(x) for x in __import__('re').findall(r'<div class="card-index">(\d+)</div>', HTML)]
assert indices == list(range(1, 30)), f'catalog indices must be unique 01-29, got {indices}'
for url in p.urls:
    assert url.startswith(('https://fny666.github.io/', 'neon-survivors.html')), url
assert '霓虹跃迁' in HTML and '星港调查员' in HTML and '霓虹幸存者' in HTML
print(f'ARCADE-VISUAL-STRUCTURE-OK entrances={len(p.urls)}')
