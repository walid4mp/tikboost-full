import math, json, random, subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
W,H,FPS=1080,1920,30
DUR=26.0; NF=int(DUR*FPS)
A='/home/claude/work/tikboost-full-main/flutter-app/assets/'
AR='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
LB='/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'
LM='/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf'
def F(path,size): return ImageFont.truetype(path,size)
fonts={}
def font(kind,size):
    size=max(8,int(size)); k=(kind,size)
    if k not in fonts: fonts[k]=F({'ar':AR,'lb':LB,'lm':LM}[kind],size)
    return fonts[k]
def clamp(x,a=0,b=1): return max(a,min(b,x))
def ease_out(p): return 1-(1-p)**3
def ease_out4(p): return 1-(1-p)**4
def ease_back(p):
    c1=1.70158;c3=c1+1;p=clamp(p); return 1+c3*(p-1)**3+c1*(p-1)**2
def ease_io(p): p=clamp(p); return 3*p*p-2*p**3
def lerp(a,b,p): return a+(b-a)*p

# ---------------------------------------------------------------- wheel math
SEG=8; seg=2*math.pi/SEG
LABELS=['500','50','100','25','200','10','1000','75']
COLORS=[(255,59,92),(45,123,255),(139,108,255),(255,170,40),(34,197,94),(236,72,153),(6,182,212),(249,115,22)]
WIN_IDX=0
SPIN_T0=0.7; SPIN_T1=4.7
FINAL=(-(WIN_IDX+.5)*seg)%(2*math.pi)
THETA_END=2*math.pi*6+FINAL
def theta(lt):
    p=clamp((lt-SPIN_T0)/(SPIN_T1-SPIN_T0)); return THETA_END*ease_out4(p)
def idx_at(th):
    loc=(-th)%(2*math.pi); return int(loc/seg)%SEG
S2=3.6
ticks=[];last=idx_at(0)
steps=int((SPIN_T1-SPIN_T0)*1000)
prev=0
for i in range(steps+1):
    lt=SPIN_T0+i/1000; th=theta(lt); ix=idx_at(th)
    if ix!=last:
        sp=clamp(abs(th-prev)*1000/(2*math.pi)/1.8)  # turns/s normalised
        ticks.append([round(S2+lt,3),round(.35+.65*sp,2)]); last=ix
    prev=th
S3=9.6; S4=14.2; S5=18.6; S6=22.4
json.dump({'ticks':ticks,'wins':[S2+4.75],'levelups':[S3+3.2],'pops':[S4+.3+i*.35 for i in range(5)]+[S5+.4,S5+.9,S5+1.4,S6+.4]},open('/home/claude/gen/video/ticks.json','w'))
print('ticks',len(ticks))
if __name__=='__main__' and '--audio-only' in sys.argv: sys.exit()

# ---------------------------------------------------------------- assets
icon=Image.open(A+'icons/tikboost_wh_master_icon.png').convert('RGBA')
logos={k:Image.open(A+f'payment_logos/{k}.png').convert('RGBA') for k in ['binance_pay','usdt_trc20','paypal','redotpay','baridimob']}
LOGO_LABEL={'binance_pay':'Binance Pay','usdt_trc20':'USDT','paypal':'PayPal','redotpay':'RedotPay','baridimob':'BaridiMob'}

def vgrad(w,h,stops):
    arr=np.zeros((h,w,3),dtype=np.float32)
    ys=np.linspace(0,1,h)
    for c in range(3):
        xs=[s[0] for s in stops]; vs=[s[1][c] for s in stops]
        arr[:,:,c]=np.interp(ys,xs,vs)[:,None]
    return Image.fromarray(arr.astype('uint8'),'RGB')
