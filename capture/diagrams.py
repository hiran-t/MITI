# Draws MITI's concept diagrams as SVG, in the style of the architecture diagrams.
import html, sys
OUT = sys.argv[1]
BG, BOX, LINE, TEAL = '#191a1c', '#1e1f22', '#8c8f94', '#2fb4c4'
TEXT, SUB, LABEL, GROUP = '#e6e7e9', '#8c8f94', '#cfd1d4', '#4a4d52'
RED, GREEN, AMBER = '#e2766f', '#5bb98a', '#d6a243'
SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "Menlo, 'SF Mono', Consolas, monospace"

def esc(t): return html.escape(t, quote=True)
def text(x, y, t, size=22, color=LABEL, weight=400, anchor='start', mono=False, spacing=0):
    return (f'<text x="{x}" y="{y}" font-family="{MONO if mono else SANS}" font-size="{size}" '
            f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}" letter-spacing="{spacing}">{esc(t)}</text>')
def box(x, y, w, h, title, sub=None, accent=False, border=None, title_size=24, mono_title=False):
    c = border or (TEAL if accent else LINE)
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{BOX}" stroke="{c}" stroke-width="{2 if accent else 1.5}"/>'
    cy = y + h / 2 + (-6 if sub else 8)
    s += text(x + w / 2, cy, title, title_size, TEXT, 700, 'middle', mono=mono_title)
    if sub: s += text(x + w / 2, cy + 30, sub, 19, SUB, 400, 'middle')
    return s
def group(x, y, w, h, label, color=GROUP, label_color=SUB):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="none" stroke="{color}" '
            f'stroke-width="1.5" stroke-dasharray="8 7"/>' + text(x + 22, y + 34, label, 17, label_color, 600, spacing=1.5))
def arrow(x1, y1, x2, y2, color=TEAL, both=False, dashed=False, width=2.2):
    dash = ' stroke-dasharray="9 7"' if dashed else ''
    m = f'marker-end="url(#head-{color[1:]})"' + (f' marker-start="url(#tail-{color[1:]})"' if both else '')
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"{dash} {m}/>'
def path(d, color=TEAL, end=True, dashed=False):
    dash = ' stroke-dasharray="9 7"' if dashed else ''
    m = f' marker-end="url(#head-{color[1:]})"' if end else ''
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"{dash}{m}/>'
def tag(x, y, label, color=TEAL):
    w = len(label) * 10.5 + 26
    return (f'<rect x="{x}" y="{y}" width="{w}" height="30" rx="4" fill="{color}"/>' +
            text(x + w / 2, y + 21, label, 15, BG, 700, 'middle', spacing=1.2))
def svg(w, h, body):
    defs = ''.join(
        f'<marker id="head-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>'
        f'<marker id="tail-{c[1:]}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="{c}"/></marker>'
        for c in (TEAL, RED, GREEN, LINE))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<defs>{defs}</defs><rect width="{w}" height="{h}" fill="{BG}"/>{body}</svg>')

# ── 1. TF tree ──────────────────────────────────────────────────────────────────────────────
b = group(30, 40, 1600, 420, 'TF TREE  ·  /tf, /tf_static')
BW, BH = 230, 76
nodes = {'map': (70, 210), 'odom': (380, 210), 'base_link': (690, 210),
         'livox_frame': (1010, 120), 'camera_link': (1010, 300)}
for name, (x, y) in nodes.items():
    b += box(x, y, BW, BH, name, accent=name in ('map', 'base_link'), mono_title=True, title_size=23)
b += box(1310, 300, 290, BH, 'camera_color_', mono_title=True, title_size=21).replace(
    esc('camera_color_') + '</text>', esc('camera_color_') + '</text>' + text(1455, 362, 'optical_frame', 21, TEXT, 700, 'middle', mono=True))
