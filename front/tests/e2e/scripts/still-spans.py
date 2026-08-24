"""
영상에서 *잘라도 되는* 구간을 찾는다 — 커서까지 완전히 멈춘 자리만.

    python3 scripts/still-spans.py <영상>

★ ffmpeg 의 freezedetect 를 쓰지 않는다. 그것은 화면 전체의 평균 변화를 보므로 **커서만 움직이는
  프레임을 정지로 센다.** 그 구간을 줄이면 커서가 목표까지 가는 시간이 사라져 워프처럼 보인다
  (docs/08-주의사항 C-22 — 실제로 그렇게 잘랐다).

★ 축소 배율과 한계값이 이 판정의 전부다. 처음엔 960×540 에 화소 40개를 기준으로 삼았는데, 그
  크기에서 커서는 40개를 넘기지 못해 *커서가 움직이는 3초를 정지로 보고* 잘랐다 — 그래서 또
  워프가 났다. 1280×720 에 화소 10개로 낮춘 뒤에야 커서가 잡혔다. 이 값을 올리지 않는다.

자르기로 정한 구간은 **접합부 앞뒤 프레임을 눈으로 확인한다.** 커서가 같은 자리에 있어야 한다.
"""
import subprocess, sys, numpy as np

src, fps, W, H = sys.argv[1], 4, 1280, 720
PIXEL_DIFF = 6       # 이 값보다 크게 달라진 화소만 센다 (압축 잡음 무시)
MIN_PIXELS = 10      # 그런 화소가 이만큼 있으면 '움직였다' — 커서는 이보다 크다

p = subprocess.run(
    ['ffmpeg','-v','error','-i',src,'-vf',f'fps={fps},scale={W}:{H},format=gray',
     '-f','rawvideo','-'], capture_output=True)
buf = np.frombuffer(p.stdout, dtype=np.uint8)
n = len(buf) // (W*H)
frames = buf[:n*W*H].reshape(n, H, W).astype(np.int16)

moved = [False]*n
for i in range(1, n):
    d = np.abs(frames[i] - frames[i-1])
    moved[i] = int((d > PIXEL_DIFF).sum()) >= MIN_PIXELS

# 정지 구간(움직임 없는 연속 프레임)을 모은다
spans, start = [], None
for i in range(1, n):
    if not moved[i]:
        if start is None: start = i
    else:
        if start is not None:
            spans.append((start/fps, i/fps)); start = None
if start is not None: spans.append((start/fps, n/fps))

print(f"총 {n/fps:.1f}초 · 정지 구간 {len(spans)}개")
for a,b in spans:
    if b-a >= 1.0: print(f"  {a:6.2f} ~ {b:6.2f}   {b-a:5.2f}초")
print(f"정지 합계 {sum(b-a for a,b in spans):.1f}초")
