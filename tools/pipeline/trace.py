"""Step 2: skeletonise the clean ink mask and turn it into smoothed polylines.
Output: paths_raw.json  -> list of {id, closed, pts:[[x,y],...]} in card units (760 x 1248)."""
import numpy as np, cv2, json, random
import networkx as nx
from skimage.morphology import skeletonize
from scipy.ndimage import gaussian_filter1d

S = 3
OW, OH = 760, 1248
m = np.load('ink_clean.npy').astype(bool)
sk = skeletonize(m)


def build_graph(sk):
    ys, xs = np.nonzero(sk)
    pix = set(zip(ys.tolist(), xs.tolist()))
    G = nx.Graph()
    G.add_nodes_from(pix)
    for (y, x) in pix:
        for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
            q = (y + dy, x + dx)
            if q in pix:
                if dy and dx and ((y + dy, x) in pix or (y, x + dx) in pix):
                    continue  # redundant diagonal (a 4-path exists)
                G.add_edge((y, x), q)
    return G


def chains(G):
    key = {n for n in G.nodes if G.degree(n) != 2}
    seen = set()
    paths = []
    for k in key:
        for nb in G.neighbors(k):
            e = frozenset((k, nb))
            if e in seen:
                continue
            seen.add(e)
            path = [k, nb]
            prev, cur = k, nb
            while cur not in key:
                nxt = [n for n in G.neighbors(cur) if n != prev][0]
                seen.add(frozenset((cur, nxt)))
                path.append(nxt)
                prev, cur = cur, nxt
            paths.append(path)
    for comp in nx.connected_components(G):
        if all(G.degree(n) == 2 for n in comp):
            start = min(comp)
            path = [start]
            prev, cur = None, start
            while True:
                nxt = [n for n in G.neighbors(cur) if n != prev][0]
                if nxt == start:
                    path.append(start)
                    break
                path.append(nxt)
                prev, cur = cur, nxt
            paths.append(path)
    return paths


def plen(p):
    a = np.array(p, float)
    return float(np.sum(np.hypot(*np.diff(a, axis=0).T))) / S if len(p) > 1 else 0.0


G = build_graph(sk)
# iterative spur pruning
SPUR = 5.0  # card units
for it in range(6):
    changed = False
    for p in chains(G):
        a, b = p[0], p[-1]
        da, db = G.degree(a), G.degree(b)
        L = plen(p)
        if a == b:
            continue
        # spur: one free end, other end at a junction
        if (da == 1 and db >= 3) or (db == 1 and da >= 3):
            if L < SPUR:
                inner = p[1:-1]
                end = a if da == 1 else b
                G.remove_nodes_from(inner + [end])
                changed = True
        elif da == 1 and db == 1 and L < 3.0:
            G.remove_nodes_from(p)
            changed = True
    G.remove_nodes_from([n for n in list(G.nodes) if G.degree(n) == 0])
    if not changed:
        break

paths = chains(G)
deg = dict(G.degree())
out = []
for i, p in enumerate(paths):
    a = np.array(p, float)[:, ::-1] / S  # -> (x, y) card units (pixel centres)
    a = a + 0.5 / S
    closed = (p[0] == p[-1]) and len(p) > 3
    if len(a) >= 5:
        if closed:
            core = a[:-1]
            sm = np.stack([gaussian_filter1d(core[:, k], 2.2, mode='wrap') for k in range(2)], 1)
            sm = np.vstack([sm, sm[:1]])
        else:
            sm = np.stack([gaussian_filter1d(a[:, k], 2.2, mode='nearest') for k in range(2)], 1)
            sm[0], sm[-1] = a[0], a[-1]
    else:
        sm = a
    out.append(dict(id=i, closed=bool(closed), deg=[deg.get(p[0], 0), deg.get(p[-1], 0)],
                    pts=[[round(float(x), 3), round(float(y), 3)] for x, y in sm]))
json.dump(out, open('paths_raw.json', 'w'))
print('paths:', len(out), 'pixels:', G.number_of_nodes())

# debug render (2x of card units)
Z = 2
img = np.full((OH * Z, OW * Z, 3), 255, np.uint8)
random.seed(3)
for o in out:
    col = tuple(int(c) for c in np.array(cv2.cvtColor(np.uint8([[[random.randint(0, 179), 255, 200]]]), cv2.COLOR_HSV2BGR)[0, 0]))
    pts = (np.array(o['pts']) * Z * 16).round().astype(np.int32)
    cv2.polylines(img, [pts], False, col, 2, cv2.LINE_AA, shift=4)
    mid = np.array(o['pts'])[len(o['pts']) // 2]
    cv2.putText(img, str(o['id']), (int(mid[0] * Z) + 3, int(mid[1] * Z) - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1, cv2.LINE_AA)
for o in out:
    for end, d in zip((o['pts'][0], o['pts'][-1]), o['deg']):
        if d == 1:
            cv2.circle(img, (int(end[0] * Z), int(end[1] * Z)), 4, (0, 0, 255), 1, cv2.LINE_AA)
cv2.imwrite('paths_dbg.png', img)
