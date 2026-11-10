'use strict';
const strings = {
  ru: {updates:'Обновления',updatesEmpty:'Обновлений пока нет.',updatesLoading:'Загружаем обновления…',updatesError:'Не удалось загрузить обновления.',eyebrow:'Для авторов историй, которые еще предстоит рассказать.',loading:'Открываем библиотеку…',assets:'Ассеты',systems:'Системы',modules:'Модули',compendiums:'Компендиумы',empty:'Новая глава ещё впереди.',folder:'Заглянуть в папку',open:'Открыть в Google Drive ↗',updated:'Обновлено',pending:'Первые материалы скоро появятся',error:'Не удалось загрузить каталог.',retry:'Повторить',original:'Описание на русском',noDescription:'Описание скоро появится.'},
  en: {updates:'Updates',updatesEmpty:'No updates yet.',updatesLoading:'Loading updates…',updatesError:'Could not load updates.',eyebrow:'For authors of stories yet to be told.',loading:'Opening the library…',assets:'Assets',systems:'Systems',modules:'Modules',compendiums:'Compendiums',empty:'The next chapter is still to come.',folder:'Explore the folder',open:'Open in Google Drive ↗',updated:'Updated',pending:'The first materials are on their way',error:'The catalogue could not be loaded.',retry:'Try again',original:'Description in Russian',noDescription:'Description coming soon.'}
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
const updatesDialog=document.querySelector('#updates-dialog'),updatesButton=document.querySelector('.updates-button'),updatesContent=document.querySelector('.updates-content');
let updatesData=null,updatesFailed=false;
let currentCard=null,hideTimer,previewPinned=false,inputMode='keyboard',restoringFocus=false;
document.addEventListener('pointerdown',event=>{inputMode=event.pointerType||'mouse';});
document.addEventListener('keydown',()=>{inputMode='keyboard';});
function restoreCardFocus(card){restoringFocus=true;card?.focus({preventScroll:true});restoringFocus=false;}
const text = key => strings[language][key];
function element(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;}
function driveUrl(value,fallback){try{const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='drive.google.com')return url.href;}catch{}return fallback;}
function closePreview(){clearTimeout(hideTimer);preview.hidden=true;currentCard=null;previewPinned=false;}
function laterClose(){if(previewPinned)return;hideTimer=setTimeout(()=>{if(!preview.contains(document.activeElement)&&document.activeElement!==currentCard)closePreview();},170);}
function placePreview(card){
  const rect=card.getBoundingClientRect(),box=preview.getBoundingClientRect();
  preview.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left+(rect.width-box.width)/2))+'px';
  preview.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.top-16))+'px';
}
function showPreview(card,item,category,touch=false){
  if(!card.isConnected)return;
  clearTimeout(hideTimer);currentCard=card;previewPinned=touch;
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
preview.addEventListener('focusout',laterClose);preview.querySelector('.preview-close').addEventListener('click',()=>{const card=currentCard;closePreview();restoreCardFocus(card);closePreview();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const card=currentCard;closePreview();restoreCardFocus(card);closePreview();}});
document.addEventListener('pointerdown',event=>{if(!preview.contains(event.target))closePreview();});
function updatePreviewPosition(){if(currentCard&&(previewPinned||document.activeElement===currentCard))placePreview(currentCard);else closePreview();}
window.addEventListener('resize',updatePreviewPosition);window.addEventListener('scroll',updatePreviewPosition);
function renderUpdates(){
  updatesContent.replaceChildren();
  if(updatesFailed){
    const message=element('p','updates-status',text('updatesError')),retry=element('button','updates-retry',text('retry'));
    retry.addEventListener('click',loadUpdates);updatesContent.append(message,retry);return;
  }
  if(!updatesData){updatesContent.append(element('p','updates-status',text('updatesLoading')));return;}
  const entries=updatesData[language];
  if(!entries.length){updatesContent.append(element('p','updates-status',text('updatesEmpty')));return;}
  const format=new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  entries.forEach(entry=>{
    const article=element('article','update-entry'),heading=element('h2','update-date'),date=element('time','',format.format(new Date(entry.date+'T00:00:00Z'))),body=element('div','update-body');
    date.dateTime=entry.date;heading.append(date);
    // Generated at build time by markdown-it with raw HTML disabled and unsafe links rejected.
    body.innerHTML=entry.html;article.append(heading,body);updatesContent.append(article);
  });
}
async function loadUpdates(){
  updatesFailed=false;updatesContent.setAttribute('aria-busy','true');renderUpdates();
  try{
    const response=await fetch('data/updates.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');
    const data=await response.json();
    if(!['ru','en'].every(lang=>Array.isArray(data[lang])&&data[lang].every(entry=>typeof entry.date==='string'&&typeof entry.html==='string')))throw Error('Invalid updates');
    updatesData=data;
  }catch{updatesFailed=true;}
  finally{updatesContent.setAttribute('aria-busy','false');renderUpdates();}
}
updatesButton.addEventListener('click',()=>{closePreview();updatesDialog.showModal();loadUpdates();});
updatesDialog.querySelector('.updates-close').addEventListener('click',()=>updatesDialog.close());
updatesDialog.addEventListener('click',event=>{
  if(event.target!==updatesDialog)return;
  const rect=updatesDialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)updatesDialog.close();
});
function render(){
  closePreview();document.documentElement.lang=language;renderUpdates();
  document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=text(node.dataset.i18n));
  document.querySelectorAll('[data-lang]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.lang===language)));
  main.replaceChildren();
  if(failed){const warning=element('p','error',text('error'));const retry=element('button','',text('retry'));retry.onclick=loadCatalogue;warning.append(retry);main.append(warning);}
  categories.forEach(([id,folder],index)=>{
    const category=catalogue.categories.find(x=>x.id===id),items=[...(category?.items||[])].sort((a,b)=>(a.title?.[language]||a.name).replace(/\[[^\]]*\]/g,'').trim().localeCompare((b.title?.[language]||b.name).replace(/\[[^\]]*\]/g,'').trim(),language,{sensitivity:'base',numeric:true})),url='https://drive.google.com/drive/folders/'+folder;
    const section=element('section','shelf'),heading=element('div','shelf-heading'),h2=element('h2');
    const number=element('span','section-number',String(index+1).padStart(2,'0')),link=element('a','',text(id));link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.append(element('span','section-arrow','↗'));h2.append(number,link);heading.append(h2);
    const rail=element('div','rail');rail.id='rail-'+id;
    if(!items.length){const empty=element('div','empty');empty.append(element('span','empty-symbol','✧'));const copy=element('p','',text('empty'));const small=element('small'),folderLink=element('a','',text('folder')+' ↗');folderLink.href=url;folderLink.target='_blank';folderLink.rel='noopener noreferrer';small.append(folderLink);copy.append(small);empty.append(copy);rail.append(empty);}
    const count=items.length,base=count>1?count*2:0;
    const slides=count>1?Array.from({length:count*5},(_,i)=>items[i%count]):items;
    let active=base,previewTimer,hoverTimer,lastPointerX,lastPointerY,hoverLockedUntil=0,touchPreviewPending=false,resetting=false;
    const cards=[];
    function activate(index,show=false,animate=true){
      active=index;clearTimeout(previewTimer);clearTimeout(hoverTimer);touchPreviewPending=false;closePreview();hoverLockedUntil=performance.now()+550;
      markCards();
      const card=cards[active];if(!card)return;
      rail.scrollTo({left:card.offsetLeft-(rail.clientWidth-card.offsetWidth)/2,behavior:!animate||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      if(show)previewTimer=setTimeout(()=>{
        const centered=cards[active];
        if(centered.matches(':hover')||document.activeElement===centered)showPreview(centered,items[active%count],id);
      },450);
    }
    function markCards(){
      cards.forEach((card,i)=>{
        card.classList.toggle('is-active',i===active);card.classList.toggle('is-before',i<active);card.classList.toggle('is-after',i>active);
        card.tabIndex=i>=base&&i<base+count?0:-1;
        card.setAttribute('aria-hidden',String(card.tabIndex<0&&i!==active));
      });
    }
    function recenter(){
      if(count<2)return;
      const middle=base+((active%count)+count)%count;
      if(middle===active)return;
      const focused=document.activeElement===cards[active];
      resetting=true;rail.classList.add('is-resetting');
      active=middle;markCards();
      const card=cards[active];
      rail.scrollTo({left:card.offsetLeft-(rail.clientWidth-card.offsetWidth)/2,behavior:'instant'});
      if(focused)card.focus({preventScroll:true});
      // Both copies occupy identical pixels; move the scroll origin without animating.
      void rail.offsetWidth;
      rail.classList.remove('is-resetting');resetting=false;
    }
    slides.forEach((item,index)=>{
      const card=element('a','card'),image=element('img'),title=item.title?.[language]||item.title?.ru||item.name;
      card.href=driveUrl(item.url,url);card.target='_blank';card.rel='noopener noreferrer';card.setAttribute('aria-label',title+' — '+text('open'));
      image.src=item.image;image.alt='';image.width=320;image.height=160;image.loading='lazy';image.decoding='async';
      card.append(image,element('span','card-title',title));
      card.addEventListener('pointerenter',event=>{
        if(event.pointerType==='mouse'&&index===active&&preview.hidden){clearTimeout(previewTimer);previewTimer=setTimeout(()=>{if(card.matches(':hover'))showPreview(card,item,id);},450);}
      });
      card.addEventListener('pointermove',event=>{
        if(event.pointerType!=='mouse'||event.buttons)return;
        if(performance.now()<hoverLockedUntil){lastPointerX=event.clientX;lastPointerY=event.clientY;return;}
        if(lastPointerX!==undefined&&Math.hypot(event.clientX-lastPointerX,event.clientY-lastPointerY)<18)return;
        lastPointerX=event.clientX;lastPointerY=event.clientY;clearTimeout(hoverTimer);
        if(index!==active){
          hoverTimer=setTimeout(()=>{if(card.matches(':hover'))activate(index,true);},220);
        }else if(preview.hidden){clearTimeout(previewTimer);previewTimer=setTimeout(()=>{if(card.matches(':hover'))showPreview(card,item,id);},450);}
      });
      card.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);clearTimeout(previewTimer);laterClose();});
      card.addEventListener('focus',()=>{if(!resetting&&!restoringFocus&&inputMode==='keyboard')activate(index,true);});card.addEventListener('blur',laterClose);
      card.addEventListener('click',event=>{
        if(inputMode==='touch'||inputMode==='pen'||matchMedia('(hover: none)').matches){
          event.preventDefault();activate(index);touchPreviewPending=true;
          const target=card.offsetLeft-(rail.clientWidth-card.offsetWidth)/2;
          if(Math.abs(rail.scrollLeft-target)<1){touchPreviewPending=false;showPreview(card,item,id,true);}
        }
      });
      card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();if(count>1)cards[(index+(event.key==='ArrowRight'?1:-1)+cards.length)%cards.length].focus({preventScroll:true});
      }});
      cards.push(card);rail.append(card);
    });
    rail.addEventListener('scroll',()=>{clearTimeout(hoverTimer);if(previewPinned&&currentCard)placePreview(currentCard);else if(!resetting)closePreview();},{passive:true});
    rail.addEventListener('scrollend',()=>{
      if(!cards.length||resetting)return;
      const center=rail.getBoundingClientRect().left+rail.clientWidth/2;
      active=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().left+card.getBoundingClientRect().width/2-center)<Math.abs(cards[best].getBoundingClientRect().left+cards[best].getBoundingClientRect().width/2-center)?i:best,0);
      markCards();recenter();
      if(touchPreviewPending){touchPreviewPending=false;showPreview(cards[active],items[active%count],id,true);}
    });
    requestAnimationFrame(()=>activate(base,false,false));
    section.append(heading,rail);main.append(section);
  });
  const updated=document.querySelector('#updated');
  updated.textContent=catalogue.updatedAt?text('updated')+' · '+new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(catalogue.updatedAt)):text('pending');
}
async function loadCatalogue(){main.setAttribute('aria-busy','true');try{const response=await fetch('data/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!Array.isArray(data.categories))throw Error('Invalid catalogue');catalogue=data;failed=false;}catch{failed=true;}finally{main.setAttribute('aria-busy','false');render();}}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{language=button.dataset.lang;try{localStorage.setItem('odt-language',language);}catch{}render();}));
render();loadCatalogue();
