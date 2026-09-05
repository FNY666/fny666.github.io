const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/starport-investigator.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Proxy({}, {get(target, id) {
  if (!target[id]) target[id] = {
    textContent: '', innerHTML: '', value: '', style: {}, dataset: {},
    classList: {add(){}, remove(){}, toggle(){}},
    addEventListener(){}, querySelectorAll(){return []}
  };
  return target[id];
}});
const document = {
  getElementById: id => elements[id],
  querySelectorAll: () => []
};
const sandbox = {
  document,
  localStorage: {starportInvestBest: '0'},
  location: {href: ''},
  console,
  Math,
  Set,
  Array,
  Number,
  String
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.strictEqual(typeof sandbox.buildReviewReport, 'function', 'review generator must exist');
const report = sandbox.buildReviewReport({solved: 4, total: 8, score: 450, attempts: 10, clueRate: 0.72});
assert.strictEqual(report.players.length, 5, 'must generate five player reviews');
assert.strictEqual(report.experts.length, 3, 'must generate three expert reviews');
assert.ok(report.players.every(x => x.kind === 'player'), 'player reviews must be typed');
assert.ok(report.experts.every(x => x.kind === 'expert'), 'expert reviews must be typed');
assert.ok(report.critical && report.critical.length > 20, 'report must name the critical issue');
assert.ok(report.next && report.next.length > 10, 'report must name one next priority');
assert.ok(report.players.every(x => Number.isInteger(x.rating) && x.rating >= 1 && x.rating <= 5), 'ratings must be 1-5');
assert.ok(!report.critical.includes('物证比对结果还没有进入定案判定'), 'review must not claim evidence is disconnected from verdict');
assert.ok(!report.next.includes('不只是增加证据数量'), 'review must not describe the old evidence-only limitation');
console.log('REVIEW-BEHAVIOR-OK');