BG=vgrad(W,H,[(0,(7,10,31)),(.5,(27,11,58)),(1,(5,20,46))]).convert('RGBA')
def blob(color,r):
    im=Image.new('RGBA',(r*4,r*4),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse((r,r,3*r,3*r),fill=color+(150,)); return im.filter(ImageFilter.GaussianBlur(r*.55))
BLOBS=[(blob((255,59,130),300),0.0,0.15),(blob((90,70,255),340),2.1,0.55),(blob((0,200,255),280),4.2,0.85)]
rng=random.Random(5)
STARS=[(rng.random()*W,rng.random()*H,rng.random()*6.28,rng.uniform(1.2,3.2)) for _ in range(90)]
def background(t):
    im=BG.copy()
    for b,ph,yy in BLOBS:
        x=W/2+math.sin(t*.35+ph)*380-b.width/2; y=H*yy+math.cos(t*.28+ph)*180-b.height/2
        im.alpha_composite(b,(int(x),int(y)))
    d=ImageDraw.Draw(im)
    for x,y,ph,r in STARS:
        a=int(60+80*(.5+.5*math.sin(t*2+ph)))
        d.ellipse((x-r,(y+t*14)%H-r,x+r,(y+t*14)%H+r),fill=(255,255,255,a))
    return im

# ---------------------------------------------------------------- helpers
def new(): return Image.new('RGBA',(W,H),(0,0,0,0))
def text(d,xy,s,kind,size,fill=(255,255,255,255),anchor='mm',stroke=0,sfill=(0,0,0,160)):
    f=font(kind,size)
    kw={'language':'ar'} if kind=='ar' else {}
    d.text(xy,s,font=f,fill=fill,anchor=anchor,stroke_width=stroke,stroke_fill=sfill,**kw)
def glow_text(layer,xy,s,kind,size,col):
    g=new(); gd=ImageDraw.Draw(g); text(gd,xy,s,kind,size,col+(255,))
    layer.alpha_composite(g.filter(ImageFilter.GaussianBlur(14)))
def paste_center(layer,im,cx,cy,scale=1.0,alpha=1.0):
    w=max(1,int(im.width*scale)); h=max(1,int(im.height*scale))
    r=im.resize((w,h),Image.LANCZOS)
    if alpha<1: r.putalpha(r.getchannel('A').point(lambda v:int(v*alpha)))
    layer.alpha_composite(r,(int(cx-w/2),int(cy-h/2)))
def rrect(d,box,r,fill,outline=None,width=2): d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def fade_layer(im,f):
    if f>=.999: return im
    a=im.getchannel('A').point(lambda v:int(v*f)); im=im.copy(); im.putalpha(a); return im
def title(layer,ar,en,lt,y=210,size=92):
    p=ease_out(clamp(lt/.6)); d=ImageDraw.Draw(layer)
    oy=(1-p)*60
    text(d,(W/2,y+oy),ar,'ar',size,(255,255,255,int(255*p)),stroke=3)
    text(d,(W/2,y+oy+95),en,'lb',44,(139,232,255,int(255*p)))

# ---------------------------------------------------------------- wheel image
def make_wheel(R=400):
    S=R*2+60; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im); c=S/2
    d.ellipse((c-R-18,c-R-18,c+R+18,c+R+18),fill=(255,209,102,255))
    d.ellipse((c-R-6,c-R-6,c+R+6,c+R+6),fill=(30,20,70,255))
    for i in range(SEG):
        a0=-90+i*360/SEG; col=COLORS[i%len(COLORS)]
        d.pieslice((c-R,c-R,c+R,c+R),a0,a0+360/SEG,fill=col+(255,),outline=(255,255,255,200),width=3)
        # label
        am=math.radians(a0+180/SEG); tr=R*.66
        tx,ty=c+tr*math.cos(am),c+tr*math.sin(am)
        t=Image.new('RGBA',(300,120),(0,0,0,0)); td=ImageDraw.Draw(t)
        td.text((150,60),LABELS[i],font=font('lb',62),fill=(255,255,255,255),anchor='mm',stroke_width=4,stroke_fill=(0,0,0,110))
        t=t.rotate(-(a0+180/SEG+90),expand=True,resample=Image.BICUBIC)
        im.alpha_composite(t,(int(tx-t.width/2),int(ty-t.height/2)))
    for i in range(24):
        a=math.radians(i*15); x,y=c+(R+6)*math.cos(a),c+(R+6)*math.sin(a)
        d.ellipse((x-9,y-9,x+9,y+9),fill=(255,255,255,255))
    d.ellipse((c-62,c-62,c+62,c+62),fill=(17,24,39,255),outline=(255,209,102,255),width=8)
    return im
