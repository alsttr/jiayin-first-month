"""Step 3: apply manual fixes to the traced paths (coordinate-referenced) and add
clean vector circles (fruits, flower centres).
Output: lines.json -> {"paths":[{pts, closed}], "circles":[{name,cx,cy,r}]}"""
import json, numpy as np

raw = json.load(open('paths_raw.json'))
paths = [dict(pts=[list(p) for p in o['pts']], closed=o['closed']) for o in raw]
FRUITS = json.load(open('fruits.json'))
CENTERS = json.load(open('centers.json'))
CIRC = {f['name']: (f['cx'], f['cy'], f['r_draw']) for f in FRUITS + CENTERS}
W, H = 760, 1248
LOG = []


def arr(p):
    return np.array(p['pts'], float)


def find_path(pt, tol=1.2):
    best = (1e9, None)
    for i, p in enumerate(paths):
        if p is None:
            continue
        a = arr(p)
        d = float(np.min(np.hypot(a[:, 0] - pt[0], a[:, 1] - pt[1])))
        if d < best[0]:
            best = (d, i)
    if best[0] > tol:
        raise SystemExit(f'no path near {pt} (closest {best[0]:.2f})')
    return best[1]


def find_end(pt, tol=1.5):
    best = None
    for i, p in enumerate(paths):
        if p is None or p['closed']:
            continue
        for e, q in (('s', p['pts'][0]), ('e', p['pts'][-1])):
            d = float(np.hypot(q[0] - pt[0], q[1] - pt[1]))
            if best is None or d < best[0]:
                best = (d, i, e)
    if best is None or best[0] > tol:
        raise SystemExit(f'no endpoint near {pt} (closest {best[0] if best else None})')
    return best[1], best[2]


def end_point(i, e):
    return np.array(paths[i]['pts'][0] if e == 's' else paths[i]['pts'][-1], float)


def append_pts(i, e, new_pts):
    new_pts = [[float(q[0]), float(q[1])] for q in new_pts]
    if e == 'e':
        paths[i]['pts'] = paths[i]['pts'] + new_pts
    else:
        paths[i]['pts'] = new_pts[::-1] + paths[i]['pts']


def delete(pt, tol=1.2):
    i = find_path(pt, tol)
    LOG.append(('delete', pt, len(paths[i]['pts'])))
    paths[i] = None


def join(pa, pb, tol=1.5):
    i, ei = find_end(pa, tol)
    j, ej = find_end(pb, tol)
    if i == j:
        paths[i]['pts'].append(list(paths[i]['pts'][0]))
        paths[i]['closed'] = True
        return
    A = paths[i]['pts'] if ei == 'e' else paths[i]['pts'][::-1]
    B = paths[j]['pts'] if ej == 's' else paths[j]['pts'][::-1]
    paths[i] = dict(pts=A + B, closed=False)
    paths[j] = None


def snap_circle(pt, name, tol=1.5):
    i, e = find_end(pt, tol)
    cx, cy, r = CIRC[name]
    q = end_point(i, e)
    v = q - [cx, cy]
    t = np.array([cx, cy]) + v / np.linalg.norm(v) * r
    append_pts(i, e, [q + (t - q) * 0.5, t])
    LOG.append(('snap_circle', pt, name, round(float(np.linalg.norm(v) - r), 2)))


def nearest_on(ref_pt, q):
    """nearest point to q on the path that passes through ref_pt"""
    j = find_path(ref_pt, 1.5)
    a = arr(paths[j])
    # densify
    seg = []
    for k in range(len(a) - 1):
        for t in np.linspace(0, 1, 8, endpoint=False):
            seg.append(a[k] + (a[k + 1] - a[k]) * t)
    seg.append(a[-1])
    seg = np.array(seg)
    d = np.hypot(seg[:, 0] - q[0], seg[:, 1] - q[1])
    return seg[int(np.argmin(d))]


def snap_path(pt, ref_pt, tol=1.5):
    i, e = find_end(pt, tol)
    q = end_point(i, e)
    t = nearest_on(ref_pt, q)
    append_pts(i, e, [q + (t - q) * 0.5, t])
    LOG.append(('snap_path', pt, round(float(np.linalg.norm(t - q)), 2)))


def extend_edge(pt, tol=1.5, margin=3.0):
    i, e = find_end(pt, tol)
    q = end_point(i, e)
    a = arr(paths[i])
    prev = a[-25] if e == "e" else a[24]
    d = q - prev
    d /= np.linalg.norm(d)
    r = q
    for t in np.linspace(0, 80, 1601):
        r = q + d * t
        if r[0] < -margin or r[0] > W + margin or r[1] < -margin or r[1] > H + margin:
            break
    append_pts(i, e, [q + (r - q) * 0.5, r])
    LOG.append(('extend_edge', pt, [round(float(v), 1) for v in r]))


def trim_end(pt, cond, tol=1.5):
    """drop points from the end of a path (starting at the end near pt) while cond(x, y) holds"""
    i, e = find_end(pt, tol)
    pts = paths[i]['pts'] if e == 'e' else paths[i]['pts'][::-1]
    while len(pts) > 2 and cond(*pts[-1]):
        pts = pts[:-1]
    paths[i]['pts'] = pts if e == 'e' else pts[::-1]
    return pts[-1]


