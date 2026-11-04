import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectPair,parseDescription,createDrive,collect,build} from '../scripts/sync.mjs';

const folderType='application/vnd.google-apps.folder';
test('pairs require both files; English is supplementary; ambiguous and duplicate files fail',()=>{
  assert.equal(selectPair([{name:'Alpha.md'}],'Alpha'),null);
  assert.equal(selectPair([{name:'Alpha.en.md'},{name:'Alpha.png'}],'Alpha'),null);
  const files=[{name:'Alpha.md'},{name:'Alpha.png'},{name:'Alpha.en.md'}];
  assert.equal(selectPair(files,'Renamed folder').en.name,'Alpha.en.md');
  assert.throws(()=>selectPair([...files,{name:'Beta.md'},{name:'Beta.png'}],'Other'),/Ambiguous/);
  assert.throws(()=>selectPair([...files,{name:'Alpha.png'}],'Alpha'),/Ambiguous/);
});
test('UTF-8 titles and text survive; HTML remains text for safe browser rendering',()=>{
  assert.deepEqual(parseDescription(Buffer.from('\uFEFF# Мир\r\n\r\n<script>alert(1)</script>'),'Fallback'),{title:'Мир',description:'<script>alert(1)</script>'});
  assert.throws(()=>parseDescription(Buffer.from([0xff]),'Fallback'));
});
test('Drive listing follows pagination and keeps credentials out of request URLs',async()=>{
  const calls=[];
  const drive=createDrive('test-key',async(url,options)=>{
    calls.push(String(url));assert.equal(options.headers['X-Goog-Api-Key'],'test-key');assert.ok(!String(url).includes('test-key'));
    return new Response(JSON.stringify(calls.length===1?{files:[{id:'first'}],nextPageToken:'page2'}:{files:[{id:'second'}]}));
  });
  assert.deepEqual((await drive.list('folder')).map(x=>x.id),['first','second']);
  assert.ok(new URL(calls[1]).searchParams.get('pageToken')==='page2');
});
test('API errors do not log responses that might contain credentials',async()=>{
  const drive=createDrive('private-key',async()=>new Response('private-key',{status:403}));
  await assert.rejects(drive.list('folder'),error=>error.message.includes('HTTP 403')&&!error.message.includes('private-key'));
  assert.throws(()=>createDrive('1'),/real Google Drive API key/);
});
test('catalogue skips incomplete projects, preserves folder links, and downloads only metadata assets',async()=>{
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(320,16);png.writeUInt32BE(160,20);
  const calls=[];
  const drive={list:async id=>id==='root'?[
    {id:'project',name:'Alpha',mimeType:folderType,webViewLink:'https://drive.google.com/drive/folders/project?resourcekey=abc'},
    {id:'incomplete',name:'Beta',mimeType:folderType},
    {id:'archive',name:'files.zip',mimeType:'application/zip'}
  ]:id==='project'?[{id:'md',name:'Alpha.md'},{id:'en',name:'Alpha.en.md'},{id:'png',name:'Alpha.png'},{id:'zip',name:'Alpha.zip'}]:[{id:'partial',name:'Beta.md'}],download:async file=>{calls.push(file.id);return file.id==='png'?png:Buffer.from(file.id==='en'?'# English\n\nEnglish text':'# Русский\n\nРусский текст');}};
  const result=await collect(drive,[{id:'systems',folder:'root'}]);
  assert.equal(result.catalog.categories[0].items.length,1);assert.equal(result.scanned,2);
  assert.equal(result.catalog.categories[0].items[0].title.en,'English');
  assert.match(result.catalog.categories[0].items[0].url,/resourcekey=abc/);
  assert.deepEqual(calls,['md','en','png']);assert.equal(result.banners[0].image,'assets/banners/project.png');
});
test('failed source reads leave output untouched',async()=>{
  const root=await mkdtemp(join(tmpdir(),'odt-sync-test-'));
  await assert.rejects(build({root,drive:{list:async()=>{throw Error('Drive unavailable');}}}),/Drive unavailable/);
  await assert.rejects(access(join(root,'dist')));
});
