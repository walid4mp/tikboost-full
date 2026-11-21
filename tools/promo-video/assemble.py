# Builds the single final ad from the user's REAL screen recordings.
import sys, os, json, math, subprocess
import numpy as np
sys.argv_backup=sys.argv; sys.argv=['x']
sys.path.insert(0,'/home/claude/gen/video')
from render import (W,H,FPS,font,text,clamp,ease_out,ease_back,background,icon,new,rrect,paste_center,fade_layer,Image,ImageDraw,ImageFilter)
sys.argv=sys.argv_backup
U='/mnt/user-data/uploads/'
V1,V2=U+'985948.mp4',U+'985951.mp4'
FW=640  # phone screen width on the 1080x1920 canvas

# ---------------------------------------------------------------- storyboard (all footage is the user's)
S=[
 dict(id='hook',kind='hook',dur=6.0,lines=[('ماذا لو كان نشاطك',(255,255,255),84),('على تيك توك',(255,214,102),104),('يمنحك نقاطاً ومكافآت؟',(139,232,255),80)]),
 dict(id='splash',kind='phone',src=V1,ss=5.2,clip=3.6,speed=1.0,ct=0,title='tikboost.wh',sub='TIKBOOST.WH',
      caps=[(0.3,3.9,'تطبيق يجمع المهام والحملات والمكافآت في مكان واحد')]),
 dict(id='signup',kind='phone',src=V1,ss=13,clip=21,speed=1.4,ct=72,title='ابدأ في ثوانٍ',sub='CREATE YOUR ACCOUNT',
      caps=[(0.2,5,'1  أنشئ حسابك بالاسم والبريد وكلمة المرور'),(5,10,'2  كود الدعوة اختياري'),(10,15.2,'3  مكافأة ترحيبية 5000 نقطة عند الانضمام')]),
 dict(id='home',kind='phone',src=V1,ss=50.2,clip=8,speed=0.8,ct=72,title='الرئيسية',sub='YOUR DASHBOARD',
      caps=[(0.2,5,'رصيدك ومستواك في مكان واحد'),(5,10,'مهام اليوم وإجراءات سريعة')]),
 dict(id='tasks',kind='phone',src=V2,ss=159.5,clip=11.5,speed=0.9,ct=72,title='اكسب نقاطاً بالمهام',sub='EARN POINTS',
      caps=[(0.2,4.2,'اختر مهمة: متابعة أو إعجاب أو مشاهدة أو تعليق'),(4.2,8.5,'نفّذها ثم يتم التحقق منها'),(8.5,12.8,'تُضاف النقاط بعد التحقق')]),
 dict(id='camp',kind='phone',src=V2,ss=55,clip=6.4,speed=0.8,ct=72,blur=[(30,300,700,410)],title='أنشئ حملتك',sub='CREATE A CAMPAIGN',
      caps=[(0.2,3,'اختر النوع: متابعون • إعجابات • مشاهدات • تعليقات'),(3,5.8,'حدّد الكمية والاستهداف (الجنس والدولة لمشتركي VIP)'),(5.8,8,'التكلفة تُخصم من نقاطك')]),
 dict(id='wheel',kind='phone',src=V1,ss=129,clip=12,speed=0.75,ct=72,title='عجلة الحظ',sub='LUCKY WHEEL',
      caps=[(0.2,6,'لفّات يومية داخل التطبيق'),(6,16,'ولفة إضافية بمشاهدة إعلان')]),
 dict(id='levels',kind='phone',src=V2,ss=14,clip=13,speed=1.0,ct=72,title='المستويات والمهام',sub='LEVELS & MISSIONS',
      caps=[(0.2,6,'ارتقِ بين المستويات'),(6,13,'مهام يومية وأسبوعية وإنجازات ومكافآت للاستلام')]),
 dict(id='shop',kind='phone',src=V1,ss=102,clip=7.5,speed=0.88,ct=138,title='المتجر والاشتراكات',sub='STORE & VIP',
      caps=[(0.2,4.2,'باقات نقاط واشتراكات VIP'),(4.2,8.5,'الدفع عبر Google Play أو طرق أخرى مُتاحة')]),
 dict(id='notif',kind='image',dur=4.5,title='إشعار فوري',sub='INSTANT NOTIFICATIONS',img=U+'985950.jpg',box=(40,290,1040,615),
      caps=[(0.3,4.5,'تصلك إشعارات عند اعتماد اشتراكك')]),
 dict(id='pay',kind='phone',src=V2,ss=203,clip=9,speed=1.0,ct=72,title='طلبات الدفع وحالتها',sub='PAYMENT STATUS',
      caps=[(0.2,9,'تابع حالة كل طلب دفع بوضوح')]),
 dict(id='lang',kind='phone',src=V1,ss=113,clip=10,speed=1.0,ct=72,title='٣ لغات',sub='ARABIC • ENGLISH • FRANÇAIS',
      caps=[(0.2,10,'العربية • English • Français')]),
 dict(id='outro',kind='outro',dur=12.0),
]
t=0
for s in S:
    s['d']=s.get('dur') if s['kind'] in('hook','image','outro') else s['clip']/s['speed']
    s['t0']=t; t+=s['d']
