from typing import Literal
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.engine import extract, example, fit

app = FastAPI(title='MathSketch numerical engine')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:3000','http://127.0.0.1:3000'], allow_methods=['*'], allow_headers=['*'])

class FitRequest(BaseModel):
    contours: list[list[tuple[float,float]]] = Field(min_length=1, max_length=24)
    method: Literal['fourier','spline','bezier'] = 'fourier'
    harmonics: int = Field(12, ge=1, le=64)
    smoothing: float = Field(8, ge=1, le=16)
    tolerance: float = Field(.05, ge=.001, le=1)

@app.get('/health')
def health(): return {'status':'ok'}

@app.get('/examples/{name}')
def get_example(name: str):
    try: return {'contours':example(name)}
    except ValueError as e: raise HTTPException(400,str(e))

@app.post('/extract')
async def upload(file: UploadFile=File(...), threshold: int=Query(180,ge=1,le=254), minimum: float=Query(.001,ge=.00001,le=.1)):
    if file.content_type not in ['image/png','image/jpeg','image/webp']:
        raise HTTPException(415,'Upload a PNG, JPG, or WebP image.')
    data=await file.read(10*1024*1024+1)
    if len(data)>10*1024*1024: raise HTTPException(413,'Images must be under 10 MB.')
    try:
        contours, metadata=extract(data,threshold,minimum)
        return {'contours':contours,'metadata':metadata}
    except ValueError as e: raise HTTPException(422,str(e))

@app.post('/fit')
def reconstruct(req: FitRequest):
    if any(len(c)>4096 for c in req.contours): raise HTTPException(422,'Too many contour points.')
    try: return {'curves':[fit(c,req.method,req.harmonics,req.smoothing,req.tolerance) for c in req.contours]}
    except ValueError as e: raise HTTPException(422,str(e))

@app.post('/benchmark')
def benchmark(req: FitRequest):
    if len(req.contours[0])>4096: raise HTTPException(422,'Too many contour points.')
    try:
        rows=[]
        for n in [1,2,4,8,16,32,64]:
            c=fit(req.contours[0],'fourier',harmonics=n)
            rows.append({k:c[k] for k in ['method','parameters','error','milliseconds']} | {'segments':0})
        for tolerance in [.5,.2,.1,.05,.02,.005]:
            c=fit(req.contours[0],'bezier',tolerance=tolerance)
            rows.append({k:c[k] for k in ['method','parameters','error','milliseconds']} | {'segments':len(c['segments'])})
        return {'measurements':rows}
    except ValueError as e: raise HTTPException(422,str(e))
