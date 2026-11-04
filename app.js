'use strict';
const strings = {
  ru: {eyebrow:'Для авторов историй, которые еще предстоит рассказать.',loading:'Открываем библиотеку…',assets:'Ассеты',systems:'Системы',modules:'Модули',compendiums:'Компендиумы',empty:'Новая глава ещё впереди.',folder:'Заглянуть в папку',open:'Открыть в Google Drive ↗',updated:'Обновлено',pending:'Первые материалы скоро появятся',error:'Не удалось загрузить каталог.',retry:'Повторить',original:'Описание на русском',noDescription:'Описание скоро появится.'},
  en: {eyebrow:'For authors of stories yet to be told.',loading:'Opening the library…',assets:'Assets',systems:'Systems',modules:'Modules',compendiums:'Compendiums',empty:'The next chapter is still to come.',folder:'Explore the folder',open:'Open in Google Drive ↗',updated:'Updated',pending:'The first materials are on their way',error:'The catalogue could not be loaded.',retry:'Try again',original:'Description in Russian',noDescription:'Description coming soon.'}
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
  if(!card.isConnected)return;
  clearTimeout(hideTimer);currentCard=card;
  preview.querySelector('img').src=item.image;
  const imageLink=preview.querySelector('.preview-image-link');imageLink.href=card.href;imageLink.setAttribute('aria-label',text('open'));
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
  main.replaceChildren();
  if(failed){const warning=element('p','error',text('error'));const retry=element('button','',text('retry'));retry.onclick=loadCatalogue;warning.append(retry);main.append(warning);}
  categories.forEach(([id,folder],index)=>{
    const category=catalogue.categories.find(x=>x.id===id),items=category?.items||[],url='https://drive.google.com/drive/folders/'+folder;
    const section=element('section','shelf'),heading=element('div','shelf-heading'),h2=element('h2');
    const number=element('span','section-number',String(index+1).padStart(2,'0')),link=element('a','',text(id));link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.append(element('span','section-arrow','↗'));h2.append(number,link);heading.append(h2);
    const rail=element('div','rail');rail.id='rail-'+id;
    if(!items.length){const empty=element('div','empty');empty.append(element('span','empty-symbol','✧'));const copy=element('p','',text('empty'));const small=element('small'),folderLink=element('a','',text('folder')+' ↗');folderLink.href=url;folderLink.target='_blank';folderLink.rel='noopener noreferrer';small.append(folderLink);copy.append(small);empty.append(copy);rail.append(empty);}
    let active=0,previewTimer,lastPointerX,lastPointerY;
    const cards=[];
    function activate(index,show=false,animate=true){
      active=index;clearTimeout(previewTimer);closePreview();
      cards.forEach((card,i)=>{card.classList.toggle('is-active',i===active);card.classList.toggle('is-before',i<active);card.classList.toggle('is-after',i>active);});
      const card=cards[active];if(!card)return;
      rail.scrollTo({left:card.offsetLeft-(rail.clientWidth-card.offsetWidth)/2,behavior:!animate||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      if(show)previewTimer=setTimeout(()=>{
        if(card.matches(':hover')||document.activeElement===card)showPreview(card,items[active],id);
      },450);
    }
    items.forEach((item,index)=>{
      const card=element('a','card'),image=element('img'),title=item.title?.[language]||item.title?.ru||item.name;
      card.href=driveUrl(item.url,url);card.target='_blank';card.rel='noopener noreferrer';card.setAttribute('aria-label',title+' — '+text('open'));
      image.src=item.image;image.alt='';image.width=320;image.height=160;image.loading='lazy';image.decoding='async';
      card.append(image,element('span','card-title',title));
      card.addEventListener('pointermove',event=>{
        if(event.pointerType==='touch'||(event.clientX===lastPointerX&&event.clientY===lastPointerY))return;
        lastPointerX=event.clientX;lastPointerY=event.clientY;
        if(index!==active)activate(index,true);
        else if(preview.hidden){clearTimeout(previewTimer);previewTimer=setTimeout(()=>showPreview(card,item,id),450);}
      });
      card.addEventListener('pointerleave',()=>{clearTimeout(previewTimer);laterClose();});
      card.addEventListener('focus',()=>activate(index,true));card.addEventListener('blur',laterClose);
      card.addEventListener('click',event=>{if(matchMedia('(hover: none)').matches){event.preventDefault();if(index!==active)activate(index);else showPreview(card,item,id,true);}});
      card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();cards[Math.max(0,Math.min(cards.length-1,index+(event.key==='ArrowRight'?1:-1)))].focus({preventScroll:true});
      }});
      cards.push(card);rail.append(card);
    });
    rail.addEventListener('scroll',closePreview,{passive:true});
    rail.addEventListener('scrollend',()=>{
      if(!cards.length)return;
      const center=rail.getBoundingClientRect().left+rail.clientWidth/2;
      active=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().left+card.getBoundingClientRect().width/2-center)<Math.abs(cards[best].getBoundingClientRect().left+cards[best].getBoundingClientRect().width/2-center)?i:best,0);
      cards.forEach((card,i)=>{card.classList.toggle('is-active',i===active);card.classList.toggle('is-before',i<active);card.classList.toggle('is-after',i>active);});
    });
    requestAnimationFrame(()=>activate(Math.floor((cards.length-1)/2),false,false));
    section.append(heading,rail);main.append(section);
  });
  const updated=document.querySelector('#updated');
  updated.textContent=catalogue.updatedAt?text('updated')+' · '+new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(catalogue.updatedAt)):text('pending');
}
async function loadCatalogue(){main.setAttribute('aria-busy','true');try{const response=await fetch('data/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!Array.isArray(data.categories))throw Error('Invalid catalogue');catalogue=data;failed=false;}catch{failed=true;}finally{main.setAttribute('aria-busy','false');render();}}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{language=button.dataset.lang;try{localStorage.setItem('odt-language',language);}catch{}render();}));
render();loadCatalogue();