TOTAL=t
print('total',TOTAL,flush=True)

# ---------------------------------------------------------------- phone bezel
def phone_asset(w,h):
    pad=14
    ph=Image.new('RGBA',(w+pad*2,h+pad*2),(0,0,0,0)); d=ImageDraw.Draw(ph)
    d.rounded_rectangle((0,0,w+pad*2-1,h+pad*2-1),radius=58,fill=(12,13,22,255),outline=(125,132,178,255),width=4)
    return ph,pad
def screen_mask(w,h,r=44):
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=r,fill=255); return m

def decode(src,ss,clip,speed,ct,blur):
    h=1600-ct
    sh=int(round(FW*h/720/2)*2)
    vf=f"crop=720:{h}:0:{ct},scale={FW}:{sh},setpts=PTS/{speed},fps={FPS}"
    cmd=['ffmpeg','-loglevel','error','-ss',str(ss),'-t',str(clip),'-i',src,'-vf',vf,'-an','-f','rawvideo','-pix_fmt','rgb24','-']
    p=subprocess.Popen(cmd,stdout=subprocess.PIPE)
    n=FW*sh*3
    while True:
        b=p.stdout.read(n)
        if len(b)<n: break
        im=Image.frombuffer('RGB',(FW,sh),b,'raw','RGB',0,1)
        if blur:
            for (x0,y0,x1,y1) in blur:
                sx=FW/720; box=(int(x0*sx),int((y0-ct)*sx),int(x1*sx),int((y1-ct)*sx))
                reg=im.crop(box).filter(ImageFilter.GaussianBlur(14)); im.paste(reg,box[:2])
        yield im
    p.stdout.close(); p.wait()

def caption_layer(lines_by_time,lt):
    cur=None
    for a,b,tx in lines_by_time:
        if a<=lt<b: cur=(a,b,tx); break
    if not cur: return None
    a,b,tx=cur
    p=ease_out(clamp((lt-a)/.35))*clamp((b-lt)/.25+.0001 if b-lt<.25 else 1)
    L=Image.new('RGBA',(W,300),(0,0,0,0)); d=ImageDraw.Draw(L)
    f=font('ar',44)
    # wrap
    words=tx.split(' '); lines=[];c=''
    for w_ in words:
        tt=(c+' '+w_).strip()
        if d.textlength(tt,font=f,language='ar')>860 and c: lines.append(c); c=w_
        else: c=tt
    lines.append(c)
    hh=len(lines)*62+34
    d.rounded_rectangle((70,40,W-70,40+hh),radius=38,fill=(8,10,24,int(220*p)),outline=(139,232,255,int(180*p)),width=3)
    for i,l in enumerate(lines): d.text((W/2,40+17+31+i*62),l,font=f,fill=(255,255,255,int(255*p)),anchor='mm',language='ar')
    return L

