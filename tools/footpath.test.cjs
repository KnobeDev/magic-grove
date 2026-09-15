const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(target = { x: 0, z: 12 }, reduced = false) {
  const source = fs.readFileSync(path.join(__dirname, '../grove/grove-stations.js'), 'utf8');
  const section = source.slice(source.indexOf('  const PATH ='), source.indexOf('  /* ---------- per-frame marker animation'));
  const listeners = [];
  const media = {
    matches: reduced,
    addEventListener(type, callback) { if (type === 'change') listeners.push(callback); },
    addListener(callback) { listeners.push(callback); },
  };
  const context = {
    window: { GROVE: { player: { pos: { x: 0, z: 0 } }, blockers: [] }, matchMedia: () => media },
    document: { getElementById: () => null }, S: {},
    guideTarget: () => ({ key: 'test', reach: 2, ...target }), terrainAt: () => 0,
  };
  vm.createContext(context);
  vm.runInContext(section + '\n globalThis.api = { PATH, updatePath };', context);
  const { PATH, updatePath } = context.api;
  PATH.group = {};
  PATH.prints = Array.from({ length: 20 }, () => ({
    visible: false,
    position: { set(x, y, z) { Object.assign(this, { x, y, z }); } },
    rotation: { set(x, y, z) { Object.assign(this, { x, y, z }); } },
    material: { opacity: 0 },
  }));
  return {
    update: updatePath,
    visible: () => PATH.prints.filter(p => p.visible),
    reduce(value) { media.matches = value; listeners.forEach(fn => fn({ matches: value })); },
  };
}

for (const [x, z] of [[0, 12], [0, -12], [12, 0], [-12, 0]]) {
  test(`footprint toes point toward destination (${x}, ${z})`, () => {
    const h = harness({ x, z });
    h.update(0);
    for (const p of h.visible()) {
      // Plane local +Y is texture-up. Euler XYZ with X=-PI/2 maps it here.
      const toe = { x: -Math.sin(p.rotation.z), z: -Math.cos(p.rotation.z) };
      assert.ok(toe.x * x / 12 + toe.z * z / 12 > 0.999);
    }
  });
}

test('footfalls stay planted as animation time advances', () => {
  const h = harness();
  h.update(0);
  const positions = () => h.visible().map(p => [p.position.x, p.position.y, p.position.z]);
  const before = positions();
  h.update(0.5);
  assert.deepEqual(positions(), before);
});

test('short routes hide spare prints and keep 1.4 unit stride spacing', () => {
  const h = harness();
  h.update(0);
  const prints = h.visible();
  assert.ok(prints.length > 1 && prints.length < 20);
  for (let i = 1; i < prints.length; i++) {
    assert.ok(Math.abs(prints[i].position.z - prints[i - 1].position.z - 1.4) < 1e-9);
  }
  assert.ok(prints.every(p => p.material.opacity > 0), 'every visible footprint has nonzero opacity');
});

for (const initiallyReduced of [false, true]) {
  test(`reduced motion keeps opacity static (initial=${initiallyReduced})`, () => {
    const h = harness(undefined, initiallyReduced);
    h.update(0);
    if (!initiallyReduced) h.reduce(true);
    h.update(0.2);
    const before = h.visible().map(p => p.material.opacity);
    h.update(0.7);
    assert.deepEqual(h.visible().map(p => p.material.opacity), before);
  });
}
