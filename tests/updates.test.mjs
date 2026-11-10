import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUpdates,collectUpdates,updatesFolder} from '../scripts/updates.mjs';

test('date headings split updates; nested Markdown, reference links and fenced code remain intact',()=>{
  const posts=parseUpdates(Buffer.from('\uFEFF# 09.11.2026\r\nOlder entry.\r\n# 2026-11-10\r\n## Release\r\n\r\n- **New module**\r\n  - Nested item\r\n\r\n1. First\r\n2. Second\r\n\r\n[Download][file]\r\n\r\n```md\r\n# this is code, not an update\r\n```\r\n\r\n[file]: https://example.com/release'));
  assert.deepEqual(posts.map(post=>post.date),['2026-11-10','2026-11-09']);
  assert.match(posts[0].html,/<h2>Release<\/h2>/);
  assert.match(posts[0].html,/<strong>New module<\/strong>/);
  assert.match(posts[0].html,/<ol>/);assert.match(posts[0].html,/<ul>/);
  assert.match(posts[0].html,/href="https:\/\/example.com\/release" target="_blank" rel="noopener noreferrer"/);
  assert.match(posts[0].html,/# this is code, not an update/);
});

test('raw HTML and unsafe Markdown URLs cannot become active content',()=>{
  const [{html}]=parseUpdates(Buffer.from('# 10.11.2026\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![bad](javascript:alert(1))\n\n<strong onclick="alert(1)">raw</strong>'));
  assert.doesNotMatch(html,/<script|<strong onclick|(?:href|src)="javascript:/);
  assert.match(html,/&lt;script&gt;/);
});

test('invalid dates fail clearly; empty files and same-day entries are supported',()=>{
  for(const heading of ['31.02.2026','2026-13-01','Release notes'])assert.throws(()=>parseUpdates(Buffer.from('# '+heading+'\nText'),'UPDATES_ru.md'),/UPDATES_ru.md: invalid update date/);
  assert.throws(()=>parseUpdates(Buffer.from('Text without date')),/start each update/);
  assert.deepEqual(parseUpdates(Buffer.from(' \n')),[]);
  assert.equal(parseUpdates(Buffer.from('# 10.11.2026\nOne\n# 10.11.2026\nTwo')).length,2);
});

test('only exact update filenames in the shared root are loaded and a missing language stays empty',async()=>{
  const calls=[];
  const drive={list:async id=>{assert.equal(id,updatesFolder);return [{id:'ru',name:'UPDATES_ru.md'},{id:'other',name:'notes.md'}];},download:async(file,limit)=>{calls.push(file.id);assert.equal(limit,1024*1024);return Buffer.from('# 10.11.2026\nНовость');}};
  const result=await collectUpdates(drive);
  assert.deepEqual(calls,['ru']);assert.equal(result.ru.length,1);assert.deepEqual(result.en,[]);
  await assert.rejects(collectUpdates({list:async()=>[{name:'UPDATES_ru.md'},{name:'UPDATES_ru.md'}]}),/Duplicate UPDATES_ru.md/);
});