WHEEL=make_wheel()
confetti=[]
cr=random.Random(11)
for i in range(170):
    confetti.append(dict(a=cr.uniform(0,6.28),v=cr.uniform(300,1100),r=cr.uniform(0,6.28),w=cr.uniform(10,22),col=cr.choice(COLORS+[(255,209,102),(255,255,255)]),spin=cr.uniform(-9,9)))

# ---------------------------------------------------------------- scenes
def scene1(lt):
    L=new(); d=ImageDraw.Draw(L)
    p=ease_back(clamp((lt-.1)/.8)); pulse=1+.025*math.sin(lt*5)
    ring=clamp((lt-.2)/1.4)
    for k in range(3):
        rp=clamp(ring-k*.18)
        if 0<rp<1:
            r=int(260+rp*520); a=int(130*(1-rp))
            d.ellipse((W/2-r,870-r,W/2+r,870+r),outline=(139,108,255,a),width=6)
    g=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(g)
    gd.ellipse((W/2-330,870-330,W/2+330,870+330),fill=(255,59,130,int(110*p)))
    L.alpha_composite(g.filter(ImageFilter.GaussianBlur(60)))
    paste_center(L,icon,W/2,870,(560/icon.width)*p*pulse)
    q=ease_out(clamp((lt-1.0)/.7)); d=ImageDraw.Draw(L)
    text(d,(W/2,1280+(1-q)*50),'tikboost.wh','lb',108,(255,255,255,int(255*q)),stroke=3)
    q2=ease_out(clamp((lt-1.5)/.7))
    text(d,(W/2,1410+(1-q2)*40),'اكسب، تفاعل، وخلّي حضورك يلمع','ar',50,(255,214,102,int(255*q2)))
    q3=ease_out(clamp((lt-2.0)/.7))
    text(d,(W/2,1490+(1-q3)*30),'EARN  •  ENGAGE  •  SHINE','lb',36,(139,232,255,int(255*q3)))
    return L
def scene2(lt):
    L=new(); title(L,'عجلة الحظ','LUCKY WHEEL',lt)
    th=theta(lt); cx,cy=W/2,1050
    p=ease_back(clamp(lt/.7))
    glow=new(); gd=ImageDraw.Draw(glow); gd.ellipse((cx-470,cy-470,cx+470,cy+470),fill=(139,108,255,90)); L.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))
    rot=WHEEL.rotate(-math.degrees(th),resample=Image.BICUBIC)
    paste_center(L,rot,cx,cy,p)
    d=ImageDraw.Draw(L)
    # pointer with flick
    last=[t for t,_ in ticks if S2+SPIN_T0<=t<=S2+lt]
    flick=0
    if last and (S2+lt-last[-1])<.12: flick=(1-(S2+lt-last[-1])/.12)*-22
    pt=Image.new('RGBA',(120,150),(0,0,0,0)); pd=ImageDraw.Draw(pt)
    pd.polygon([(60,140),(8,36),(112,36)],fill=(255,170,40,255),outline=(255,255,255,255))
    pd.ellipse((40,18,80,58),fill=(255,209,102,255),outline=(255,255,255,255),width=4)
    pt=pt.rotate(flick,center=(60,38),resample=Image.BICUBIC)
    L.alpha_composite(pt,(int(cx-60),int(cy-W*0+(-415)-20)))
    if lt<SPIN_T0:
        text(d,(W/2,1560),'اضغط لف الآن','ar',54,(255,255,255,int(255*(.5+.5*math.sin(lt*8)))))
    wt=lt-(SPIN_T1+.05)
    if wt>0:
        q=ease_back(clamp(wt/.5))
        # confetti
        for c in confetti:
            tt=wt; x=cx+math.cos(c['a'])*c['v']*tt*.55; y=cy-200+math.sin(c['a'])*c['v']*tt*.55+900*tt*tt*.5
            if y>H+40 or tt>3: continue
            ang=c['r']+c['spin']*tt; w=c['w']
            pts=[(x+math.cos(ang)*w,y+math.sin(ang)*w*.5),(x+math.cos(ang+2.4)*w,y+math.sin(ang+2.4)*w*.5),(x+math.cos(ang+4.2)*w,y+math.sin(ang+4.2)*w*.5)]
            d.polygon(pts,fill=c['col']+(int(255*clamp(1-tt/3)),))
        bx=Image.new('RGBA',(700,300),(0,0,0,0)); bd=ImageDraw.Draw(bx)
        rrect(bd,(0,0,700,300),60,(17,24,39,235),(255,209,102,255),6)
        text(bd,(350,115),'+500','lb',130,(255,209,102,255),stroke=3)
        text(bd,(350,225),'نقطة  •  POINTS','ar',46,(255,255,255,255))
        paste_center(L,bx,W/2,1100,q)
    return L
