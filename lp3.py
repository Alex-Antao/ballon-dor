import json,numpy as np
from scipy.optimize import linprog
D=json.load(open('feats.json'))
ATT={'FW','W','AM'}
def feat(rows):
    mx=max(r['f'][0] for r in rows); mu=max(r['f'][3] for r in rows)
    out=[]
    for r in rows:
        f=r['f']
        gm=max(q['g'] for q in rows)
        att=1 if r['pos'] in ATT else 0
        out.append(f+[f[0]/mx, f[3]/mu if mu else 0, att, r['g']/gm, 1 if r['uS']>=4 else 0, (f[0]/mx)*(1 if r['uS']==5 else 0), f[5]*att, 1 if r['ntS']>=4 else 0, f[0]/mx*f[8]])
    return out
names=['prod','uStage','uWin','uProd','ntStage','ntWin','wcFinal','ntProd','title','cont','prodRel','uProdRel','isAtt','goalsRel','uFinal','uWinXprod','ntWinXatt','ntFinal','prodXtitle']
free={12}
F={y:feat(D[y]['rows']) for y in D}
train=[y for y in D if D[y]['real'] and int(y)<=2025]
def fit(years,reg=0.02):
    A=[];n=len(names)
    for y in years:
        rows=D[y]['rows'];idx=[i for i,r in enumerate(rows) if r['n']==D[y]['real']][0]
        for i in range(len(rows)):
            if i!=idx:A.append(np.array(F[y][idx])-np.array(F[y][i]))
    A=np.array(A);m=len(A)
    c=np.r_[reg*np.ones(n),np.ones(m)]
    Aub=np.c_[-A,-np.eye(m)];bub=-0.05*np.ones(m)
    res=linprog(c,A_ub=Aub,b_ub=bub,bounds=[((-3,3) if i in free else (0,3)) for i in range(n)]+[(0,None)]*m)
    return res.x[:n],res.x[n:].sum()
def pred(w,y):
    s=[(float(np.dot(w,f)),r['n']) for f,r in zip(F[y],D[y]['rows'])];s.sort(reverse=True);return s
w,t=fit(train);print('slack',t);print({a:round(float(b),3) for a,b in zip(names,w)})
ok=sum(pred(w,y)[0][1]==D[y]['real'] for y in train);print('in-sample',ok,len(train))
for y in train:
    p=pred(w,y)[0][1]
    if p!=D[y]['real']:print(' miss',y,D[y]['real'],'->',p)
loo=sum(pred(fit([z for z in train if z!=y])[0],y)[0][1]==D[y]['real'] for y in train);print('LOO',loo)
json.dump({'weights':[round(float(x),4) for x in w],'inSample':int(ok),'loo':int(loo),'n':len(train)},open('fit-result.json','w'));print('2026',[(round(a,2),b) for a,b in pred(w,'2026')[:4]])
