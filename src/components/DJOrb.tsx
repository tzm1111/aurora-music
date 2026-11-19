import { useEffect, useRef, useState } from 'react';

const VERTEX = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT = `
precision mediump float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float state;
float field(vec3 p){
  return sin(p.x*3.7+sin(p.y*2.9))*sin(p.y*3.1+cos(p.z*3.3))*.6
    +sin(p.z*4.2+p.x*2.1)*.3+sin(p.x*7.3+p.y*4.1+p.z*5.)*.1;
}
vec3 palette(float f){
  vec3 cyan=vec3(.05,.82,.92), blue=vec3(.14,.24,.9);
  vec3 purple=vec3(.68,.19,.94), pink=vec3(1.,.35,.59);
  vec3 c=mix(cyan,blue,smoothstep(-.85,-.05,f));
  c=mix(c,purple,smoothstep(-.1,.48,f));
  return mix(c,pink,smoothstep(.4,.9,f));
}
void main(){
  vec2 uv=(gl_FragCoord.xy/resolution-.5)*2.08;
  float r=dot(uv,uv);
  if(r>1.02){gl_FragColor=vec4(0.);return;}
  float z=sqrt(max(0.,1.-r));
  vec3 n=normalize(vec3(uv,z));
  vec3 p=vec3(uv,z)+vec3(pointer*.17,0.);
  float t=time*.22;
  p.xy=mat2(cos(t),-sin(t),sin(t),cos(t))*p.xy;
  p+=vec3(sin(t*.6)*.28,cos(t*.7)*.18,t*.8);
  float f=field(p*1.12);
  float ribbon=pow(1.-abs(sin(f*5.2+t*.6)),3.);
  vec3 col=palette(f)*(.15+.67*ribbon);
  // 球体内部的光带在不同深度叠加，而非贴在平面上的渐变。
  for(int i=1;i<4;i++){
    float depth=float(i)*.23;
    float inner=field(p+vec3(0.,depth,-depth*2.));
    float band=pow(1.-abs(sin(inner*5.+t*.7+depth)),4.);
    col+=palette(inner)*band*(.24+state*.08)*z;
  }
  float light=max(0.,dot(n,normalize(vec3(-.55,.7,1.))));
  col*=.42+.68*light;
  float rim=pow(1.-z,3.);
  col+=mix(vec3(.08,.54,.8),vec3(.56,.25,.9),uv.y*.5+.5)*rim*.75;
  float spec=pow(max(0.,dot(n,normalize(vec3(-.35,.48,1.)))),45.);
  col+=vec3(.73,.94,1.)*spec*.46;
  col+=vec3(.18,.48,.6)*pow(max(0.,dot(n,normalize(vec3(.6,-.65,.45)))),12.)*.2;
  gl_FragColor=vec4(col,1.-smoothstep(.98,1.02,r));
}`;

export function DJOrb({ animate, phase }: { animate: boolean; phase: 'idle' | 'starting' | 'listening' | 'thinking' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ animate, phase });
  const wake = useRef<(() => void) | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => { settings.current = { animate, phase }; wake.current?.(); }, [animate, phase]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) return;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return false;
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return false;
      gl.attachShader(program, shader); return true;
    };
    if (!compile(gl.VERTEX_SHADER, VERTEX) || !compile(gl.FRAGMENT_SHADER, FRAGMENT)) {
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); return;
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); return; }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const uniforms = { resolution: gl.getUniformLocation(program,'resolution'), pointer: gl.getUniformLocation(program,'pointer'), time: gl.getUniformLocation(program,'time'), state: gl.getUniformLocation(program,'state') };
    let frame = 0, previous = 0, elapsed = 0, lost = false;
    const cursor = { x: 0, y: 0 };
    const resize = () => {
      const size = Math.max(1, Math.round(element.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
      element.width = size; element.height = size; gl.viewport(0,0,size,size);
      wake.current?.();
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      cursor.x = (event.clientX-rect.left)/rect.width-.5; cursor.y = .5-(event.clientY-rect.top)/rect.height;
      wake.current?.();
    };
    const reset = () => { cursor.x = 0; cursor.y = 0; wake.current?.(); };
    const parent = element.parentElement;
    parent?.addEventListener('pointermove',move); parent?.addEventListener('pointerleave',reset);
    const draw = (now: number) => {
      frame = 0;
      if (lost) return;
      const delta = Math.min((now-previous)/1000,.1);
      if (!settings.current.animate || now-previous >= 1000/30) {
        previous = now;
        const { animate: moving, phase: current } = settings.current;
        if (moving) elapsed += delta * (current === 'thinking' ? 2.6 : current === 'listening' ? 1.6 : .65);
        gl.uniform2f(uniforms.resolution,element.width,element.height);
        gl.uniform2f(uniforms.pointer,cursor.x,cursor.y);
        gl.uniform1f(uniforms.time,elapsed);
        gl.uniform1f(uniforms.state,current === 'listening' ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
      if (settings.current.animate && !document.hidden) frame = requestAnimationFrame(draw);
    };
    wake.current = () => { if (!frame && !lost) frame = requestAnimationFrame(draw); };
    const onLost = () => { lost = true; cancelAnimationFrame(frame); setReady(false); };
    element.addEventListener('webglcontextlost',onLost);
    setReady(true); frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      wake.current = undefined;
      parent?.removeEventListener('pointermove',move); parent?.removeEventListener('pointerleave',reset);
      element.removeEventListener('webglcontextlost',onLost);
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    };
  }, []);
  return <><span className="orb-fallback" aria-hidden="true"/><canvas ref={canvas} className={`orb-volume ${ready ? 'is-rendered' : ''}`} aria-hidden="true"/><span className="orb-glass" aria-hidden="true"/></>;
}