LEVELS=[('Bronze',(205,127,50)),('Silver',(190,198,210)),('Gold',(255,200,60)),('Platinum',(120,220,235)),('Diamond',(90,150,255))]
def scene3(lt):
    L=new(); title(L,'مستويات ومهام يومية','LEVELS & DAILY MISSIONS',lt); d=ImageDraw.Draw(L)
    # ladder
    y0=620; xs=[130+i*205 for i in range(5)]
    prog=clamp((lt-.4)/2.8); lvl_f=prog*4
    rrect(d,(xs[0],y0-8,xs[-1],y0+8),8,(255,255,255,40))
    rrect(d,(xs[0],y0-8,lerp(xs[0],xs[-1],prog),y0+8),8,(255,209,102,255)) if prog>0 else None
    for i,(n,col) in enumerate(LEVELS):
        reached=lvl_f>=i-1e-6
        pp=ease_back(clamp((lt-.1-i*.12)/.5)); r=int(62*pp)
        if r<=0: continue
        extra=0
        if i==4 and lt>S3-S3+3.2: extra=1.0+.12*math.sin((lt-3.2)*10)
        rr=int(r*(extra or 1))
        c=col if reached else (70,76,100)
        d.ellipse((xs[i]-rr,y0-rr,xs[i]+rr,y0+rr),fill=c+(255,),outline=(255,255,255,230),width=5)
        text(d,(xs[i],y0),str(i+1),'lb',int(52*pp),(20,20,40,255) if reached else (200,205,225,255))
        text(d,(xs[i],y0+105),n,'lm',27,(255,255,255,int(255*pp)))
    # xp bar
    rrect(d,(110,800,970,846),23,(255,255,255,40))
    rrect(d,(110,800,110+860*clamp(prog*1.0),846),23,(139,232,255,255)) if prog>0.02 else None
    text(d,(W/2,900),'XP  %d / 2600'%int(prog*2600),'lb',40,(255,255,255,255))
    # missions
    items=[('تسجيل الدخول اليومي','+25'),('أكمل مهمة واحدة','+40'),('لف عجلة الحظ','+30'),('ادعُ صديقاً','+75')]
    for i,(t,rw) in enumerate(items):
        st=.9+i*.45; p=ease_out(clamp((lt-st)/.5))
        if p<=0: continue
        x=lerp(-700,0,p); y=950+i*160
        rrect(d,(70+x,y,1010+x,y+150),34,(21,24,36,235),(60,66,95,255),3)
        done=lt>st+.9
        d.ellipse((120+x,y+40,190+x,y+110),fill=((71,230,161,255) if done else (60,66,95,255)))
        if done:
            d.line([(135+x,y+75),(150+x,y+92),(177+x,y+58)],fill=(10,30,20,255),width=9,joint='curve')
        text(d,(940+x,y+75),t,'ar',44,(255,255,255,255),anchor='rm')
        text(d,(300+x,y+75),rw,'lb',46,(255,209,102,255),anchor='mm')
    if lt>3.2:
        q=ease_back(clamp((lt-3.2)/.5)); 
        bx=Image.new('RGBA',(620,150),(0,0,0,0)); bd=ImageDraw.Draw(bx)
        rrect(bd,(0,0,620,150),75,(255,59,130,255),(255,255,255,255),5)
        text(bd,(310,75),'LEVEL UP!','lb',68,(255,255,255,255))
        paste_center(L,bx,W/2,1665,q)
    return L
