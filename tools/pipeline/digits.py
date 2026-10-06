"""Trace the numbers on the card into pen-stroke digits (js/hand.js), in the card's own handwriting.

Run from this folder after prep.py (needs norm_warp.npy, i.e. the photo — which isn't in the repo):
    python3 digits.py
Each digit is cut from a clean spot on the card, skeletonised into its centre line and smoothed.
The '0' is drawn as a pen-style oval (the card's only 0 is squashed into a circle).
"""
import json, math, sys
import numpy as np
import networkx as nx
from scipy import ndimage as ndi
from scipy.interpolate import splprep, splev
from skimage.morphology import skeletonize, remove_small_holes
from skimage.measure import label as cc_label

a = np.load('norm_warp.npy')   # made by prep.py
S, UP = 3, 3
PX = S * UP            # pixels per card unit in the working image

# glyph: (x0, y0, x1, y1) card-unit box, optional (x, y) point inside the wanted component
SRC = {
    '1f': ((572, 86, 604, 132), None),        # the sun's "1" (with flag + foot)
    '1':  ((462, 552, 480, 590), None),       # plain "1" from the sky's "21"
    '2':  ((538, 516, 576, 554), (556, 535)),
    '3':  ((630, 586, 672, 630), None),
    '4':  ((346, 980, 378, 1014), (366, 997)),
    '5':  ((141, 604, 175, 644), (158, 624)),
    '6':  ((148, 297, 179, 331), None),
    '7':  ((368, 298, 396, 334), None),
    '8':  ((476, 747, 504, 789), None),
    '9':  ((384, 1118, 412, 1154), (400, 1132)),
    '2b': ((440, 552, 466, 590), None),       # the sky's "2" (from "21") — narrower, used inside bigger numbers
}

OPTS = {'9': dict(thr=0.6, sigma=0.8, hole=20)}
def component(box, pt, g=None):
    o = OPTS.get(g, {})
    x0, y0, x1, y1 = box
    crop = np.clip(a[y0 * S:y1 * S, x0 * S:x1 * S], 0, 1.2)
    up = ndi.zoom(crop, UP, order=3)
    up = ndi.gaussian_filter(up, o.get('sigma', 1.2))
    ink = up < o.get('thr', 0.72)
    lab = cc_label(ink, connectivity=2)
    best, bestScore = 0, -1e18
    H, W = lab.shape
    for k in range(1, lab.max() + 1):
        m = lab == k
        area = m.sum()
        if area < 40: continue
        ys, xs = np.nonzero(m)
        touches = ys.min() == 0 or xs.min() == 0 or ys.max() == H - 1 or xs.max() == W - 1
        if pt is not None:
            px, py = (pt[0] - x0) * PX, (pt[1] - y0) * PX
            dist = np.min(np.hypot(xs - px, ys - py))
            score = -dist - (1e6 if touches else 0)
        else:
            score = area - (1e9 if touches else 0)
        if score > bestScore: best, bestScore = k, score
    m = lab == best
    m = remove_small_holes(m, area_threshold=o.get('hole', int((1.3 * PX) ** 2)))
    return m

def graph_of(sk):
    pts = set(zip(*np.nonzero(sk)))
    G = nx.Graph()
    for p in pts:
        G.add_node(p)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (p[0] + dy, p[1] + dx)
                if (dy or dx) and q in pts: G.add_edge(p, q)
    for p, q in list(G.edges()):
        if p[0] != q[0] and p[1] != q[1]:
            for r in ((p[0], q[1]), (q[0], p[1])):
                if r in pts:
                    if G.has_edge(p, q): G.remove_edge(p, q)
                    break
    return G

def prune(G, spur):
    for _ in range(4):
        changed = False
        for e in [n for n in G if G.degree(n) == 1]:
            if e not in G or G.degree(e) != 1: continue
            path = [e]; prev, cur = None, e
            while True:
                nb = [n for n in G.neighbors(cur) if n != prev]
                if len(nb) != 1: break
                prev, cur = cur, nb[0]
                if G.degree(cur) != 2: break
                path.append(cur)
            if G.degree(cur) >= 3 and len(path) < spur:
                G.remove_nodes_from(path); changed = True
        if not changed: break
    G.remove_nodes_from([n for n in G if G.degree(n) == 0])
    return G

