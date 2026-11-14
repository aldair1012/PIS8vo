import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroFertilizacion, validarProductoFertilizante } from './fertilizerInput.js';
test('fertilizantes conservan dígitos y decimales, sin aceptar texto ni separadores ambiguos',()=>{
  assert.equal(numeroFertilizacion('100'),100);
  assert.equal(numeroFertilizacion('46,5'),46.5);
  assert.equal(numeroFertilizacion('0'),0);
  for(const value of ['3,500','100abc','-1','',Infinity]) assert.equal(numeroFertilizacion(value),null);
});
test('la composición y el precio se validan sin inventar un precio obligatorio',()=>{
  const urea={dosis:'100',N:'46',P:'0',K:'0',Mg:'0',S:'0',precio:''};
  assert.equal(validarProductoFertilizante(urea),null);
  assert.match(validarProductoFertilizante({...urea,N:'110'}),/0 y 100/);
  assert.match(validarProductoFertilizante({...urea,precio:'abc'}),/precio/);
});
