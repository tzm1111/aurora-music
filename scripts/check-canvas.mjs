import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = await fs.readFile(new URL('../src/lib/canvasLayout.ts', import.meta.url), 'utf8');
const dir = new URL('../node_modules/.tmp/', import.meta.url); await fs.mkdir(dir, { recursive: true });
const target = new URL('canvas-layout.mjs', dir);
await fs.writeFile(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText);
const { fitCanvas, ringGeometry } = await import(target);
globalThis.window = { devicePixelRatio: 3 };
const transforms = [];
const canvas = { clientWidth: 440, clientHeight: 440, width: 0, height: 0, getBoundingClientRect() { throw new Error('Must not measure the animated transform'); } };
assert.deepEqual(fitCanvas(canvas, { setTransform: (...args) => transforms.push(args) }), { width: 440, height: 440 });
assert.equal(canvas.width, 880); assert.equal(canvas.height, 880); assert.deepEqual(transforms[0], [2,0,0,2,0,0]);
for (const [width,height,cover] of [[440,440,158.4],[260,260,100],[2488,1000,198],[280,280,118],[1400,280,130]]) {
  const ring = ringGeometry(width,height,cover);
  assert.equal(ring.cx,width/2); assert.equal(ring.cy,height/2);
  for(let i=0;i<128;i++) {
    const a=i/128*Math.PI*2;
    const radius=ring.baseRadius+ring.amplitude;
    const x=ring.cx+Math.cos(a)*radius, y=ring.cy+Math.sin(a)*radius;
    assert.ok(x>=7.99&&x<=width-7.99&&y>=7.99&&y<=height-7.99);
  }
}
console.log('Passed: animation transform independence, bounded high-DPR buffers, centered circles and unclipped peak amplitudes on desktop/mobile.');
