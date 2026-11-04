import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const categories = [
  {id:'assets',folder:'11k3GYzmwPI9u3A6AwcEzRibGExI86vaw'},
  {id:'systems',folder:'1TvlxL9KEaLlbt00z2u4AYW-N7x9Ntl8T'},
  {id:'modules',folder:'1uinIDquoHnXHnD-hWI8eXXA22m7Z7Heo'},
  {id:'compendiums',folder:'1OHKVPLovpuDT6HghIZNLQSKFl7d3hNpC'}
];
const folderType='application/vnd.google-apps.folder';
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createDrive(key,fetcher=fetch){
  if(!key||key.trim()==='1')throw Error('Set GOOGLE_DRIVE_API_KEY to a real Google Drive API key in repository Actions secrets.');
  async function request(id,params={},limit=8*1024*1024){
    const url=new URL('https://www.googleapis.com/drive/v3/files'+(id?'/'+encodeURIComponent(id):''));
    url.search=new URLSearchParams(params).toString();
    for(let attempt=0;attempt<4;attempt++){
      // Never place the key in URLs, logs, generated files, or browser code.
      const response=await fetcher(url,{headers:{'X-Goog-Api-Key':key},signal:AbortSignal.timeout(30000)});
      if(!response.ok){
        if((response.status===429||response.status>=500)&&attempt<3){await delay(1000*2**attempt);continue;}
        throw Error('Drive request failed (HTTP '+response.status+'). Check that Drive API is enabled, the key allows Drive API, and the folders are public.');
      }
      if(Number(response.headers.get('content-length'))>limit)throw Error('Drive file exceeds the download size limit.');
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>limit){throw Error('Drive response exceeds the download size limit.');}chunks.push(chunk);}
      const bytes=Buffer.concat(chunks);
      return params.alt==='media'?bytes:JSON.parse(bytes.toString('utf8'));
    }
  }
  return {
    async list(folder){
      if(!/^[\w-]+$/.test(folder))throw Error('Invalid Drive folder ID.');
      const files=[];let pageToken='';const pages=new Set();
      do{const data=await request('',{q:"'"+folder+"' in parents and trashed = false",pageSize:'1000',fields:'nextPageToken,files(id,name,mimeType,webViewLink,size)',...(pageToken?{pageToken}: {})});
        files.push(...(data.files||[]));pageToken=data.nextPageToken||'';
        if(pageToken&&pages.has(pageToken))throw Error('Drive returned a repeated pagination token.');pages.add(pageToken);
      }while(pageToken);
      return files;
    },
    download(file,maxBytes){if(Number(file.size)>maxBytes)throw Error('Description or banner is too large.');return request(file.id,{alt:'media'},maxBytes);}
  };
}
export function selectPair(files,folderName){
  const stem=folderName.replace(/\[[^\]]*\]/g,'').trim().replace(/\s+/g,' ');
  if(!stem)return null;
  const findOne=suffix=>{
    const matches=files.filter(file=>file.name===stem+suffix&&file.mimeType!==folderType);
    if(matches.length>1)throw Error('Ambiguous duplicate metadata file in project '+folderName+'.');
    return matches[0];
  };
  const md=findOne('_ru.md'),en=findOne('_en.md'),png=findOne('_banner.png');
  return md&&en&&png?{stem,md,en,png}:null;
}
export function parseDescription(bytes,fallback){
  const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trim();
  const heading=value.match(/^#\s+(.+)(?:\n|$)/);
  return {title:heading?heading[1].trim():fallback,description:heading?value.slice(heading[0].length).trim():value};
}
function safeDriveLink(value,id){try{const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='drive.google.com')return url.href;}catch{}return 'https://drive.google.com/drive/folders/'+encodeURIComponent(id);}
export async function collect(drive,groups=categories){
  const catalog={updatedAt:null,categories:[]},banners=[];let scanned=0;
  for(const group of groups){
    const children=await drive.list(group.folder),items=[],visited=new Set([group.folder]);
    async function visit(project){
      if(visited.has(project.id))return;
      visited.add(project.id);
      scanned++;if(!/^[\w-]+$/.test(project.id))throw Error('Invalid project ID.');
      const files=await drive.list(project.id),pair=selectPair(files,project.name);
      if(pair){
        const ru=parseDescription(await drive.download(pair.md,256*1024),pair.stem);
        const en=parseDescription(await drive.download(pair.en,256*1024),pair.stem);
        const png=await drive.download(pair.png,8*1024*1024);
        if(png.length<24||!png.subarray(0,8).equals(pngSignature))throw Error('A banner with .png extension is not a valid PNG.');
        if(png.readUInt32BE(16)!==320||png.readUInt32BE(20)!==160)console.warn('A banner is not 320×160; it will be displayed with a 2:1 crop.');
        const image='assets/banners/'+project.id+'.png';banners.push({image,bytes:png});
        items.push({id:project.id,name:project.name,title:{ru:ru.title,en:en.title},description:{ru:ru.description,en:en.description},image,url:safeDriveLink(project.webViewLink,project.id)});
      }
      for(const child of files.filter(file=>file.mimeType===folderType))await visit(child);
    }
    for(const project of children.filter(file=>file.mimeType===folderType))await visit(project);
    items.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    console.log(group.id+': '+items.length+' cards');
    catalog.categories.push({...group,url:'https://drive.google.com/drive/folders/'+group.folder,items});
  }
  catalog.updatedAt=new Date().toISOString();return {catalog,banners,scanned};
}
export async function build({root=resolve('.'),offline=false,drive}={}){
  // Collect everything before writing output: failed reads never become an empty published catalogue.
  const result=offline?{catalog:JSON.parse(await readFile(join(root,'data/catalog.json'),'utf8')),banners:[],scanned:0}:await collect(drive||createDrive(process.env.GOOGLE_DRIVE_API_KEY));
  const out=join(root,'dist');await mkdir(join(out,'assets/banners'),{recursive:true});await mkdir(join(out,'data'),{recursive:true});
  for(const file of ['index.html','styles.css','app.js','CNAME','assets/logo.png'])await copyFile(join(root,file),join(out,file));
  for(const banner of result.banners)await writeFile(join(out,banner.image),banner.bytes);
  await writeFile(join(out,'data/catalog.json'),JSON.stringify(result.catalog,null,2)+'\n');
  await writeFile(join(out,'.nojekyll'),'');
  console.log(offline?'Built initial site without Drive sync.':'Drive sync complete: '+result.scanned+' folders scanned, '+result.banners.length+' cards published.');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  build({offline:process.argv.includes('--offline')}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
