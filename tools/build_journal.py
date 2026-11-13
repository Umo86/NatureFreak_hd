#!/usr/bin/env python3
"""Build long-form journal guides from content/journal/*.md.

Each Markdown file starts with a YAML front matter block (see any file in
content/journal for the fields). The page shell (header, nav, newsletter CTA
and footer) is taken from an existing journal page so the guides match the
rest of the site.

Body shortcodes, each on a line of its own:
  {{figure: <unsplash photo id> | <unsplash username> | <alt text> | <caption>}}
  {{video: <youtube id> | <title> | <channel>}}

Run:  python3 tools/build_journal.py
It writes journal/<slug>.html, refreshes the guide cards in blog.html,
and regenerates sitemap.xml and robots.txt.
"""
import datetime as dt
import glob
import html
import json
import math
import os
import re

import markdown
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get("NF_SITE_URL", "https://naturefreakhd.vercel.app").rstrip("/")
SHELL_SOURCE = os.path.join(ROOT, "journal", "sharper-wildlife-photos.html")
BRAND = "NATUREFreak"

TOPIC_LABEL = {"photography": "Photography", "wildlife": "Wildlife", "places": "Places", "oceans": "Oceans"}

UTM = "utm_source=naturefreak&utm_medium=referral"


def esc(s):
    return html.escape(str(s), quote=True)


def unsplash(pid, w, h=None):
    q = f"https://images.unsplash.com/photo-{pid}?auto=format&fit=crop&q=75&w={w}"
    if h:
        q += f"&h={h}"
    return q


def credit(user):
    return (f'Photo: <a href="https://unsplash.com/@{esc(user)}?{UTM}" rel="noopener" target="_blank">@{esc(user)}</a>'
            f' on <a href="https://unsplash.com/?{UTM}" rel="noopener" target="_blank">Unsplash</a>')


def figure_html(pid, user, alt, caption, eager=False):
    srcset = ", ".join(f"{unsplash(pid, w)} {w}w" for w in (640, 960, 1280, 1600))
    loading = 'fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    cap = f"{esc(caption)} " if caption else ""
    return (f'<figure class="nfp-fig"><img src="{unsplash(pid, 1280)}" srcset="{srcset}" '
            f'sizes="(max-width: 820px) 100vw, 760px" alt="{esc(alt)}" width="1280" height="853" {loading}>'
            f'<figcaption>{cap}<span class="nfp-credit">{credit(user)}</span></figcaption></figure>')


def video_html(vid, title, channel):
    return (f'<figure class="nfp-video"><div class="nfp-yt" data-yt="{esc(vid)}">'
            f'<img src="https://i.ytimg.com/vi/{esc(vid)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">'
            f'<button type="button" aria-label="Play video: {esc(title)}"><svg viewBox="0 0 68 48" width="68" height="48" aria-hidden="true">'
            f'<path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.3.3 34 .3 34 .3s-21.3 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 12.9.1 24 .1 24s0 11.1 1.4 16.3a8.5 8.5 0 0 0 6 6C12.7 47.7 34 47.7 34 47.7s21.3 0 26.5-1.4a8.5 8.5 0 0 0 6-6c1.4-5.2 1.4-16.3 1.4-16.3s0-11.1-1.4-16.3z" fill="#0B0B0C" fill-opacity=".85"/>'
            f'<path d="M45 24 27 14v20z" fill="#F3EEE4"/></svg></button></div>'
            f'<figcaption>Video: <a href="https://www.youtube.com/watch?v={esc(vid)}" rel="noopener" target="_blank">{esc(title)}</a> — {esc(channel)} on YouTube</figcaption></figure>')


SHORTCODE = re.compile(r"^\{\{(figure|video):(.+?)\}\}\s*$", re.M)


def expand_shortcodes(body, placeholders):
    def repl(m):
        kind, args = m.group(1), [a.strip() for a in m.group(2).split("|")]
        if kind == "figure":
            pid, user, alt = args[0], args[1], args[2]
            cap = args[3] if len(args) > 3 else ""
            out = figure_html(pid, user, alt, cap)
        else:
            out = video_html(*args[:3])
        key = f"NFPLACEHOLDER{len(placeholders)}X"
        placeholders[key] = out
        return f"\n{key}\n"
    return SHORTCODE.sub(repl, body)


