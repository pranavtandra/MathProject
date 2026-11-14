import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.engine import resample, cartesian, fourier, evaluate_fourier, fit, bezier, rmse, example, extract
from backend.main import app

def test_circle():
    t=np.arange(256)*2*np.pi/256
    p=np.c_[3*np.cos(t),3*np.sin(t)]
    assert rmse(p,evaluate_fourier(fourier(p),1))<1e-10

def test_synthetic_fourier():
    p=example('heart')[0]['points']
    c=fourier(p)
    assert rmse(resample(p),evaluate_fourier(c,127))<.005
    assert rmse(resample(p),evaluate_fourier(c,16))<rmse(resample(p),evaluate_fourier(c,2))

def test_resampling():
    p=resample([[0,0],[1,0],[1,1],[0,1]],8)
    assert np.allclose(np.linalg.norm(np.roll(p,-1,axis=0)-p,axis=1),.5)
    with pytest.raises(ValueError):resample([[0,0]]*3)

def test_coordinates():
    assert np.allclose(cartesian([[0,0],[100,50]],100,50),[[-10,5],[10,-5]])

def test_bezier():
    controls=[[0,0],[0,1],[1,1],[1,0]]
    assert np.allclose(bezier(controls,[0,.5,1]),[[0,0],[.5,.75],[1,0]])

def test_spline_export_and_continuity():
    c=fit(example('heart')[0]['points'],'spline')
    pol=np.array(c['polynomial']); knots=np.array(c['knots'])
    for i in range(len(pol)):
        dt=knots[i+1]-knots[i]; a=pol[i]; b=pol[(i+1)%len(pol)]
        assert np.allclose(np.sum(a*np.array([dt**3,dt**2,dt,1]),axis=1),b[:,3])
        assert np.allclose(3*a[:,0]*dt**2+2*a[:,1]*dt+a[:,2],b[:,2])
        assert np.allclose(6*a[:,0]*dt+2*a[:,1],2*b[:,1])
    for j,p in enumerate(c['points']):
        t=j/256;i=np.searchsorted(knots,t,side='right')-1;u=t-knots[i]
        assert np.allclose(np.array(pol[i])@np.array([u**3,u*u,u,1]),p)

def test_bezier_export_consistency():
    c=fit(example('star')[0]['points'],'bezier')
    for s in c['segments']:
        lo=round(s['start']*256);hi=round(s['end']*256)
        assert np.allclose(bezier(s['control'],np.arange(hi-lo)/(hi-lo)),c['points'][lo:hi])
    assert c['error']<.06

def test_error():assert rmse([[0,0],[0,0]],[[3,4],[3,4]])==5

def encoded(image):return cv2.imencode('.png',image)[1].tobytes()

def test_holes_and_disconnected():
    im=np.full((200,300,3),255,np.uint8)
    cv2.circle(im,(70,100),50,(0,0,0),-1);cv2.circle(im,(70,100),20,(255,255,255),-1)
    cv2.rectangle(im,(200,50),(250,150),(0,0,0),-1)
    paths,_=extract(encoded(im));assert len(paths)==3;assert any(p['hole'] for p in paths)

def test_empty_and_malformed():
    with pytest.raises(ValueError):extract(encoded(np.full((100,100,3),255,np.uint8)))
    with pytest.raises(ValueError):extract(b'bad')

def test_api_validation():
    client=TestClient(app)
    assert client.post('/fit',json={'contours':[]}).status_code==422
    assert client.post('/extract',files={'file':('bad.txt',b'bad','text/plain')}).status_code==415
    assert client.get('/examples/abstract').status_code==200

def test_open_stroke_and_noise():
    im=np.full((200,200,3),255,np.uint8);cv2.line(im,(20,20),(170,160),(0,0,0),5)
    paths,_=extract(encoded(im));assert len(paths)>=1
    for method in ['fourier','spline','bezier']:
        c=fit(example('abstract')[0]['points'],method);assert np.isfinite(c['error'])