def add(pts, closed=False):
    paths.append(dict(pts=[[float(x), float(y)] for x, y in pts], closed=closed))


# ------------------------------------------------------------ clouds
join((164.8, 67.5), (172.2, 64.2))
delete((144.5, 119.6), tol=2.0)          # small hook where the two clouds overlap

# ------------------------------------------------------------ right canopy gaps
join((404.2, 278.8), (406.2, 284.8))
join((437.2, 437.5), (439.2, 442.5))

# ------------------------------------------------------------ spurs / artefacts
delete((268.5, 524.6), tol=2.0)          # spur at the canopy junction
delete((402.0, 360.8))                   # spike above the R_right leaf
delete((84.8, 868.5))                    # hook at the left end of the tree's base line

# ------------------------------------------------------------ fruits
delete((78.2, 364.6)); delete((87.5, 365.3))       # L_topleft ring remnants
delete((48.8, 465.8)); delete((58.5, 464.8))       # L_botleft ring remnants
delete((306.5, 385.1))                             # R_left: stray line across the fruit top
snap_circle((83.8, 363.5), 'L_topleft')
_p = trim_end((222.5, 390.8), lambda x, y: y > 383.6)   # stem hugged the circle; cut it at the top
snap_circle(tuple(_p), 'L_topright')
snap_circle((53.8, 463.2), 'L_botleft')
snap_circle((248.5, 480.8), 'L_botright')
snap_circle((338.5, 310.2), 'R_top')
snap_circle((402.8, 381.5), 'R_right')
snap_circle((394.5, 470.2), 'R_bot')
snap_circle((301.2, 384.5), 'R_left')               # canopy edge + stem meet the fruit
snap_circle((299.5, 409.2), 'R_left')               # canopy edge continues below the fruit
# right trunk's left arm tip touches the bottom of the R_left fruit
cx, cy, r = CIRC['R_left']
tip = np.array([313.8, 410.1]); v = tip - [cx, cy]
add([tip, np.array([cx, cy]) + v / np.linalg.norm(v) * r])

# ------------------------------------------------------------ right flower centre
delete((564.4, 896.2))                   # ring remnant (lower-left)
delete((586.8, 906.4))                   # ring remnant (lower-right)
delete((576.2, 907.3))                   # ring remnant (bottom)
snap_circle((572.2, 906.8), 'rightflower_center')
snap_circle((579.8, 908.5), 'rightflower_center')

# ------------------------------------------------------------ big left flower: rebuild the narrow stem
for q in [(94.1, 967.5), (95.0, 973.8), (97.7, 979.9), (93.5, 981.5), (96.5, 985.2), (95.4, 994.2),
          (101.2, 992.8), (99.5, 1001.7), (98.3, 1009.5), (103.2, 1008.2), (101.5, 1018.2),
          (100.2, 1027.2), (105.1, 1026.5), (103.5, 1030.8), (101.8, 1044.5), (103.2, 1065.2),
          (109.7, 1059.5), (98.2, 958.0)]:
    delete(q, tol=0.6)
stem_L = [(90.6, 957.6), (91.9, 962.0), (93.2, 967.0), (94.3, 973.0), (95.0, 980.0), (95.6, 988.0),
          (96.6, 997.0), (98.2, 1006.0), (99.7, 1015.0), (100.6, 1024.0), (101.1, 1033.0),
          (101.5, 1043.0), (102.0, 1053.0), (102.6, 1063.0), (103.1, 1073.0), (103.4, 1082.0),
          (103.5, 1090.8)]
stem_R = [(95.2, 956.0), (96.4, 961.0), (97.5, 967.0), (98.5, 974.0), (99.4, 981.0), (100.2, 989.0),
          (101.2, 997.0), (102.5, 1005.0), (103.8, 1013.0), (104.9, 1021.0), (105.9, 1029.0),
          (107.0, 1037.0), (108.1, 1045.0), (109.1, 1053.0), (109.9, 1061.0), (110.4, 1069.0),
          (110.8, 1077.0), (112.0, 1083.5), (114.2, 1087.8)]
add(stem_L)
add(stem_R)
snap_path((93.5, 964.8), (93.2, 967.0))      # lower-left petal meets the stem
_p = trim_end((94.5, 969.5), lambda x, y: x < 98.9)  # lower-right petal started inside the stem
snap_path(tuple(_p), (97.5, 967.0))          # lower-right petal meets the stem

# ------------------------------------------------------------ tree base: trunk edge reaches the base line
snap_path((109.5, 848.8), (116.5, 853.4))

# ------------------------------------------------------------ lines that run off the card
extend_edge((755.8, 436.5))
extend_edge((755.5, 477.5))
extend_edge((754.5, 650.5))
extend_edge((754.8, 735.2))
extend_edge((1.2, 673.2))

out_paths = [p for p in paths if p is not None and len(p['pts']) >= 2]
circles = [dict(name=k, cx=v[0], cy=v[1], r=v[2]) for k, v in CIRC.items()]
json.dump(dict(paths=out_paths, circles=circles), open('lines.json', 'w'))
for l in LOG:
    print(l)
print('paths', len(out_paths), 'circles', len(circles))