def scene4(lt):
    L=new(); title(L,'طرق دفع متعددة','PAY YOUR WAY',lt); d=ImageDraw.Draw(L)
    keys=['binance_pay','usdt_trc20','paypal','redotpay','baridimob']
    pos=[(W/2-300,760),(W/2,760),(W/2+300,760),(W/2-160,1180),(W/2+160,1180)]
    for i,k in enumerate(keys):
        p=ease_back(clamp((lt-.3-i*.35)/.6))
        if p<=0: continue
        cx,cy=pos[i]; bob=math.sin(lt*2.2+i)*8
        glow=new(); gd=ImageDraw.Draw(glow); gd.ellipse((cx-150,cy-150+bob,cx+150,cy+150+bob),fill=(139,108,255,int(80*p))); L.alpha_composite(glow.filter(ImageFilter.GaussianBlur(40)))
        paste_center(L,logos[k],cx,cy+bob,(250/512)*p)
        text(d,(cx,cy+170+bob),LOGO_LABEL[k],'lb',38,(255,255,255,int(255*clamp(p))))
    q=ease_out(clamp((lt-2.2)/.6))
    if q>0:
        rrect(d,(110,1500,970,1650),70,(21,24,36,int(235*q)),(255,209,102,int(255*q)),4)
        text(d,(W/2,1575),'VIP  •  VIP PRO  •  Elite  •  Ultimate','lb',38,(255,209,102,int(255*q)))
    return L
def scene5(lt):
    L=new(); title(L,'٣ لغات + لوحة إدارة','3 LANGUAGES  +  FULL ADMIN PANEL',lt,y=200,size=84); d=ImageDraw.Draw(L)
    langs=[('العربية','ar',(255,59,130)),('English','lb',(45,123,255)),('Français','lb',(139,108,255))]
    for i,(n,k,c) in enumerate(langs):
        p=ease_out(clamp((lt-.3-i*.25)/.5)); 
        if p<=0: continue
        x=W/2-330+i*330; y=520+(1-p)*80
        rrect(d,(x-150,y-60,x+150,y+60),60,c+(int(255*p),))
        text(d,(x,y),n,k,48,(255,255,255,int(255*p)))
    p=ease_out(clamp((lt-.9)/.6))
    if p>0:
        oy=(1-p)*120
        rrect(d,(80,720+oy,1000,1640+oy),50,(17,20,33,int(240*p)),(70,78,115,int(255*p)),4)
        [d.ellipse((140+i*42,774+oy,164+i*42,798+oy),fill=c+(int(255*p),)) for i,c in enumerate([(255,95,95),(255,200,60),(71,230,161)])]
        text(d,(W-130,790+oy),'لوحة الإدارة','ar',46,(255,255,255,int(255*p)),anchor='rm')
        cards=[('المستخدمون','12.4K',(45,123,255)),('الإيرادات','$8.2K',(71,230,161)),('الطلبات','312',(255,200,60))]
        for i,(t,v,c) in enumerate(cards):
            cx=125+i*285
            rrect(d,(cx,860+oy,cx+260,1030+oy),30,(28,32,52,int(255*p)),c+(int(255*p),),3)
            text(d,(cx+130,925+oy),v,'lb',50,(255,255,255,int(255*p)))
            text(d,(cx+130,990+oy),t,'ar',30,(190,198,225,int(255*p)))
        # animated bars
        for i in range(12):
            hgt=(60+((i*53)%170))*ease_out(clamp((lt-1.5-i*.06)/.5))
            x=130+i*72
            rrect(d,(x,1360+oy-hgt,x+48,1360+oy),10,(139,108,255,int(255*p)))
        text(d,(W/2,1450+oy),'مستخدمون • دفعات • عجلة • إشعارات • إعدادات','ar',34,(190,198,225,int(255*p)))
        for i,(t,c) in enumerate([('حظر',(255,59,130)),('منح نقاط',(71,230,161)),('إرسال',(45,123,255))]):
            x=170+i*260
            rrect(d,(x,1520+oy,x+230,1600+oy),40,c+(int(255*p),))
            text(d,(x+115,1560+oy),t,'ar',34,(255,255,255,int(255*p)))
    return L