def slugify(text):
    s = re.sub(r"<[^>]+>", "", text).lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    return re.sub(r"[\s-]+", "-", s).strip("-")


def render_body(md_text):
    placeholders = {}
    pre = expand_shortcodes(md_text, placeholders)
    out = markdown.markdown(pre, extensions=["tables", "attr_list", "sane_lists"])
    for k, v in placeholders.items():
        out = out.replace(f"<p>{k}</p>", v).replace(k, v)
    toc = []

    def add_id(m):
        level, attrs, inner = m.group(1), m.group(2) or "", m.group(3)
        hid = slugify(inner)
        if level == "2":
            toc.append((hid, re.sub(r"<[^>]+>", "", inner)))
        return f'<h{level} id="{hid}"{attrs}>{inner}</h{level}>'
    out = re.sub(r"<h([23])(\s[^>]*)?>(.*?)</h\1>", add_id, out)
    # external links open in a new tab and are marked
    def ext(m):
        tag = m.group(0)
        if 'href="http' in tag and SITE not in tag and "target=" not in tag:
            tag = tag[:-1] + ' rel="noopener" target="_blank">'
        return tag
    out = re.sub(r"<a\s[^>]*>", ext, out)
    # wrap tables so they scroll on phones
    out = out.replace("<table>", '<div class="nfp-table"><table>').replace("</table>", "</table></div>")
    words = len(re.sub(r"<[^>]+>", " ", out).split())
    return out, toc, words


CSS = """
.nfp-wrap{max-width:760px;margin:0 auto;padding:56px 24px 72px;font-family:'Jost','Helvetica Neue',Arial,sans-serif;color:#0B0B0C}
.nfp-wrap p,.nfp-wrap li{font-size:19px;line-height:1.72}
.nfp-wrap p{margin:0 0 22px}
.nfp-wrap h2{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:clamp(28px,3.4vw,36px);line-height:1.15;margin:56px 0 18px;scroll-margin-top:24px}
.nfp-wrap h3{font-family:'Jost','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:22px;line-height:1.3;margin:36px 0 12px;scroll-margin-top:24px}
.nfp-wrap ul,.nfp-wrap ol{margin:0 0 24px;padding-left:24px}
.nfp-wrap li{margin:0 0 10px}
.nfp-wrap a{color:#0E6B62;text-underline-offset:3px}
.nfp-wrap strong{font-weight:500}
.nfp-wrap blockquote{margin:32px 0;padding:20px 24px;background:#F3EEE4;border-left:3px solid #0E6B62}
.nfp-wrap blockquote p{margin:0 0 10px;font-size:18px}.nfp-wrap blockquote p:last-child{margin:0}
.nfp-fig,.nfp-video{margin:36px 0}
.nfp-fig img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:2px;background:#E7E0D2}
.nfp-fig figcaption,.nfp-video figcaption{padding-top:10px;font-size:14px;line-height:1.5;color:#4A4741}
.nfp-fig figcaption a,.nfp-video figcaption a{color:#4A4741}
.nfp-credit{white-space:nowrap}
.nfp-yt{position:relative;aspect-ratio:16/9;background:#0B0B0C;border-radius:2px;overflow:hidden}
.nfp-yt img{width:100%;height:100%;object-fit:cover;opacity:.9}
.nfp-yt button{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;cursor:pointer}
.nfp-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.nfp-table{overflow-x:auto;margin:0 0 28px}
.nfp-wrap table{border-collapse:collapse;width:100%;font-size:16px;line-height:1.5}
.nfp-wrap th,.nfp-wrap td{text-align:left;padding:10px 12px;border-bottom:1px solid rgba(11,11,12,.15);vertical-align:top}
.nfp-wrap th{background:#F3EEE4;font-weight:500}
.nfp-toc{margin:0 0 40px;padding:20px 24px;border:1px solid rgba(11,11,12,.2);border-radius:2px}
.nfp-toc h2{font-family:'Jost','Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:#0E6B62;margin:0 0 12px}
.nfp-toc ol{margin:0;padding-left:20px}.nfp-toc li{font-size:16px;line-height:1.5;margin:0 0 6px}
.nfp-meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-family:'Jost','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#4A4741}
.nfp-crumbs{font-family:'Jost','Helvetica Neue',Arial,sans-serif;font-size:13px;color:#4A4741}
.nfp-crumbs a{color:#4A4741}
.nfp-faq details{border-bottom:1px solid rgba(11,11,12,.15);padding:14px 0}
.nfp-faq summary{cursor:pointer;font-size:19px;font-weight:500;line-height:1.4}
.nfp-faq details p{margin:12px 0 0}
.nfp-sources li{font-size:16px}
.nfp-key{margin:0 0 36px;padding:22px 24px;background:#0B0B0C;color:#F3EEE4;border-radius:2px}
.nfp-key h2{font-family:'Jost','Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:.3em;text-transform:uppercase;color:#2DB7A8;margin:0 0 12px}
.nfp-key ul{margin:0;padding-left:20px}.nfp-key li{font-size:17px;line-height:1.55;margin:0 0 8px}
@media (max-width:600px){.nfp-wrap p,.nfp-wrap li{font-size:18px}}
"""

