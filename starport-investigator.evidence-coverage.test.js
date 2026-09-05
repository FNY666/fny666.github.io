const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/starport-investigator.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Proxy({}, {get(target,id){
  if(!target[id]) target[id]={textContent:'',innerHTML:'',value:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}};
  return target[id];
}});
const document={getElementById:id=>elements[id],querySelectorAll:()=>[]};
const sandbox={document,localStorage:{starportInvestBest:'0'},location:{href:''},console,Math,Set,Array,Number,String};
vm.createContext(sandbox); vm.runInContext(source,sandbox);
assert.strictEqual(typeof sandbox.getEvidenceLocation,'function','every case must have an evidence location mapping');
sandbox.CASES.forEach(c=>{
  const key=sandbox.getEvidenceLocation(c);
  const inspection=sandbox.buildEvidenceInspection(c,41+c.id);
  assert.ok(key,'case '+c.id+' must map to an evidence location');
  assert.strictEqual(inspection.items.length,3,'case '+c.id+' must expose three evidence regions');
  assert.ok(inspection.items.some(x=>x.kind==='fingerprint'),'case '+c.id+' must expose a fingerprint region');
  const match=inspection.items.find(x=>x.matches.includes(c.solution.culprit));
  assert.ok(match,'case '+c.id+' must have a matching suspect sample');
  const result=sandbox.compareEvidence(match,c.solution.culprit,inspection);
  assert.strictEqual(result.matched,true,'case '+c.id+' correct sample must match');
});
console.log('EVIDENCE-COVERAGE-OK');