def edges_of(G):
    key = {n for n in G if G.degree(n) != 2}
    seen, out = set(), []
    for k in key:
        for nb in G.neighbors(k):
            if (k, nb) in seen: continue
            path = [k, nb]; seen.add((k, nb)); seen.add((nb, k))
            prev, cur = k, nb
            while cur not in key:
                nxt = [n for n in G.neighbors(cur) if n != prev][0]
                seen.add((cur, nxt)); seen.add((nxt, cur))
                path.append(nxt); prev, cur = cur, nxt
            out.append(path)
    for comp in nx.connected_components(G):
        if comp & key: continue
        start = next(iter(comp)); path = [start]; prev, cur = None, start
        while True:
            nxt = [n for n in G.neighbors(cur) if n != prev][0]
            if nxt == start: path.append(start); break
            path.append(nxt); prev, cur = cur, nxt
        out.append(path)
    return out, key

def chain(edges, key):
    """Join edges through junctions, pairing the straightest continuations."""
    def dirv(path, at_start):
        p = path if at_start else path[::-1]
        k = min(len(p) - 1, int(1.6 * PX))
        return np.array([p[k][1] - p[0][1], p[k][0] - p[0][0]], float)
    # cluster junctions that are very close (an X often skeletonises into two Y's)
    J = [k for k in key if True]
    ends = {}   # junction -> list of (edge index, at_start)
    for i, e in enumerate(edges):
        if e[0] == e[-1] and e[0] not in key: continue
        ends.setdefault(e[0], []).append((i, True))
        ends.setdefault(e[-1], []).append((i, False))
    # merge very short edges between two junctions
    pairs = {}
    for j, lst in ends.items():
        if len(lst) < 3: continue
        lst = list(lst)
        while len(lst) >= 2:
            best, bi = None, None
            for x in range(len(lst)):
                for y in range(x + 1, len(lst)):
                    (i1, s1), (i2, s2) = lst[x], lst[y]
                    if i1 == i2: continue
                    v1, v2 = dirv(edges[i1], s1), dirv(edges[i2], s2)
                    c = -np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
                    if best is None or c > best: best, bi = c, (x, y)
            if best is None or best < math.cos(math.radians(70)): break
            x, y = bi
            pairs[lst[x]] = lst[y]; pairs[lst[y]] = lst[x]
            lst = [l for t, l in enumerate(lst) if t not in (x, y)]
    used = set(); strokes = []
    for i in range(len(edges)):
        if i in used: continue
        # walk back to a free end
        cur, at_start = i, True
        guard = 0
        while (cur, at_start) in pairs and guard < 50:
            nxt = pairs[(cur, at_start)]
            if nxt[0] == i: break
            cur, at_start = nxt[0], not nxt[1]
            guard += 1
        # now traverse forward from (cur, at_start)
        pts = []; e, s = cur, at_start; guard = 0
        while guard < 50:
            used.add(e)
            seg = edges[e] if s else edges[e][::-1]
            pts.extend(seg if not pts else seg[1:])
            nxt = pairs.get((e, not s))
            if not nxt or nxt[0] in used: break
            e, s = nxt[0], nxt[1]; guard += 1
        strokes.append(pts)
    return strokes

def smooth(pts, box, closed):
    x0, y0 = box[0], box[1]
    xy = np.array([[p[1] / PX + x0, p[0] / PX + y0] for p in pts], float)
    if len(xy) < 4: return xy
    if closed and np.allclose(xy[0], xy[-1]): xy = xy[:-1]
    try:
        tck, u = splprep([xy[:, 0], xy[:, 1]], s=len(xy) * (0.22 / 1) ** 2 * 0.6, per=1 if closed else 0, k=3)
    except Exception as ex:
        return xy
    L = np.sum(np.hypot(*np.diff(xy, axis=0).T))
    n = max(4, int(L / 0.9) + 1)
    xs, ys = splev(np.linspace(0, 1, n), tck)
    out = np.stack([xs, ys], 1)
    if closed: out = np.vstack([out, out[:1]])
    return out