b = b.replace(f'y="{300 + BH / 2 + 8}" font-family="{MONO}" font-size="21"', f'y="{300 + 32}" font-family="{MONO}" font-size="21"')
b += tag(70, 168, 'FIXED FRAME') + tag(690, 168, 'DISPLAY FRAME')
b += arrow(300, 248, 378, 248) + arrow(610, 248, 688, 248)
b += path('M920,248 L965,248 L965,158 L1008,158') + path('M965,248 L965,338 L1008,338') + arrow(1240, 338, 1308, 338)
for x, y, t in ((380 + BW / 2, 318, '/local_costmap/costmap'), (1010 + BW / 2, 228, '/livox/lidar'),
                (1455, 408, '/camera/camera/color/image_raw')):
    b += text(x, y, t, 17, SUB, 400, 'middle', mono=True)
b += text(70, 330, 'All data is placed here', 17, TEAL, 400) + text(690, 330, 'The view follows this frame', 17, TEAL, 400)
b += group(30, 500, 960, 230, 'ANOTHER TREE  ·  /fast_lio/tf, NOT IN TF TOPICS', RED, RED)
b += box(70, 580, BW, BH, 'camera_init', border=RED, mono_title=True, title_size=23)
b += box(380, 580, BW, BH, 'body', mono_title=True, title_size=23) + arrow(300, 618, 378, 618)
b += text(70 + BW / 2, 690, '/cloud_registered', 17, SUB, 400, 'middle', mono=True)
b += f'<rect x="1030" y="520" width="600" height="190" rx="10" fill="#2a1f1f" stroke="{RED}" stroke-width="1.5"/>'
b += text(1056, 566, 'No transform: camera_init → map', 22, RED, 700, mono=True)
b += text(1056, 610, 'No chain of transforms joins this frame', 19, LABEL)
b += text(1056, 638, 'to the fixed frame, so its data is not drawn.', 19, LABEL)
b += text(1056, 682, 'Fix: add /fast_lio/tf to TF topics.', 19, TEAL, 700)
open(f'{OUT}/tf-tree.svg', 'w').write(svg(1660, 760, b))

# ── 2. Stream modes ─────────────────────────────────────────────────────────────────────────
def lane(x, y, w, blocks, label=None):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="46" rx="8" fill="#141517" stroke="{GROUP}" stroke-width="1.2"/>'
    cx = x + 14
    for bw, color, t in blocks:
        s += f'<rect x="{cx}" y="{y + 9}" width="{bw}" height="28" rx="4" fill="{color}"/>'
        if t: s += text(cx + bw / 2, y + 29, t, 15, BG, 700, 'middle')
        cx += bw + 8
    if label: s += text(x, y - 12, label, 16, SUB, 400, mono=True)
    return s
IMG, CLOUD, MAP, SMALL = AMBER, '#b48ae0', '#7aa7d8', TEAL
small = lambda n: [(26, SMALL, '')] * n
b = group(30, 40, 1600, 330, 'SYNCHRONIZED (DEFAULT)  ·  ONE CONNECTION')
b += box(70, 130, 250, 110, 'miti_bridge') + box(1330, 130, 260, 110, 'Browser', 'MITI', accent=True)
b += lane(350, 162, 920, [(26, SMALL, ''), (300, IMG, 'image 2.8 MB'), (26, SMALL, ''), (26, SMALL, ''),
                         (160, CLOUD, 'point cloud'), (26, SMALL, ''), (220, IMG, 'image')] )
b += f'<line x1="320" y1="185" x2="350" y2="185" stroke="{TEAL}" stroke-width="2.2"/>' + arrow(1270, 185, 1328, 185)
b += text(350, 284, 'Messages arrive in order, so cameras, TF and the 3D Scene show the same moment.', 19, LABEL)
b += text(350, 314, 'On a slow link, a small message can still wait for the image being sent.', 19, SUB)
b += group(30, 410, 1600, 470, 'PRIORITIZE ROBOT MOTION  ·  HEAVY TOPICS ON THEIR OWN CONNECTIONS')
b += box(70, 560, 250, 110, 'miti_bridge') + box(1330, 560, 260, 110, 'Browser', 'MITI', accent=True)
b += lane(350, 498, 920, small(26), 'TF, joint states, odometry, log')
b += lane(350, 590, 920, [(300, IMG, 'image 2.8 MB'), (300, IMG, 'image')], '/camera/camera/color/image_raw')
b += lane(350, 682, 920, [(160, CLOUD, 'point cloud'), (160, CLOUD, 'point cloud'), (160, CLOUD, 'point cloud')], '/livox/lidar')
b += lane(350, 774, 920, [(120, MAP, 'map'), (120, MAP, 'map')], '/local_costmap/costmap')
for i, ly in enumerate((521, 613, 705, 797)):
    by = 580 + i * 24
    b += path(f'M320,{by} C335,{by} 335,{ly} 350,{ly}', end=False) + path(f'M1270,{ly} C1300,{ly} 1300,{by} 1328,{by}')
