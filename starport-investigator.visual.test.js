const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/starport-investigator.html', 'utf8');
assert.ok(html.includes('class="title-shell"'), 'title must use the case-desk hero shell');
assert.ok(html.includes('class="case-preview"'), 'title must show a visual case preview');
assert.ok(html.includes('接入案件系统'), 'primary action must name the action clearly');
assert.ok(html.includes('class="review-focus"'), 'final review must expose critical focus');
console.log('VISUAL-STRUCTURE-OK');