_PC={}
def _phone_cache(w,h):
    k=(w,h)
    if k not in _PC:
        ph,pad=phone_asset(w,h)
        glow=Image.new('RGBA',(w+260,h+260),(0,0,0,0)); ImageDraw.Draw(glow).rounded_rectangle((130,130,w+130,h+130),radius=60,fill=(139,108,255,120)); glow=glow.filter(ImageFilter.GaussianBlur(50))
        _PC[k]=(ph,pad,glow,screen_mask(w,h))
    return _PC[k]

def render_phone(sc,lt,src_im,intro,outro_a):
    L=new(); d=ImageDraw.Draw(L)
    # title
    p=ease_out(clamp(lt/.6))
    oy=(1-p)*50
    text(d,(W/2,150+oy),sc['title'],'ar' if any('\u0600'<=c<='\u06FF' for c in sc['title']) else 'lb',74 if sc['title']!='tikboost.wh' else 92,(255,255,255,int(255*p)),stroke=3)
    text(d,(W/2,238+oy),sc['sub'],'lb',34,(139,232,255,int(255*p)))
    # phone
    w,h=src_im.size
    base_ph,pad,glow,m=_phone_cache(w,h)
    ph=base_ph.copy(); ph.paste(src_im.convert('RGBA'),(pad,pad),m)
    k=ease_back(clamp(lt/.7)); sc_=(.86+.14*min(1.0,k)) if lt<.75 else 1.0
    bob=math.sin(lt*1.6)*5
    cx,cy=W/2,300+(h+pad*2)/2+(1-min(1.0,k))*70+bob
    G=glow if sc_>=.999 else glow.resize((int(glow.width*sc_),int(glow.height*sc_)))
    L.alpha_composite(G,(int(cx-G.width/2),int(cy-G.height/2)))
    P=ph if sc_>=.999 else ph.resize((int(ph.width*sc_),int(ph.height*sc_)),Image.BILINEAR)
    L.alpha_composite(P,(int(cx-P.width/2),int(cy-P.height/2)))
    c=caption_layer(sc['caps'],lt)
    if c: L.alpha_composite(c,(0,1640))
    return L

def render_hook(sc,lt):
    L=new(); d=ImageDraw.Draw(L)
    for k in range(4):
        rp=clamp((lt*.7-k*.18)%1.0); r=int(120+rp*820)
        d.ellipse((W/2-r,900-r,W/2+r,900+r),outline=(139,108,255,int(120*(1-rp))),width=5)
    y=640
    for i,(txt,col,sz) in enumerate(sc['lines']):
        p=ease_back(clamp((lt-.2-i*.8)/.5))
        if p>0:
            g=new(); gd=ImageDraw.Draw(g); text(gd,(W/2,y),txt,'ar',max(8,int(sz*p)),col+(255,)); L.alpha_composite(g.filter(ImageFilter.GaussianBlur(18)))
            text(d,(W/2,y),txt,'ar',max(8,int(sz*p)),col+(255,),stroke=3)
        y+=sz+70
    q=ease_back(clamp((lt-3.4)/.6))
    paste_center(L,icon,W/2,1420,(300/icon.width)*q)
    text(d,(W/2,1640),'tikboost.wh','lb',70,(255,255,255,int(255*clamp((lt-3.8)/.5))),stroke=3)
    return L

