import {test} from 'node:test';
import assert from 'node:assert/strict';
import {annualRain,comparisonAnnualRain} from './annualRain.js';
const current={valor:900,unidad:'mm/año',fuente:'INAMHI',periodo:'2000–2019'};
test('la referencia anual valida valor, unidad y procedencia sin perder el cero',()=>{
  assert.equal(annualRain({...current,valor:0}).valor,0);
  for(const patch of [{valor:null},{valor:-1},{valor:Infinity},{unidad:'mm/ciclo'},{fuente:''}])assert.equal(annualRain({...current,...patch}),null);
});
test('la comparación distingue la referencia guardada de la consultada ahora',()=>{
  const run={lluvia_anual_referencia:{...current,valor:1000}};
  assert.equal(comparisonAnnualRain(run,current).reference.valor,1000);
  assert.equal(comparisonAnnualRain(run,current).saved,true);
  assert.equal(comparisonAnnualRain({},current).saved,false);
  assert.equal(comparisonAnnualRain({},null),null);
});