YT_JS = """<script>document.addEventListener('click',function(e){var b=e.target.closest('.nfp-yt button');if(!b)return;var w=b.parentNode,id=w.getAttribute('data-yt');var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0';f.title=b.getAttribute('aria-label');f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';f.allowFullscreen=true;w.innerHTML='';w.appendChild(f);});</script>"""

F = "font-family: 'Jost', 'Helvetica Neue', Arial, sans-serif"
P = "font-family: 'Playfair Display', Georgia, serif"


def card(href, img_html, topic, title, summary):
    return (f'<a href="{href}" style="display: flex; flex-direction: column; gap: 12px; text-decoration: none">{img_html}'
            f'<span style="{F}; font-weight: 500; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: #0E6B62">{esc(topic)}</span>'
            f'<span style="{P}; font-weight: 600; font-size: 24px; line-height: 1.2; color: #0B0B0C">{esc(title)}</span>'
            f'<span style="{F}; font-size: 16px; line-height: 1.5; color: #4A4741">{esc(summary)}</span></a>')


def load_guides():
    guides = []
    for path in sorted(glob.glob(os.path.join(ROOT, "content", "journal", "*.md"))):
        raw = open(path, encoding="utf-8").read()
        _, fm, body = raw.split("---", 2)
        meta = yaml.safe_load(fm)
        meta["body_md"] = body.strip()
        guides.append(meta)
    return guides