def render_image(sc,lt,img):
    L=new(); d=ImageDraw.Draw(L)
    p=ease_out(clamp(lt/.6)); oy=(1-p)*50
    text(d,(W/2,150+oy),sc['title'],'ar',74,(255,255,255,int(255*p)),stroke=3)
    text(d,(W/2,238+oy),sc['sub'],'lb',34,(139,232,255,int(255*p)))
    k=ease_back(clamp(lt/.7)); w0,h0=img.size
    pad=14; ph=Image.new('RGBA',(w0+pad*2,h0+pad*2),(0,0,0,0)); pd=ImageDraw.Draw(ph)
    pd.rounded_rectangle((0,0,w0+pad*2-1,h0+pad*2-1),radius=40,fill=(12,13,22,255),outline=(125,132,178,255),width=4)
    ph.paste(img.convert('RGBA'),(pad,pad),screen_mask(w0,h0,30))
    glow=Image.new('RGBA',(w0+300,h0+300),(0,0,0,0)); ImageDraw.Draw(glow).rounded_rectangle((150,150,w0+150,h0+150),radius=60,fill=(71,230,161,110)); glow=glow.filter(ImageFilter.GaussianBlur(50))
    s=.8+.2*k; cx,cy=W/2,860
    G=glow.resize((int(glow.width*s),int(glow.height*s))); L.alpha_composite(G,(int(cx-G.width/2),int(cy-G.height/2)))
    P=ph.resize((int(ph.width*s),int(ph.height*s)),Image.LANCZOS); L.alpha_composite(P,(int(cx-P.width/2),int(cy-P.height/2)))
    c=caption_layer(sc['caps'],lt)
    if c: L.alpha_composite(c,(0,1640))
    return L

def render_outro(sc,lt):
    L=new(); d=ImageDraw.Draw(L)
    g=new(); gd=ImageDraw.Draw(g); gd.ellipse((W/2-340,470-340,W/2+340,470+340),fill=(255,59,130,110)); L.alpha_composite(g.filter(ImageFilter.GaussianBlur(70)))
    p=ease_back(clamp(lt/.8)); paste_center(L,icon,W/2,470,(420/icon.width)*p*(1+.02*math.sin(lt*5)))
    q=ease_out(clamp((lt-.5)/.6))
    text(d,(W/2,800),'اكتشف تجربة','ar',70,(255,255,255,int(255*q)),stroke=3)
    text(d,(W/2,905),'tikboost.wh','lb',112,(255,214,102,int(255*q)),stroke=3)
    text(d,(W/2,1010),'بنفسك!','ar',70,(255,255,255,int(255*q)),stroke=3)
    b=ease_back(clamp((lt-1.2)/.6))
    bx=Image.new('RGBA',(820,190),(0,0,0,0)); bd=ImageDraw.Draw(bx)
    rrect(bd,(0,0,820,190),95,(255,59,130,255),(255,255,255,255),6)
    text(bd,(410,95),'حمّل التطبيق الآن','ar',64,(255,255,255,255))
    paste_center(L,bx,W/2,1190,b*(1+.03*math.sin(lt*6)))
    w=ease_out(clamp((lt-2.0)/.6))
    if w>0:
        rrect(d,(120,1340,960,1600),50,(21,24,36,int(245*w)),(139,232,255,int(255*w)),4)
        text(d,(W/2,1400),'الموقع الرسمي','ar',38,(190,198,225,int(255*w)))
        text(d,(W/2,1510),'WHSTO.com','lb',96,(139,232,255,int(255*w)))
    z=ease_out(clamp((lt-3.0)/.6))
    text(d,(W/2,1690),'النقاط والمكافآت داخل التطبيق فقط • المزايا والأسعار قد تتغير','ar',30,(190,198,225,int(200*z)))
    return L

# ---------------------------------------------------------------- main loop
def frames():
    prev=None
    for sc in S:
        n=int(round(sc['d']*FPS))
        if sc['kind']=='phone':
            gen=decode(sc['src'],sc['ss'],sc['clip'],sc['speed'],sc['ct'],sc.get('blur'))
            last=None
        elif sc['kind']=='image':
            im=Image.open(sc['img']).convert('RGB').crop(sc['box']); im=im.resize((900,int(900*im.height/im.width)),Image.LANCZOS)
        for i in range(n):
            lt=i/FPS; gt=sc['t0']+lt
            if sc['kind']=='phone':
                try: last=next(gen)
                except StopIteration: pass
                L=render_phone(sc,lt,last,None,None)
            elif sc['kind']=='hook': L=render_hook(sc,lt)
            elif sc['kind']=='image': L=render_image(sc,lt,im)
            else: L=render_outro(sc,lt)
            f=1.0
            if sc['t0']>0 and lt<.35: f=clamp(lt/.35)
            if sc['kind']!='outro' and sc['d']-lt<.35: f=min(f,clamp((sc['d']-lt)/.35))
            base=background(gt)
            base.alpha_composite(fade_layer(L,f))
            yield gt,base.convert('RGB')
        if sc['kind']=='phone':
            for _ in gen: pass

