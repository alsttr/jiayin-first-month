"""Step 4: rasterise the final line art and label the enclosed regions."""
import json, numpy as np, cv2, random
R = 4                     # raster scale (px per card unit)
W, H = 760, 1248
WREG = 2.2                # line width used for region separation (card units)
L = json.load(open('lines.json'))
ink = np.zeros((H * R, W * R), np.uint8)
SH = 4  # fixed-point shift
def P(pts):
    return (np.array(pts, float) * R * (1 << SH)).round().astype(np.int32)
th = max(1, int(round(WREG * R)))
for p in L['paths']:
    pts = P(p['pts'])
    cv2.polylines(ink, [pts], bool(p['closed']), 255, th, cv2.LINE_8, shift=SH)
    for q in pts[[0, -1]]:
        cv2.circle(ink, tuple(int(v) for v in q), int(WREG * R / 2 * (1 << SH)), 255, -1, cv2.LINE_8, shift=SH)
for c in L['circles']:
    cv2.circle(ink, (int(round(c['cx'] * R * 16)), int(round(c['cy'] * R * 16))), int(round(c['r'] * R * 16)), 255, th, cv2.LINE_8, shift=4)
np.save('ink_regions.npy', ink)
free = (ink == 0).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(free, connectivity=4)
np.save('labels.npy', lab.astype(np.int32))
info = []
for i in range(1, n):
    x, y, w, h, a = stats[i]
    info.append(dict(id=i, area=round(a / R / R, 1), cx=round(cent[i][0] / R, 1), cy=round(cent[i][1] / R, 1),
                     bbox=[round(x / R, 1), round(y / R, 1), round((x + w) / R, 1), round((y + h) / R, 1)]))
json.dump(info, open('regions_raw.json', 'w'))
print('regions', n - 1)
for r in sorted(info, key=lambda r: r['area']):
    if r['area'] < 400: print(r)
# debug colour image at 1x
random.seed(1)
cols = np.zeros((n, 3), np.uint8)
for i in range(1, n):
    cols[i] = cv2.cvtColor(np.uint8([[[random.randint(0, 179), random.randint(90, 200), 255]]]), cv2.COLOR_HSV2BGR)[0, 0]
img = cols[lab]
img[ink > 0] = (40, 40, 40)
img = cv2.resize(img, (W * 2, H * 2), interpolation=cv2.INTER_AREA)
for r in info:
    cv2.putText(img, str(r['id']), (int(r['cx'] * 2) - 6, int(r['cy'] * 2) + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
cv2.imwrite('regions_dbg.png', img)