def page(meta, by_slug, shell_head, shell_top, shell_bottom):
    body_html, toc, words = render_body(meta["body_md"])
    minutes = max(1, math.ceil(words / 230))
    url = f"{SITE}/journal/{meta['slug']}.html"
    hero = meta["hero"]
    topic = TOPIC_LABEL.get(meta.get("topic", "photography"), "Photography")
    published = str(meta["published"])
    updated = str(meta.get("updated", published))
    nice_date = dt.date.fromisoformat(updated).strftime("%-d %B %Y")
    og_image = unsplash(hero["id"], 1200, 630)

    # JSON-LD
    ld = [{
        "@context": "https://schema.org", "@type": "Article",
        "headline": meta["title"], "description": meta["description"],
        "image": [unsplash(hero["id"], 1600), og_image],
        "datePublished": published, "dateModified": updated,
        "author": {"@type": "Organization", "name": BRAND, "url": SITE + "/about.html"},
        "publisher": {"@type": "Organization", "name": BRAND, "url": SITE + "/"},
        "mainEntityOfPage": url, "keywords": ", ".join([meta["keyword"]] + meta.get("secondary", [])),
        "articleSection": topic, "wordCount": words, "inLanguage": "en-GB",
    }, {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Journal", "item": SITE + "/blog.html"},
            {"@type": "ListItem", "position": 3, "name": topic, "item": f"{SITE}/blog.html?topic={meta.get('topic','photography')}"},
            {"@type": "ListItem", "position": 4, "name": meta["title"], "item": url},
        ]}]
    if meta.get("faq"):
        ld.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", markdown.markdown(f["a"]))}}
            for f in meta["faq"]]})
    ld_html = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)

    head = shell_head
    head = re.sub(r"<title>.*?</title>", f"<title>{esc(meta['seo_title'])}</title>", head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', "", head)
    extra = (f'<meta name="description" content="{esc(meta["description"])}">'
             f'<link rel="canonical" href="{url}">'
             f'<meta name="robots" content="index, follow, max-image-preview:large">'
             f'<meta property="og:type" content="article"><meta property="og:site_name" content="{BRAND}">'
             f'<meta property="og:title" content="{esc(meta["title"])}"><meta property="og:description" content="{esc(meta["description"])}">'
             f'<meta property="og:url" content="{url}"><meta property="og:image" content="{esc(og_image)}">'
             f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
             f'<meta property="article:published_time" content="{published}"><meta property="article:modified_time" content="{updated}">'
             f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(meta["title"])}">'
             f'<meta name="twitter:description" content="{esc(meta["description"])}"><meta name="twitter:image" content="{esc(og_image)}">'
             f'<link rel="preconnect" href="https://images.unsplash.com">'
             f'<style>{CSS}</style>{ld_html}')
    head = head.replace("</head>", extra + "\n</head>")

    crumbs = (f'<nav class="nfp-crumbs" aria-label="Breadcrumb"><a href="/index.html">Home</a> / <a href="/blog.html">Journal</a> / '
              f'<a href="/blog.html?topic={meta.get("topic","photography")}">{topic}</a></nav>')
    intro = (f'<section style="background: #F3EEE4"><div style="max-width: 900px; margin: 0 auto; padding: 40px 24px 36px">'
             f'<div style="display: flex; flex-direction: column; gap: 18px">{crumbs}'
             f'<h1 style="margin: 0; {P}; font-weight: 600; font-size: clamp(36px, 5vw, 62px); line-height: 1.06; color: #0B0B0C">{esc(meta["title"])}</h1>'
             f'<div style="width: 80px; height: 2px; background: #0E6B62"></div>'
             f'<p style="margin: 0; {P}; font-style: italic; font-size: clamp(20px, 2.4vw, 25px); line-height: 1.4; color: #0B0B0C">{esc(meta["dek"])}</p>'
             f'<div class="nfp-meta"><span>By the {BRAND} team</span><span>Updated <time datetime="{updated}">{nice_date}</time></span><span>{minutes} min read</span></div>'
             f'</div></div></section>')
    hero_html = (f'<section style="background: #F3EEE4"><div style="max-width: 1240px; margin: 0 auto; padding: 0 24px 48px">'
                 f'<figure style="margin: 0"><img src="{unsplash(hero["id"], 1600)}" srcset="{", ".join(f"{unsplash(hero["id"], w)} {w}w" for w in (800, 1200, 1600, 2000))}" sizes="100vw" '
                 f'alt="{esc(hero["alt"])}" width="1600" height="900" fetchpriority="high" style="display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 2px; background: #E7E0D2">'
                 f'<figcaption style="padding-top: 10px; {F}; font-size: 14px; color: #4A4741">{esc(hero.get("caption",""))} {credit(hero["user"])}</figcaption></figure></div></section>')

    key = ""
    if meta.get("key_points"):
        key = '<aside class="nfp-key" aria-label="Key points"><h2>The short version</h2><ul>' + "".join(
            f"<li>{markdown.markdown(k)[3:-4]}</li>" for k in meta["key_points"]) + "</ul></aside>"
    toc_html = ""
    if len(toc) >= 3:
        toc_html = '<nav class="nfp-toc" aria-label="In this guide"><h2>In this guide</h2><ol>' + "".join(
            f'<li><a href="#{i}">{esc(t)}</a></li>' for i, t in toc) + "</ol></nav>"
    faq_html = ""
    if meta.get("faq"):
        faq_html = '<h2 id="faq">Questions people ask</h2><div class="nfp-faq">' + "".join(
            f"<details><summary>{esc(f['q'])}</summary>{markdown.markdown(f['a'])}</details>" for f in meta["faq"]) + "</div>"
    src_html = ""
    if meta.get("sources"):
        src_html = '<h2 id="sources">Sources and further reading</h2><ul class="nfp-sources">' + "".join(
            f'<li><a href="{esc(s["url"])}" rel="noopener" target="_blank">{esc(s["title"])}</a>{(" — " + esc(s["note"])) if s.get("note") else ""}</li>'
            for s in meta["sources"]) + "</ul>"
    join_html = ('<blockquote><p><strong>Shoot nature yourself?</strong> List your work in the free '
                 '<a href="/directory.html">NATUREFreak photographer directory</a>, or '
                 '<a href="/get-featured.html">get a photo featured</a> on our feed, credited to you.</p></blockquote>')

    article = (f'<article>{intro}{hero_html}<section style="background: #FFFFFF"><div class="nfp-wrap">'
               f'{key}{toc_html}{body_html}{faq_html}{join_html}{src_html}</div></section></article>')
    total_words = len(re.sub(r"<[^>]+>", " ", article).split())
    if total_words != words:
        head = head.replace(f'"wordCount": {words}', f'"wordCount": {total_words}')
        words = total_words

    rel_cards = []
    for s in meta.get("related", [])[:3]:
        r = by_slug.get(s)
        if not r:
            continue
        img = (f'<img src="{unsplash(r["hero"]["id"], 720, 480)}" alt="" loading="lazy" decoding="async" width="720" height="480" '
               f'style="width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 2px; background: #E7E0D2">')
        rel_cards.append(card(f"/journal/{r['slug']}.html", img, TOPIC_LABEL.get(r.get("topic"), "Photography"), r["title"], r["description"]))
    more = (f'<section style="background: #F3EEE4"><div style="max-width: 1240px; margin: 0 auto; padding: 72px 24px">'
            f'<div style="display: flex; flex-direction: column; gap: 28px"><div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #0B0B0C">'
            f'<h2 style="margin: 0; {P}; font-weight: 600; font-size: 40px; line-height: 1.05; color: #0B0B0C">Keep reading</h2>'
            f'<a href="/blog.html?topic=photography" style="{F}; font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase; color: #0E6B62; padding: 12px 0">All photography guides</a></div>'
            f'<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 40px 32px">{"".join(rel_cards)}</div></div></div></section>')

    return head + shell_top + article + more + shell_bottom.replace("</body>", YT_JS + "\n</body>"), words