def scene6(lt):
    L=new(); d=ImageDraw.Draw(L)
    p=ease_back(clamp(lt/.8)); pulse=1+.02*math.sin(lt*5)
    g=new(); gd=ImageDraw.Draw(g); gd.ellipse((W/2-330,640-330,W/2+330,640+330),fill=(255,59,130,110)); L.alpha_composite(g.filter(ImageFilter.GaussianBlur(70)))
    paste_center(L,icon,W/2,640,(520/icon.width)*p*pulse)
    q=ease_out(clamp((lt-.5)/.6)); d=ImageDraw.Draw(L)
    text(d,(W/2,1060),'tikboost.wh','lb',104,(255,255,255,int(255*q)),stroke=3)
    text(d,(W/2,1190),'حمّل التطبيق الآن','ar',74,(255,214,102,int(255*q)))
    btn=ease_back(clamp((lt-1.0)/.6)); bp=1+.04*math.sin(lt*6)
    bx=Image.new('RGBA',(760,170),(0,0,0,0)); bd=ImageDraw.Draw(bx)
    rrect(bd,(0,0,760,170),85,(255,59,130,255),(255,255,255,255),6)
    text(bd,(380,85),'DOWNLOAD NOW','lb',64,(255,255,255,255))
    paste_center(L,bx,W/2,1450,btn*bp)
    q2=ease_out(clamp((lt-1.6)/.6))
    text(d,(W/2,1640),'GOOGLE PLAY','lb',44,(139,232,255,int(255*q2)))
    text(d,(W/2,1720),'مكافآت  •  عجلة الحظ  •  مستويات  •  ٣ لغات','ar',38,(190,198,225,int(255*q2)))
    return L

SCENES=[(0,S2,scene1),(S2,S3,scene2),(S3,S4,scene3),(S4,S5,scene4),(S5,S6,scene5 if False else scene5),(S6,DUR,scene6)]
# scene5 spans S5..S6 ; reorder timings explicit
SCENES=[(0,S2,scene1),(S2,S3,scene2),(S3,S4,scene3),(S4,S5,scene4),(S5,S6,scene5),(S6,DUR+1,scene6)]
XF=.35
def frame(t):
    base=background(t)
    for st,en,fn in SCENES:
        if t<st-XF*0 or t>=en+XF: continue
        lt=t-st
        f=1.0
        if st>0 and t<st+XF: f=clamp((t-st)/XF)
        if en<DUR and t>en-XF: f=min(f,clamp((en+XF*0-t)/XF)) if False else min(f,clamp((en-t)/XF)*1.0+0)
        if f<=0: continue
        L=fn(clamp(lt,0,1e9))
        base.alpha_composite(fade_layer(L,f))
    return base.convert('RGB')

if __name__=='__main__':
    out=sys.argv[1] if len(sys.argv)>1 and not sys.argv[1].startswith('--') else '/home/claude/work/out/tikboost_promo.mp4'
    limit=NF
    if '--test' in sys.argv:
        for tt in [1.8,7.0,8.8,11.2,12.9,16.5,20.5,24.5]:
            frame(tt).save(f'/tmp/f_{int(tt*10)}.png')
        sys.exit()
    cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/claude/gen/video/music.wav',
         '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',out]
    pr=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for i in range(limit):
        pr.stdin.write(frame(i/FPS).tobytes())
        if i%90==0: print('frame',i,flush=True)
    pr.stdin.close(); pr.wait(); print('done',out)
