"""Step 5: export SVG-ready data (regions + line art + number labels) -> art.json"""
import json, numpy as np, cv2

R = 4
W, H = 760, 1248
lab = np.load('labels.npy')
L = json.load(open('lines.json'))

# ------------------------------------------------------------------ region seeds
SEEDS = {
    'sky': (430, 150), 'sky_between_trees': (270, 612),
    'sun': (595, 104),
    'cloud_front': (221, 120), 'cloud_back': (90, 170),
    'canopy_left': (100, 300), 'canopy_right': (380, 280),
    'canopy_right_nook': (292.6, 378.4), 'canopy_right_strip': (309, 470),
    'trunk_right': (350, 600), 'trunk_left': (160, 700),
    'fruit_L1': (83.2, 378.4),   # left tree, upper-left
    'fruit_L2': (211.9, 397.4),  # left tree, upper-right
    'fruit_L3': (54.7, 477.8),   # left tree, lower-left
    'fruit_L4': (250.2, 493.0),  # left tree, lower-right
    'fruit_R1': (338.3, 322.1),  # right tree, top (a 9)
    'fruit_R2': (306.6, 398.6),  # right tree, left
    'fruit_R3': (412.6, 390.8),  # right tree, right
    'fruit_R4': (392.1, 482.9),  # right tree, bottom
    'snow_left': (556, 530), 'snow_right': (743, 458),
    'mountain': (640, 620), 'hill': (660, 700),
    'ground': (480, 800), 'ground_between_flowers': (112, 1040),
    'daisy_petals': (582, 830), 'daisy_centre': (583, 886.5), 'daisy_stem': (565, 1040),
    'daisy_leaf_left': (511, 985), 'daisy_leaf_right': (624, 987),
    'tulip_head': (352, 985), 'tulip_stem': (360, 1100),
    'tulip_leaf_left': (328, 1151), 'tulip_leaf_right': (394, 1138),
    'flower_big_petals': (50, 945), 'flower_big_centre': (88, 946.5),
    'flower_small_petals': (178, 1000), 'flower_small_centre': (146, 1008.7),
    'flower_big_stem': (104.5, 1040), 'flower_small_stem': (130, 1056),
    'flower_leaf': (78, 1060),
}
MERGE = {  # tiny slivers folded into a neighbour so a fill covers them
    (97.7, 1093.8): 'ground',
}

def label_at(p):
    x, y = int(round(p[0] * R)), int(round(p[1] * R))
    return int(lab[y, x])

ids = {}
for k, p in SEEDS.items():
    l = label_at(p)
    assert l > 0, f'seed {k} is on ink'
    assert l not in ids.values(), f'seed {k} duplicates region of {[a for a,b in ids.items() if b==l]}'
    ids[k] = l
merge_into = {}
for p, k in MERGE.items():
    merge_into[label_at(p)] = ids[k]

n = lab.max() + 1
areas = np.bincount(lab.ravel(), minlength=n)
unassigned = [i for i in range(1, n) if i not in ids.values() and i not in merge_into and areas[i] / R / R >= 2]
assert not unassigned, f'unassigned regions: {unassigned}'

# ------------------------------------------------------------------ region polygons
kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))  # ~1.35 card units dilation
regions = []
for k, l in ids.items():
    m = (lab == l)
    for src, dst in merge_into.items():
        if dst == l:
            m |= (lab == src)
    m = m.astype(np.uint8)
    md = cv2.dilate(m, kern)
    cnts, hier = cv2.findContours(md, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in cnts:
        if cv2.contourArea(c) < 6 * R * R:
            continue
        a = cv2.approxPolyDP(c, 1.1, True)[:, 0, :].astype(float) / R
        if len(a) < 3:
            continue
        s = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a) + 'Z'
        parts.append(s)
    d = ''.join(parts)
    ys, xs = np.nonzero(m)
    # label point: max of distance transform (most interior point)
    mp = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    dt = cv2.distanceTransform(mp, cv2.DIST_L2, 5)[1:-1, 1:-1]
    py, px = np.unravel_index(np.argmax(dt), dt.shape)
    regions.append(dict(id=k, d=d,
                        bbox=[round(xs.min() / R, 1), round(ys.min() / R, 1), round(xs.max() / R, 1), round(ys.max() / R, 1)],
                        pt=[round(px / R, 1), round(py / R, 1)],
                        area=round(float(m.sum()) / R / R, 1)))

