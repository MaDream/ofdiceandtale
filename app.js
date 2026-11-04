'use strict';
const strings = {
  ru: {eyebrow:'МАЛЕНЬКАЯ БИБЛИОТЕКА БОЛЬШИХ ИСТОРИЙ',footer:'Для миров, которые ещё предстоит придумать.',loading:'Открываем библиотеку…',assets:'Ассеты',systems:'Системы',modules:'Модули',compendiums:'Компендиумы',empty:'Новая глава ещё впереди.',folder:'Заглянуть в папку',open:'Открыть в Google Drive ↗',previous:'Предыдущие материалы',next:'Следующие материалы',updated:'Обновлено',pending:'Первые материалы скоро появятся',error:'Не удалось загрузить каталог.',retry:'Повторить',original:'Описание на русском',noDescription:'Описание скоро появится.'},
  en: {eyebrow:'A SMALL LIBRARY OF GREAT STORIES',footer:'For worlds yet to be imagined.',loading:'Opening the library…',assets:'Assets',systems:'Systems',modules:'Modules',compendiums:'Compendiums',empty:'The next chapter is still to come.',folder:'Explore the folder',open:'Open in Google Drive ↗',previous:'Previous materials',next:'Next materials',updated:'Updated',pending:'The first materials are on their way',error:'The catalogue could not be loaded.',retry:'Try again',original:'Description in Russian',noDescription:'Description coming soon.'}
};
const categories = [
  ['assets','11k3GYzmwPI9u3A6AwcEzRibGExI86vaw'],
  ['systems','1TvlxL9KEaLlbt00z2u4AYW-N7x9Ntl8T'],
  ['modules','1uinIDquoHnXHnD-hWI8eXXA22m7Z7Heo'],
  ['compendiums','1OHKVPLovpuDT6HghIZNLQSKFl7d3hNpC']
];
let savedLanguage; try {savedLanguage=localStorage.getItem('odt-language');} catch {}
let language = ['ru','en'].includes(savedLanguage) ? savedLanguage : ((navigator.languages || [navigator.language]).some(x=>/^ru(?:-|$)/i.test(x))?'ru':'en');
let catalogue = {updatedAt:null,categories:[]}, failed=false;
const main=document.querySelector('main'), preview=document.querySelector('#preview');
let currentCard=null, hideTimer;
const railObserver=new ResizeObserver(entries=>entries.forEach(entry=>entry.target.updateButtons?.()));
const text = key => strings[language][key];
function element(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;}
function driveUrl(value,fallback){try{const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='drive.google.com')return url.href;}catch{}return fallback;}
function closePreview(){clearTimeout(hideTimer);preview.hidden=true;currentCard=null;}
function laterClose(){hideTimer=setTimeout(()=>{if(!preview.contains(document.activeElement)&&document.activeElement!==currentCard)closePreview();},170);}
function placePreview(card){
  const rect=card.getBoundingClientRect(),box=preview.getBoundingClientRect();
  preview.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left+(rect.width-box.width)/2))+'px';
  preview.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top-16))+'px';
}
function showPreview(card,item,category,touch=false){
  clearTimeout(hideTimer);currentCard=card;
  preview.querySelector('img').src=item.image;
  preview.querySelector('h2').textContent=item.title?.[language]||item.title?.ru||item.name;
  preview.querySelector('.preview-category').textContent=text(category);
  const description=preview.querySelector('.preview-description');description.replaceChildren();description.scrollTop=0;
  if(language==='en'&&!item.description?.en)description.append(element('span','language-note',text('original')));
  const raw=item.description?.[language]||item.description?.ru||text('noDescription');
  // Descriptions are text, never executable HTML from Drive.
  raw.split(/\n\s*\n/).filter(Boolean).forEach(part=>description.append(element('p','',part.replace(/^#{1,6}\s+/gm,'').replace(/^[-*]\s+/gm,'• ').replace(/\*\*(.*?)\*\*/g,'$1'))));
  const link=preview.querySelector('.preview-link');link.href=card.href;link.textContent=text('open');
  preview.hidden=false;preview.style.visibility='hidden';
  placePreview(card);
  preview.style.visibility='';if(touch)preview.querySelector('.preview-close').focus({preventScroll:true});
}
preview.addEventListener('pointerenter',()=>clearTimeout(hideTimer));preview.addEventListener('pointerleave',laterClose);
preview.addEventListener('focusout',laterClose);preview.querySelector('.preview-close').addEventListener('click',()=>{const card=currentCard;closePreview();card?.focus({preventScroll:true});closePreview();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const card=currentCard;closePreview();card?.focus({preventScroll:true});closePreview();}});
document.addEventListener('pointerdown',event=>{if(!preview.contains(event.target)&&!event.target.closest('.card'))closePreview();});
window.addEventListener('resize',closePreview);window.addEventListener('scroll',()=>{if(currentCard&&document.activeElement===currentCard)placePreview(currentCard);else closePreview();});
function render(){
  closePreview();document.documentElement.lang=language;
  document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=text(node.dataset.i18n));
  document.querySelectorAll('[data-lang]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.lang===language)));
  railObserver.disconnect();main.replaceChildren();
  if(failed){const warning=element('p','error',text('error'));const retry=element('button','',text('retry'));retry.onclick=loadCatalogue;warning.append(retry);main.append(warning);}
  categories.forEach(([id,folder],index)=>{
    const category=catalogue.categories.find(x=>x.id===id),items=category?.items||[],url='https://drive.google.com/drive/folders/'+folder;
    const section=element('section','shelf'),heading=element('div','shelf-heading'),h2=element('h2');
    const number=element('span','section-number',String(index+1).padStart(2,'0')),link=element('a','',text(id));link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.append(element('span','section-arrow','↗'));h2.append(number,link);heading.append(h2);
    const controls=element('div','shelf-controls');controls.append(element('span','count',String(items.length).padStart(2,'0')));
    const rail=element('div','rail');rail.id='rail-'+id;
    const buttons=[['previous','←',-1],['next','→',1]].map(([label,symbol,direction])=>{const button=element('button','scroll-button',symbol);button.type='button';button.setAttribute('aria-label',text(label));button.setAttribute('aria-controls',rail.id);button.onclick=()=>{closePreview();rail.scrollBy({left:direction*(rail.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};controls.append(button);return button;});heading.append(controls);
    if(!items.length){const empty=element('div','empty');empty.append(element('span','empty-symbol','✧'));const copy=element('p','',text('empty'));const small=element('small'),folderLink=element('a','',text('folder')+' ↗');folderLink.href=url;folderLink.target='_blank';folderLink.rel='noopener noreferrer';small.append(folderLink);copy.append(small);empty.append(copy);rail.append(empty);}
    items.forEach(item=>{const card=element('a','card'),image=element('img'),title=item.title?.[language]||item.title?.ru||item.name;card.href=driveUrl(item.url,url);card.target='_blank';card.rel='noopener noreferrer';card.setAttribute('aria-label',title+' — '+text('open'));image.src=item.image;image.alt='';image.width=320;image.height=160;image.loading='lazy';image.decoding='async';card.append(image,element('span','card-title',title));card.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')showPreview(card,item,id);});card.addEventListener('pointerleave',laterClose);card.addEventListener('focus',()=>showPreview(card,item,id));card.addEventListener('blur',laterClose);card.addEventListener('click',event=>{if(matchMedia('(hover: none)').matches){event.preventDefault();showPreview(card,item,id,true);}});rail.append(card);});
    const updateButtons=()=>{buttons[0].disabled=rail.scrollLeft<2;buttons[1].disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;};
    rail.addEventListener('scroll',()=>{updateButtons();if(currentCard&&document.activeElement===currentCard)placePreview(currentCard);else closePreview();},{passive:true});rail.updateButtons=updateButtons;railObserver.observe(rail);
    section.append(heading,rail);main.append(section);requestAnimationFrame(updateButtons);
  });
  const updated=document.querySelector('#updated');
  updated.textContent=catalogue.updatedAt?text('updated')+' · '+new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(catalogue.updatedAt)):text('pending');
}
async function loadCatalogue(){main.setAttribute('aria-busy','true');try{const response=await fetch('data/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!Array.isArray(data.categories))throw Error('Invalid catalogue');catalogue=data;failed=false;}catch{failed=true;}finally{main.setAttribute('aria-busy','false');render();}}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{language=button.dataset.lang;try{localStorage.setItem('odt-language',language);}catch{}render();}));
render();loadCatalogue();
