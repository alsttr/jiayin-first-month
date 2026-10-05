"""Step 1: build a clean ink mask (3x supersampled) from the normalised photo.
Removes clothespin, card-edge artefacts, stray marks, digits, fruit circles and
flower centres (those get redrawn as clean vector shapes)."""
import numpy as np, cv2, json

S = 3
OW, OH = 760, 1248
w = np.load('norm_warp.npy')
m = (w < 0.72).astype(np.uint8)

# card-edge strips
m[:, int(756.5 * S):] = 0
m[:, :int(1.2 * S)] = 0
m[:int(4.0 * S), :] = 0

def comps(mask):
    n, lab, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=8)
    return n, lab, stats

def remove_inside(mask, boxes):
    """remove every connected component whose bbox lies fully inside one of the boxes (output coords)"""
    n, lab, stats = comps(mask)
    kill = np.zeros(n, bool)
    for i in range(1, n):
        x, y, ww, hh, a = stats[i]
        x0, y0, x1, y1 = x / S, y / S, (x + ww) / S, (y + hh) / S
        for (bx0, by0, bx1, by1) in boxes:
            if x0 >= bx0 and y0 >= by0 and x1 <= bx1 and y1 <= by1:
                kill[i] = True
                break
    mask[kill[lab]] = 0
    return int(kill.sum())

def erase_box(mask, b):
    x0, y0, x1, y1 = b
    mask[int(round(y0 * S)):int(round(y1 * S)), int(round(x0 * S)):int(round(x1 * S))] = 0

def erase_disk(mask, cx, cy, r):
    cv2.circle(mask, (int(round(cx * S * 8)), int(round(cy * S * 8))), int(round(r * S * 8)), 0, -1, shift=3)

def erase_poly(mask, pts):
    p = (np.array(pts, float) * S * 8).round().astype(np.int32)
    cv2.fillPoly(mask, [p], 0, shift=3)

# ---- pixel-level erasures for digits that touch outlines ----
erase_box(m, (322.6, 1154.5, 330.2, 1165.6))      # "1" of the tulip-leaf "18"

FRUITS = json.load(open('fruits.json'))
for f in FRUITS:
    erase_disk(m, f['cx'], f['cy'], f['r_erase'])
CENTERS = json.load(open('centers.json'))
for c in CENTERS:
    erase_disk(m, c['cx'], c['cy'], c['r_erase'])
for poly in json.load(open('erase_polys.json')):
    erase_poly(m, poly)

boxes = [
    (0, 0, 116, 116),                     # clothespin
    (0, 0, 760, 5.5),                     # top edge bits
    (0, 0, 4.5, 1248), (754, 0, 760, 1248),  # side edge bits
    (750, 1225, 760, 1248),
    # digits
    (578, 91, 598, 127),     # 1 (sun)
    (543, 522, 570, 548),    # 2 (left snow)
    (636, 592, 666, 624),    # 3
    (342, 515, 365, 545),    # 4
    (147, 610, 169, 638),    # 5
    (154, 303, 173, 325),    # 6
    (374, 304, 389.5, 327.5),  # 7
    (654, 681, 693, 704),    # 12
    (69, 1052, 95, 1077),    # 13
    (334, 985, 368, 1007),   # 14
    (502, 973, 529, 1000),   # 15
    (602, 978, 632, 1006),   # 16
    (468, 752, 499, 785),    # 18 (ground)
    (331, 1156, 350.5, 1179),  # 18 (tulip leaf) "8"
    (383, 1123, 407, 1150),  # 19
    (568, 883, 583.5, 899.5),  # 20
    (441, 553, 474, 588),    # 21
    # stray pen marks
    (405, 418, 413, 425.5), (407, 410, 416.5, 416), (78, 873, 83, 882),
    (70, 399, 77, 404), (64, 400, 67, 403), (471, 941, 476, 944),
    # ring / digit remnants
    (160, 1005, 166.5, 1012), (73, 934.5, 80.5, 945), (590, 867, 599.6, 875.6),
]
k = remove_inside(m, boxes)
# drop any remaining dust
n, lab, stats = comps(m)
small = np.zeros(n, bool)
for i in range(1, n):
    if stats[i][4] < 40:
        small[i] = True
m[small[lab]] = 0
print('removed components:', k, 'dust:', int(small.sum()))

# light smoothing of the mask to reduce skeleton spurs
mm = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)
m2 = (mm > 0.45).astype(np.uint8)
remove_inside(m2, [(160, 1005, 166.5, 1012), (73, 934.5, 80.5, 945), (590, 867, 599.6, 875.6)])
np.save('ink_clean.npy', m2)
cv2.imwrite('ink_clean_small.png', cv2.resize(255 - m2 * 255, (OW, OH), interpolation=cv2.INTER_AREA))
n, lab, stats = comps(m2)
print('remaining components:', n - 1)
for i in range(1, n):
    x, y, ww, hh, a = stats[i]
    print(f'  id={i} area={a} bbox=({x/S:.1f},{y/S:.1f},{ww/S:.1f},{hh/S:.1f})')
