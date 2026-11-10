import MarkdownIt from 'markdown-it';

export const updatesFolder='1GGMrKBs9yrrA02Oq3Z07Ly0SFZohV6Lg';
const markdown=new MarkdownIt({html:false});
const renderLink=markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open=(tokens,index,options,env,renderer)=>{
  tokens[index].attrSet('target','_blank');
  tokens[index].attrSet('rel','noopener noreferrer');
  return renderLink?renderLink(tokens,index,options,env,renderer):renderer.renderToken(tokens,index,options);
};

function parseDate(value,file){
  const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),local=value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const parts=iso?iso.slice(1):local?[local[3],local[2],local[1]]:null;
  if(parts){
    const [year,month,day]=parts.map(Number),date=new Date(Date.UTC(year,month-1,day));
    if(year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day)return parts.join('-');
  }
  throw Error(file+': invalid update date "'+value+'". Use # DD.MM.YYYY or # YYYY-MM-DD.');
}

export function parseUpdates(bytes,file='UPDATES.md'){
  const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').trim();
  if(!source)return [];
  const env={},tokens=markdown.parse(source,env),starts=[];
  tokens.forEach((token,index)=>{if(token.type==='heading_open'&&token.tag==='h1'&&token.level===0)starts.push(index);});
  if(starts[0]!==0)throw Error(file+': start each update with a # date heading.');
  return starts.map((start,index)=>({
    date:parseDate(tokens[start+1].content.trim(),file),
    html:markdown.renderer.render(tokens.slice(start+3,starts[index+1]??tokens.length),markdown.options,env)
  })).sort((a,b)=>b.date.localeCompare(a.date));
}

export async function collectUpdates(drive){
  const files=await drive.list(updatesFolder),updates={ru:[],en:[]};
  for(const language of ['ru','en']){
    const name='UPDATES_'+language+'.md',matches=files.filter(file=>file.name===name&&file.mimeType!=='application/vnd.google-apps.folder');
    if(matches.length>1)throw Error('Duplicate '+name+' in Shared TTRPG Materials.');
    if(!matches.length){console.log(name+': not found; updates feed is empty.');continue;}
    updates[language]=parseUpdates(await drive.download(matches[0],1024*1024),name);
    console.log(name+': '+updates[language].length+' updates');
  }
  return updates;
}