def split_shell():
    s = open(SHELL_SOURCE, encoding="utf-8").read()
    head_end = s.index("</head>") + len("</head>")
    shell_head = s[:head_end]
    top = s[head_end:s.index("<article>")]
    bottom = s[s.index('<section data-dark="1"'):]
    return shell_head, top, bottom


def update_blog(guides):
    path = os.path.join(ROOT, "blog.html")
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"<!--guides-->.*?<!--/guides-->", "", s, flags=re.S)
    cards = []
    for g in sorted(guides, key=lambda g: (str(g["published"]), g.get("order", 0)), reverse=True):
        img = (f'<img src="{unsplash(g["hero"]["id"], 720, 480)}" alt="" loading="lazy" width="720" height="480" '
               f'style="width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 2px">')
        c = card(f"/journal/{g['slug']}.html", img, TOPIC_LABEL.get(g.get("topic"), "Photography"), g["title"], g["description"])
        c = c.replace("<a href=", f'<a data-topic="{g.get("topic","photography")}" href=', 1)
        cards.append(c)
    marker = '<div id="bgrid"'
    i = s.index(marker)
    j = s.index(">", i) + 1
    s = s[:j] + "<!--guides-->" + "".join(cards) + "<!--/guides-->" + s[j:]
    total = len(re.findall(r'data-topic="', s[j:s.index("</div>", s.index("<!--/guides-->"))]))
    s = re.sub(r'(<p id="bcount"[^>]*>)\d+ stories', lambda m: f"{m.group(1)}{total} stories", s)
    open(path, "w", encoding="utf-8").write(s)


def write_sitemap(guides):
    today = dt.date.today().isoformat()
    urls = []
    for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        name = os.path.basename(f)
        if name in ("404.html", "profile.html"):
            continue
        loc = SITE + "/" if name == "index.html" else f"{SITE}/{name}"
        urls.append((loc, today))
    gmap = {g["slug"]: str(g.get("updated", g["published"])) for g in guides}
    for f in sorted(glob.glob(os.path.join(ROOT, "journal", "*.html"))):
        slug = os.path.basename(f)[:-5]
        urls.append((f"{SITE}/journal/{slug}.html", gmap.get(slug, today)))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>" for u, d in urls]
    xml.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(xml) + "\n")
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n")


def main():
    guides = load_guides()
    by_slug = {g["slug"]: g for g in guides}
    head, top, bottom = split_shell()
    for g in guides:
        out, words = page(g, by_slug, head, top, bottom)
        open(os.path.join(ROOT, "journal", f"{g['slug']}.html"), "w", encoding="utf-8").write(out)
        print(f"{g['slug']}: {words} words")
    update_blog(guides)
    write_sitemap(guides)


if __name__ == "__main__":
    main()
