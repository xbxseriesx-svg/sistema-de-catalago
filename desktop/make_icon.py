from PIL import Image, ImageDraw
from pathlib import Path

out = Path('build')
out.mkdir(exist_ok=True)
size = 256
img = Image.new('RGBA', (size, size), (7, 17, 31, 255))
d = ImageDraw.Draw(img)
# Estrela/A geométrica minimalista ASTERYON.
pts = [(128, 24), (151, 88), (220, 91), (165, 132), (184, 202), (128, 161), (72, 202), (91, 132), (36, 91), (105, 88)]
d.polygon(pts, fill=(100, 116, 255, 255))
# Recorte interno em forma de A.
d.polygon([(128, 62), (83, 178), (103, 178), (114, 147), (142, 147), (153, 178), (173, 178)], fill=(7, 17, 31, 255))
d.polygon([(120, 127), (128, 105), (136, 127)], fill=(7, 17, 31, 255))
img.save(out / 'icon.ico', format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
