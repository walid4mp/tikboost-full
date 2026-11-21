from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, shutil
S=2048; OUT=512
base='/home/claude/work/tikboost-full-main/'
dests=[base+'flutter-app/assets/payment_logos/', base+'admin-panel/payment-logos/']
def canvas(bg):
    im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,S-1,S-1),radius=int(S*.22),fill=bg); return im,d
def save(im,name):
    im=im.resize((OUT,OUT),Image.LANCZOS)
    for dd in dests: im.save(dd+name+'.png')
def diamond(d,cx,cy,r,fill): d.polygon([(cx,cy-r),(cx+r,cy),(cx,cy+r),(cx-r,cy)],fill=fill)
# Binance
Y=(243,186,47,255)
im,d=canvas((30,32,38,255)); c=S//2; u=S*.085
def pt(x,y): return (c+x*u,c+y*u)
diamond(d,c,c,u*.95,Y)
for sx in(-1,1): diamond(d,c+sx*2.7*u,c,u*.95,Y)
for sg in(-1,1):
    d.polygon([pt(0,sg*3.5),pt(2.0,sg*1.5),pt(1.25,sg*.8),pt(0,sg*2.05),pt(-1.25,sg*.8),pt(-2.0,sg*1.5)],fill=Y)
save(im,'binance_pay')
# Tether USDT
im,d=canvas((38,161,123,255)); c=S//2
d.ellipse((c-S*.40,c-S*.40,c+S*.40,c+S*.40),fill=(38,161,123,255))
w=(255,255,255,255); g=(38,161,123,255)
d.rectangle((c-S*.25,c-S*.27,c+S*.25,c-S*.17),fill=w)
d.rectangle((c-S*.065,c-S*.17,c+S*.065,c+S*.31),fill=w)
d.ellipse((c-S*.3,c-S*.1,c+S*.3,c+S*.06),outline=w,width=int(S*.03))
d.ellipse((c-S*.2,c-S*.07,c+S*.2,c+S*.03),fill=g)
d.rectangle((c-S*.065,c-S*.09,c+S*.065,c+S*.02),fill=w)
# small ring
save(im,'usdt_trc20')
# PayPal
im,d=canvas((255,255,255,255))
import glob
f=[x for x in glob.glob('/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf')][0]
font=ImageFont.truetype(f,int(S*.78))
def P(off,col):
    tmp=Image.new('RGBA',(S,S),(0,0,0,0)); td=ImageDraw.Draw(tmp)
    td.text((S/2+off[0],S/2+off[1]),'P',font=font,fill=col,anchor='mm'); return tmp
im=Image.alpha_composite(im,P((S*.045,S*.04),(0,156,222,255)))
im=Image.alpha_composite(im,P((-S*.035,-S*.02),(0,48,135,255)))
# restore rounded alpha
mask=Image.new('L',(S,S),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,S-1,S-1),radius=int(S*.22),fill=255)
bg=Image.new('RGBA',(S,S),(0,0,0,0)); bg.paste(im,(0,0),mask)
ImageDraw.Draw(bg).rounded_rectangle((6,6,S-7,S-7),radius=int(S*.22),outline=(225,228,235,255),width=10)
save(bg,'paypal')
# RedotPay: red tile, white ring + dot (the "redot" idea)
im,d=canvas((255,45,66,255)); c=S//2
d.ellipse((c-S*.27,c-S*.27,c+S*.27,c+S*.27),outline=(255,255,255,255),width=int(S*.07))
d.ellipse((c-S*.095,c-S*.095,c+S*.095,c+S*.095),fill=(255,255,255,255))
d.ellipse((c+S*.17,c-S*.30,c+S*.29,c-S*.18),fill=(255,255,255,255))
save(im,'redotpay')
# BaridiMob: blue tile, yellow envelope on a phone
im,d=canvas((12,60,140,255)); c=S//2
d.rounded_rectangle((c-S*.2,c-S*.34,c+S*.2,c+S*.34),radius=int(S*.05),fill=(255,255,255,255))
d.rounded_rectangle((c-S*.17,c-S*.28,c+S*.17,c+S*.26),radius=int(S*.025),fill=(12,60,140,255))
d.ellipse((c-S*.03,c+S*.285,c+S*.03,c+S*.325),fill=(12,60,140,255))
Yl=(255,204,0,255)
ex0,ey0,ex1,ey1=c-S*.13,c-S*.09,c+S*.13,c+S*.11
d.rounded_rectangle((ex0,ey0,ex1,ey1),radius=int(S*.02),fill=Yl)
d.line([(ex0+S*.01,ey0+S*.015),(c,c+S*.03),(ex1-S*.01,ey0+S*.015)],fill=(12,60,140,255),width=int(S*.014))
save(im,'baridimob')
# Manual transfer: bank building
im,d=canvas((71,85,105,255)); c=S//2; w=(255,255,255,255)
d.polygon([(c,c-S*.30),(c+S*.30,c-S*.12),(c-S*.30,c-S*.12)],fill=w)
for i in range(4):
    x=c-S*.22+i*S*.147
    d.rectangle((x,c-S*.06,x+S*.07,c+S*.17),fill=w)
d.rectangle((c-S*.30,c+S*.20,c+S*.30,c+S*.27),fill=w)
d.rectangle((c-S*.34,c+S*.29,c+S*.34,c+S*.34),fill=w)
save(im,'manual_transfer')
# preview
fs=['binance_pay','usdt_trc20','paypal','redotpay','baridimob','manual_transfer']
W=Image.new('RGB',(6*200,200),(30,30,34))
for i,n in enumerate(fs):
    x=Image.open(dests[0]+n+'.png').resize((180,180)); W.paste(x,(i*200+10,10),x)
W.save('/tmp/logos2.png')
