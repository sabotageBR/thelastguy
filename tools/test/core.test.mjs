import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hash32 } from '../../src/core/rng.js';
import { piecewise, stepwise, wrapAngle, approach } from '../../src/core/dmath.js';

test('Rng é determinístico e serializável', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const s = a.serialize();
  const x = a.next();
  const c = new Rng(0);
  c.deserialize(s);
  assert.equal(c.next(), x);
});

test('Rng.int e shuffle ficam no intervalo', () => {
  const r = new Rng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(5);
    assert.ok(v >= 0 && v < 5 && Number.isInteger(v));
  }
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  r.shuffle(arr);
  assert.deepEqual([...arr].sort((p, q) => p - q), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('hash32 separa entradas diferentes', () => {
  assert.notEqual(hash32(1, 2), hash32(2, 1));
  assert.equal(hash32('abc', 3), hash32('abc', 3));
});

test('funções de dmath', () => {
  assert.equal(piecewise([[0, 1], [10, 2]], 5), 1.5);
  assert.equal(stepwise([[0, 1], [15, 2], [30, 3]], 20), 2);
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9);
  assert.equal(approach(0, 10, 3), 3);
  assert.equal(approach(9, 10, 3), 10);
});
