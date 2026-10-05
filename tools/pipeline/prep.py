import numpy as np, cv2
im = cv2.imread("photo.jpg")
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
H, W = g.shape
# Right edge model R(y) (quadratic fit), left edge fixed
ys = np.array([40,220,400,580,700,880,1000,1120], float)
rs = np.array([854,855,856,858,860,862,864,870], float)
c = np.polyfit(ys, rs, 2)
R = lambda y: np.polyval(c, y)
L = 97.0
TOP, BOT = 24.0, 1272.0
OW, OH = 760, 1248
S = 3  # supersampling of the output raster
# background normalisation: estimate paper brightness with a big median of a dilated image (removes dark lines)
bg = cv2.dilate(g, np.ones((9,9), np.uint8))
bg = cv2.medianBlur(bg.astype(np.uint8), 31).astype(np.float32)
norm = np.clip(g / np.maximum(bg, 1), 0, 1.5)
# Build remap: output pixel (u,v) in [0,OW*S)x[0,OH*S) -> photo (x,y)
v = (np.arange(OH*S) + 0.5) / S
u = (np.arange(OW*S) + 0.5) / S
UU, VV = np.meshgrid(u, v)
Y = TOP + VV * (BOT - TOP) / OH
X = L + UU * (R(Y) - L) / OW
warped = cv2.remap(norm, X.astype(np.float32) - 0.5, Y.astype(np.float32) - 0.5, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
np.save("norm_warp.npy", warped)
out = np.clip(warped * 255 / 1.0, 0, 255).astype(np.uint8)
cv2.imwrite("norm_warp.png", out)
print("coeffs", c, "R(24)", R(24), "R(1272)", R(1272))