def scene_frames(i):
    sc=S[i]; n=int(round(sc['d']*FPS))
    if sc['kind']=='phone':
        gen=decode(sc['src'],sc['ss'],sc['clip'],sc['speed'],sc['ct'],sc.get('blur')); last=None
    elif sc['kind']=='image':
        im=Image.open(sc['img']).convert('RGB').crop(sc['box']); im=im.resize((900,int(900*im.height/im.width)),Image.LANCZOS)
    for k in range(n):
        lt=k/FPS; gt=sc['t0']+lt
        if sc['kind']=='phone':
            try: last=next(gen)
            except StopIteration: pass
            L=render_phone(sc,lt,last,None,None)
        elif sc['kind']=='hook': L=render_hook(sc,lt)
        elif sc['kind']=='image': L=render_image(sc,lt,im)
        else: L=render_outro(sc,lt)
        f=1.0
        if sc['t0']>0 and lt<.35: f=clamp(lt/.35)
        if sc['kind']!='outro' and sc['d']-lt<.35: f=min(f,clamp((sc['d']-lt)/.35))
        base=background(gt); base.alpha_composite(fade_layer(L,f))
        yield base.convert('RGB')
    if sc['kind']=='phone':
        for _ in gen: pass

def render_part(i):
    os.makedirs('/tmp/parts',exist_ok=True)
    out=f'/tmp/parts/part_{i:02d}.mp4'
    if os.path.exists(out): return
    tmp=out+'.tmp.mp4'
    cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',tmp]
    pr=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for im in scene_frames(i): pr.stdin.write(im.tobytes())
    pr.stdin.close(); pr.wait(); os.rename(tmp,out); print('part',i,'done',flush=True)

def audio_events():
    ev={'ticks':[],'wins':[],'levelups':[],'pops':[]}
    for sc in S:
        ev['pops'].append(sc['t0']+.2)
        if sc['id']=='levels': ev['levelups'].append(sc['t0']+8)
    json.dump(ev,open('/home/claude/gen/video/ticks.json','w'))

if __name__=='__main__':
    if '--test' in sys.argv:
        for i,sc in enumerate(S):
            lt=min(sc['d']-.5,3.5 if sc['kind']!='phone' else sc['d']*.5)
            if sc['kind']=='phone':
                im=next(decode(sc['src'],sc['ss']+lt*sc['speed'],.5,1.0,sc['ct'],sc.get('blur')))
                L=render_phone(sc,lt,im,None,None)
            elif sc['kind']=='hook': L=render_hook(sc,lt)
            elif sc['kind']=='image':
                img=Image.open(sc['img']).convert('RGB').crop(sc['box']); img=img.resize((900,int(900*img.height/img.width)),Image.LANCZOS)
                L=render_image(sc,lt,img)
            else: L=render_outro(sc,lt+1.0)
            base=background(sc['t0']+lt); base.alpha_composite(L); base.convert('RGB').save(f'/tmp/as_{i:02d}.png')
        sys.exit()
    if '--part' in sys.argv:
        render_part(int(sys.argv[sys.argv.index('--part')+1])); sys.exit()
    audio_events()
    env=dict(os.environ,PROMO_DUR=str(TOTAL))
    subprocess.run(['python3','/home/claude/gen/video/make_audio.py'],check=True,env=env)
    out='/home/claude/work/out/tikboost_ad_final.mp4'
    cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/claude/gen/video/music.wav',
         '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',out]
    pr=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    k=0
    for gt,im in frames():
        pr.stdin.write(im.tobytes()); k+=1
        if k%150==0: print('t=%.1f / %.1f'%(gt,TOTAL),flush=True)
    pr.stdin.close(); pr.wait(); print('done',out,flush=True)