res = {}
for g, (box, pt) in SRC.items():   # trace each source digit
    m = component(box, pt, g)
    dt = ndi.distance_transform_edt(m)
    sk = skeletonize(m)
    width = 2 * dt[sk].mean() / PX
    G = prune(graph_of(sk), int(1.7 * PX))
    edges, key = edges_of(G)
    strokes = chain(edges, key)
    sm = []
    for s in strokes:
        closed = len(s) > 8 and abs(s[0][0] - s[-1][0]) + abs(s[0][1] - s[-1][1]) <= 2
        sm.append(smooth(s, box, closed))
    allp = np.vstack(sm)
    res[g] = dict(box=box, width=width, strokes=[s.round(2).tolist() for s in sm],
                  bbox=[float(allp[:, 0].min()), float(allp[:, 1].min()), float(allp[:, 0].max()), float(allp[:, 1].max())])
    print(g, 'width %.2f' % width, 'strokes', len(sm), [len(s) for s in sm], 'bbox h %.1f w %.1f' % (allp[:, 1].ptp() if hasattr(allp[:,1],'ptp') else np.ptp(allp[:, 1]), np.ptp(allp[:, 0])))

# ---- normalise the traced glyphs (height = 1) and write js/hand.js ----
# the 4's crossbar ran a long way past the upright; trim it to a short overhang (it has to fit inside a tree trunk)
r4 = res['4']
up = np.array(r4['strokes'][0]); h4 = r4['bbox'][3] - r4['bbox'][1]
vx = float(np.median(up[:, 0]))
bar = [p for p in r4['strokes'][1] if p[0] <= vx + 0.3 * h4]
r4['strokes'][1] = bar
G = {}
for g, r in res.items():
    pts = np.vstack([np.array(s) for s in r['strokes']])
    x0, y0, x1, y1 = pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()
    h = y1 - y0; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    G[g] = dict(w=round((x1 - x0) / h, 3))
    G[g]['s'] = [sum(([int(round((p[0] - cx) / h * 1000)), int(round((p[1] - cy) / h * 1000))] for p in s), []) for s in r['strokes']]

# "0": an oval in the same hand — tilted, drawn anticlockwise from the top, overlapping a touch where it closes
t = np.linspace(0, 2 * math.pi * 1.07, 46)
rx, ry, rot = 0.34, 0.5, math.radians(-9)
start = -math.pi / 2 + 0.25
xs, ys = [], []
for k, tt in enumerate(t):
    a = start - tt
    shrink = 1 - 0.07 * (k / (len(t) - 1)) ** 2
    ex, ey = rx * math.cos(a) * shrink, ry * math.sin(a) * shrink
    xs.append(ex * math.cos(rot) - ey * math.sin(rot)); ys.append(ex * math.sin(rot) + ey * math.cos(rot))
xs, ys = np.array(xs), np.array(ys)
h = ys.max() - ys.min(); cx, cy = (xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2
G['0'] = dict(w=round((xs.max() - xs.min()) / h, 3), s=[sum(([int(round((x - cx) / h * 1000)), int(round((y - cy) / h * 1000))] for x, y in zip(xs, ys)), [])])

order = ['0', '1', '1f', '2', '2b', '3', '4', '5', '6', '7', '8', '9']
lines = []
for g in order:
    lines.append("    '%s': { w: %s, s: [%s] }," % (g, G[g]['w'], ', '.join('[' + ','.join(map(str, s)) + ']' for s in G[g]['s'])))
js = """/* Jiayin's First Month At Work — the numbers on the picture, in the handwriting from the real card.
   Each digit was traced from the photo of the card as pen strokes (height = 1000 units, centred on 0,0).
   '1f' is the flagged 1 written in the sun; the plain '1' and the narrower '2b' are used inside bigger numbers. */
window.HAND = {
  glyphs: {
%s
  },
};
""" % '\n'.join(lines)
open('../../js/hand.js', 'w').write(js)
print(len(js), 'bytes')
for g in order: print(g, G[g]['w'], [len(s) // 2 for s in G[g]['s']])