b += text(350, 852, 'The robot model and TF stay real-time; cameras may lag behind them.', 19, LABEL)
for xx, yy, c, t in ((70, 935, SMALL, 'small messages'), (300, 935, IMG, 'images'), (480, 935, CLOUD, 'point clouds'), (700, 935, MAP, 'maps and costmaps')):
    b += f'<rect x="{xx}" y="{yy - 18}" width="22" height="22" rx="4" fill="{c}"/>' + text(xx + 32, yy, t, 18, SUB)
open(f'{OUT}/stream-modes.svg', 'w').write(svg(1660, 970, b))

# ── 3. DDS over Wi-Fi ───────────────────────────────────────────────────────────────────────
def wifi(cx, cy, color=LINE):
    s = ''
    for r in (22, 40, 58):
        s += f'<path d="M{cx - r * 0.75},{cy - r * 0.55} A{r},{r} 0 0 1 {cx + r * 0.75},{cy - r * 0.55}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"/>'
    return s + f'<circle cx="{cx}" cy="{cy}" r="5" fill="{color}"/>'
def cross(cx, cy, r=16):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r + 6}" fill="{BG}" stroke="{RED}" stroke-width="2"/>'
            f'<path d="M{cx - r * 0.55},{cy - r * 0.55} L{cx + r * 0.55},{cy + r * 0.55} M{cx + r * 0.55},{cy - r * 0.55} L{cx - r * 0.55},{cy + r * 0.55}" stroke="{RED}" stroke-width="3" stroke-linecap="round"/>')
def scene(x, title, good):
    s = group(x, 40, 770, 560, title)
    s += box(x + 40, 400, 240, 100, 'Robot', 'ROS 2 nodes') + box(x + 490, 400, 240, 100, 'MITI machine', 'miti_bridge', accent=True)
    s += wifi(x + 385, 185) + text(x + 385, 228, 'Wi-Fi access point', 17, SUB, 400, 'middle')
    ax, ay = x + 385, 262
    if not good:
        s += path(f'M{x + 160},398 L{ax - 40},{ay + 8}', RED, dashed=True)
        s += path(f'M{ax + 40},{ay + 8} L{x + 610},398', RED, dashed=True)
        s += cross((ax + 40 + x + 610) / 2, (ay + 8 + 398) / 2)
        s += text(x + 385, 440, 'multicast discovery', 16, SUB, 400, 'middle', mono=True)
        s += text(x + 385, 470, 'dropped by Wi-Fi', 18, RED, 700, 'middle')
        s += text(x + 385, 560, 'Topics are missing, or come and go', 21, RED, 700, 'middle')
    else:
        s += arrow(ax - 40, ay + 8, x + 160, 398, TEAL, both=True)
        s += arrow(ax + 40, ay + 8, x + 610, 398, TEAL, both=True)
        s += text(x + 385, 440, "unicast to the robot's IP", 17, LABEL, 400, 'middle')
        s += text(x + 385, 470, '192.168.10.27', 17, TEAL, 400, 'middle', mono=True)
        s += text(x + 385, 560, 'The robot is found every time', 21, GREEN, 700, 'middle')
    return s
b = scene(30, 'MULTICAST ONLY', False) + scene(860, "WITH THE ROBOT'S IP ADDRESS", True)
b += text(830, 660, "Enter the robot's IP in MITI's ROS network settings, or set ROS_STATIC_PEERS=<robot-ip>.", 21, LABEL, 400, 'middle')
open(f'{OUT}/dds-wifi.svg', 'w').write(svg(1660, 700, b))
print('ok')