# ------------------------------------------------------------------ line art
def rdp(points, eps):
    points = np.asarray(points, float)
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    seg = end - start
    L2 = float((seg * seg).sum())
    if L2 < 1e-9:
        d = np.hypot(*(points - start).T)
    else:
        t = np.clip(((points - start) * seg).sum(1) / L2, 0, 1)
        proj = start + np.outer(t, seg)
        d = np.hypot(*(points - proj).T)
    i = int(np.argmax(d))
    if d[i] > eps:
        left = rdp(points[:i + 1], eps)
        right = rdp(points[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([start, end])

def catmull(pts, closed):
    pts = np.asarray(pts, float)
    if closed and np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    n = len(pts)
    if n == 2:
        return f'M{pts[0][0]:.1f} {pts[0][1]:.1f}L{pts[1][0]:.1f} {pts[1][1]:.1f}'
    out = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[(i + 1) % n]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        out.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    if closed:
        out.append('Z')
    return ''.join(out)

lines = []
for p in L['paths']:
    pts = np.array(p['pts'], float)
    s = rdp(pts, 0.22)
    lines.append(catmull(s, p['closed']))
circles = [dict(cx=round(c['cx'], 2), cy=round(c['cy'], 2), r=round(c['r'], 2), name=c['name']) for c in L['circles']]

# ------------------------------------------------------------------ number labels (positions from the drawing)
LABELS = [
    ('sun', 588, 109, 30), ('snow_left', 556.5, 535, 24), ('snow_right', 746.5, 454.5, 20),
    ('mountain', 651, 608, 29), ('trunk_right', 353.5, 530, 27), ('trunk_left', 158, 624, 26),
    ('canopy_left', 163.5, 314, 22), ('canopy_right', 381.8, 316, 22),
    ('fruit_L1', 83.2, 378.4, 10.5), ('fruit_L2', 211.9, 397.4, 10.5), ('fruit_L3', 54.7, 477.8, 10.5),
    ('fruit_L4', 250.2, 493.0, 10.5), ('fruit_R2', 306.6, 398.6, 10.5), ('fruit_R3', 412.6, 390.8, 10.5),
    ('fruit_R4', 392.1, 482.9, 10.5),
    ('hill', 673.5, 692.5, 22), ('flower_leaf', 82, 1064.5, 23), ('tulip_head', 351, 996, 22),
    ('daisy_leaf_left', 515.5, 986.5, 24), ('daisy_leaf_right', 617, 992, 25),
    ('flower_big_centre', 88, 946.5, 13), ('flower_small_petals', 171.5, 1002, 16),
    ('ground', 483.5, 768.5, 28), ('tulip_leaf_left', 336.5, 1166.8, 22), ('tulip_leaf_right', 395, 1136.5, 23),
    ('daisy_centre', 583, 886.5, 19), ('sky', 457.5, 570.5, 30),
    ('fruit_R1', 338.3, 322.1, 10.5),   # the right tree's top berry is a 9 too (added last so the others keep their look)
]
labels = [dict(region=r, x=x, y=y, size=s) for r, x, y, s in LABELS]

art = dict(w=W, h=H, regions=regions, lines=lines, circles=circles, labels=labels)
json.dump(art, open('art.json', 'w'), separators=(',', ':'))
print('regions', len(regions), 'lines', len(lines), 'bytes', len(json.dumps(art, separators=(",", ":"))))
for r in regions:
    print(f"  {r['id']:24s} area={r['area']:9.1f} pt={r['pt']} len(d)={len(r['d'])}")
