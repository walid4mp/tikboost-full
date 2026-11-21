import numpy as np, wave, os
SR=44100
OUT='/home/claude/work/tikboost-full-main/flutter-app/assets/audio'
def t(d): return np.arange(int(SR*d))/SR
def env(n,a=0.005,r=0.2,curve=3.0):
    e=np.ones(n); na=max(1,int(a*SR)); e[:na]=np.linspace(0,1,na)
    nr=n-na; e[na:]=np.exp(-curve*np.linspace(0,1,nr)*(1.0/max(r,1e-3))*r*5) if False else np.exp(-np.linspace(0,1,nr)*curve*5/ (1))
    return e
def bell(f,d,vol=1.0,decay=6.0,bright=1.0):
    x=t(d); s=np.zeros_like(x)
    for k,(m,a) in enumerate([(1,1),(2.01,.45*bright),(3.02,.22*bright),(4.7,.1*bright),(6.1,.05*bright)]):
        s+=a*np.sin(2*np.pi*f*m*x)*np.exp(-x*decay*(1+.35*k))
    na=int(.003*SR); s[:na]*=np.linspace(0,1,na)
    return s*vol
def pluck(f,d,vol=1.0,decay=14):
    x=t(d); s=np.sin(2*np.pi*f*x)+.4*np.sin(2*np.pi*2*f*x)+.15*np.sin(2*np.pi*3*f*x)
    s*=np.exp(-x*decay); na=int(.002*SR); s[:na]*=np.linspace(0,1,na); return s*vol
def mix(parts,total):
    out=np.zeros(int(SR*total))
    for start,s in parts:
        i=int(start*SR); n=min(len(s),len(out)-i)
        if n>0: out[i:i+n]+=s[:n]
    return out
def save(name,x,peak=.85):
    x=x/ (np.max(np.abs(x))+1e-9)*peak
    n=int(.004*SR); x[-n:]*=np.linspace(1,0,n)
    # gentle stereo-free soft clip
    x=np.tanh(x*1.1)/np.tanh(1.1)
    with wave.open(os.path.join(OUT,name),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype('<i2').tobytes())
N=lambda m: 440*2**((m-69)/12)
# tap: soft glassy pop
save('tap.wav',mix([(0,pluck(N(88),.09,1,40)),(0,pluck(N(76),.12,.5,30))],.12),.55)
# wheel ticks: 3 variants, woody click
for i,(f,dc) in enumerate([(1500,90),(1750,95),(1300,85)],1):
    x=t(.05); s=np.sin(2*np.pi*f*x*(1-.15*x*20))*np.exp(-x*dc)+.5*np.sin(2*np.pi*f*2.3*x)*np.exp(-x*dc*1.6)
    s+=np.random.RandomState(i).randn(len(x))*np.exp(-x*400)*.25
    save(f'spin_tick_{i}.wav',s,.7)
save('spin_tick.wav',pluck(1600,.05,1,90),.7)
# spin start whoosh + rising sparkle
x=t(.7); sweep=np.sin(2*np.pi*(300*x+ 900*x**2))*np.sin(np.pi*x/.7)**1.5
noise=np.random.RandomState(7).randn(len(x)); 
k=np.ones(40)/40; noise=np.convolve(noise,k,'same')*np.sin(np.pi*x/.7)**2
save('spin_start.wav',sweep*.6+noise*1.2,.6)
# win fanfare: major arpeggio + sparkle
notes=[72,76,79,84,88]
parts=[(i*.085,bell(N(n),1.3,.8,4.5)) for i,n in enumerate(notes)]
parts+=[(.45,bell(N(84),1.6,.7,3.5)),(.45,bell(N(88),1.6,.5,3.5)),(.45,bell(N(91),1.6,.5,3.5))]
sp=[(.5+i*.06,bell(N(96+(i*5)%12),.35,.25,8)) for i in range(10)]
save('wheel_win.wav',mix(parts+sp,2.2),.88)
# notify: two-note chime
save('notify.wav',mix([(0,bell(N(79),.9,.9,6)),(.13,bell(N(86),1.1,.9,5.5))],1.3),.8)
# coin: classic two blip
save('coin.wav',mix([(0,pluck(N(83),.09,1,18)+.3*pluck(N(95),.09,1,25)),(.07,pluck(N(88),.35,1,9)+.3*pluck(N(100),.35,1,12))],.45),.7)
# level up: rising scale + chord
sc=[60,64,67,72,76,79,84]
parts=[(i*.075,bell(N(n),.9,.8,5)) for i,n in enumerate(sc)]
parts+=[(.6,bell(N(m),2,.7,2.8)) for m in (72,76,79,88)]
save('level_up.wav',mix(parts,2.6),.9)
# no win: soft descending
save('wheel_nowin.wav',mix([(0,bell(N(72),.6,.6,7)),(.12,bell(N(67),.8,.6,6)),(.26,bell(N(60),1,.6,5))],1.3),.6)
# error
save('error.wav',mix([(0,pluck(N(55),.18,1,16)),(.11,pluck(N(50),.3,1,12))],.5),.6)
print(os.listdir(OUT))
