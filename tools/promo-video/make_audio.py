import numpy as np, wave, sys
import os
SR=44100; DUR=float(os.environ.get('PROMO_DUR','26'))
N=lambda m: 440*2**((m-69)/12)
def t(d): return np.arange(int(SR*d))/SR
buf=np.zeros(int(SR*DUR)+SR)
def add(start,s,vol=1.0):
    i=int(start*SR); n=min(len(s),len(buf)-i)
    if n>0: buf[i:i+n]+=s[:n]*vol
rs=np.random.RandomState(3)
def kick():
    x=t(.28); f=110*np.exp(-x*22)+42; ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-x*9)
def hat(o=False):
    x=t(.25 if o else .05); n=rs.randn(len(x)); n=np.diff(n,prepend=0)
    return n*np.exp(-x*(18 if o else 90))*.5
def clap():
    x=t(.18); n=rs.randn(len(x)); k=np.ones(8)/8; n=np.convolve(n,k,'same')
    return n*np.exp(-x*22)*.9
def bass(m,d):
    x=t(d); s=np.sin(2*np.pi*N(m)*x)+.5*np.sin(2*np.pi*N(m)*2*x)*np.exp(-x*6)
    return s*np.minimum(1,x*200)*np.exp(-x*3.2)
def pluck(m,d=.35,v=1):
    x=t(d); s=np.sin(2*np.pi*N(m)*x)+.5*np.sin(2*np.pi*N(m)*2.01*x)+.25*np.sin(2*np.pi*N(m)*3*x)
    return s*np.exp(-x*11)*v*np.minimum(1,x*400)
def pad(ms,d,v=.25):
    x=t(d); s=sum(np.sin(2*np.pi*N(m)*x)+.4*np.sin(2*np.pi*N(m)*x*1.005) for m in ms)/len(ms)
    e=np.minimum(1,x*3)*np.minimum(1,(d-x)*3)
    return s*e*v
bpm=124; beat=60/bpm
chords=[(57,[69,72,76]),(53,[65,69,72]),(48,[67,72,76]),(55,[67,71,74])]  # Am F C G
bars=int(DUR/(beat*4))+1
for b in range(bars):
    t0=b*beat*4
    root,ch=chords[b%4]
    if t0<DUR: add(t0,pad(ch,beat*4,.22))
    for k in range(4):
        tk=t0+k*beat
        if tk>=DUR: break
        if tk>=3.0 or True:
            add(tk,kick(),.95)
        if k in (1,3) and tk>=3.2: add(tk,clap(),.5)
        for h in range(2):
            th=tk+h*beat/2
            if th>=1.0: add(th+beat/4 if False else th+beat/4,hat(),.35)
        if tk>=3.2: add(tk,bass(root-12,beat*.9),.55); add(tk+beat/2,bass(root-12,beat*.4),.4)
    if t0>=3.2:
        for k in range(8):
            tk=t0+k*beat/2
            if tk<DUR: add(tk,pluck(ch[k%3]+12,.3,.5),.38)
# riser before the outro
x=t(2.0); r=rs.randn(len(x)); r=np.convolve(r,np.ones(6)/6,'same')*(x/2.0)**2*.5
add(max(0.0,DUR-6.5),r,.5)
# sfx
def bell(m,d,decay=5):
    x=t(d); s=sum(a*np.sin(2*np.pi*N(m)*mm*x)*np.exp(-x*decay*(1+.3*i)) for i,(mm,a) in enumerate([(1,1),(2.01,.45),(3.02,.2)]))
    return s*np.minimum(1,x*300)
for m,tt in [(81,.3),(88,.5)]: add(tt,bell(m,1.2),.5)               # logo sparkle
# spin ticks (matches video wheel timing)
import json
ev=json.load(open('/home/claude/gen/video/ticks.json'))
for tt,vol in ev['ticks']:
    xx=t(.04); add(tt,np.sin(2*np.pi*1500*xx)*np.exp(-xx*100),.45*vol)
for tt in ev['wins']:
    for i,m in enumerate([72,76,79,84,88]): add(tt+i*.07,bell(m,1.4,4),.45)
for tt in ev['levelups']:
    for i,m in enumerate([60,64,67,72,76,79,84]): add(tt+i*.06,bell(m,1,5),.35)
for tt in ev['pops']:
    xx=t(.12); add(tt,np.sin(2*np.pi*(500+3000*xx)*xx)*np.exp(-xx*30),.4)
# master: gentle compression + fades
buf=buf[:int(SR*DUR)]
buf=np.tanh(buf*1.15)
buf/= np.max(np.abs(buf)); buf*=.88
f=int(SR*.6); buf[:f]*=np.linspace(0,1,f); buf[-int(SR*1.5):]*=np.linspace(1,0,int(SR*1.5))
with wave.open('/home/claude/gen/video/music.wav','wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((buf*32767).astype('<i2').tobytes())
print('audio ok')
