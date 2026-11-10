import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Exercise event ordering without a browser dependency. Layout/animation is checked in the browser.
async function page(){
  let now=0,nextTimer=0;const timers=new Map();
  function advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
  class Element{
    constructor(){this.children=[];this.listeners={};this.style={};this.attrs={};this.hidden=true;this.hover=false;this.scrollLeft=0;this.clientWidth=1000;this.offsetWidth=240;this.offsetHeight=120;this.isConnected=true;
      const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name),add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
    emit(name,data={}){const event={target:this,buttons:0,preventDefault(){this.defaultPrevented=true;},...data};for(const fn of this.listeners[name]||[])fn(event);return event;}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    setAttribute(name,value){this.attrs[name]=value;}
    querySelector(name){return this.parts[name];}
    contains(node){return node===this||this.children.some(child=>child.contains(node));}
    closest(selector){return selector==='.rail'?(this.className==='rail'?this:this.parent?.closest(selector)):null;}
    matches(selector){return selector===':hover'&&this.hover;}
    focus(){doc.activeElement=this;this.emit('focus');}
    get offsetLeft(){return this.parent?.className==='rail'?380+this.parent.children.indexOf(this)*260:0;}
    getBoundingClientRect(){return {left:this.offsetLeft-(this.parent?.scrollLeft||0),top:100,width:this.offsetWidth,height:this.offsetHeight};}
    scrollTo({left,behavior}){this.targetLeft=left;if(behavior==='instant')this.scrollLeft=left;}
    finishScroll(){this.scrollLeft=this.targetLeft;this.emit('scroll');this.emit('scrollend');}
  }
  const doc=new Element(),main=new Element(),preview=new Element(),updated=new Element(),updatesDialog=new Element(),updatesButton=new Element(),updatesContent=new Element();
  updatesDialog.parts={'.updates-close':new Element()};
  doc.documentElement={};doc.createElement=()=>new Element();doc.querySelectorAll=()=>[];
  doc.querySelector=selector=>({'main':main,'#preview':preview,'#updated':updated,'#updates-dialog':updatesDialog,'.updates-button':updatesButton,'.updates-content':updatesContent}[selector]);
  preview.parts=Object.fromEntries(['img','.preview-image-link','h2','.preview-category','.preview-description','.preview-link','.preview-close'].map(key=>[key,new Element()]));
  preview.append(...Object.values(preview.parts));
  const context={document:doc,window:new Element(),navigator:{languages:['en']},localStorage:{getItem:()=>null},URL,Intl,Date,innerWidth:1440,innerHeight:900,performance:{now:()=>now},matchMedia:()=>({matches:false}),
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn()};
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  runInNewContext(source.replace('render();loadCatalogue();',''),context);
  runInNewContext(`catalogue={categories:[{id:'assets',items:['Alpha','Beta'].map(name=>({name,title:{en:name},description:{en:'Full description'},image:'banner.png',url:'https://drive.google.com/drive/folders/'+name}))}]};render();`,context);
  const rail=main.children[0].children[1],cards=rail.children;
  const down=(card,type)=>doc.emit('pointerdown',{pointerType:type,target:card});
  advance(600);
  return {doc,preview,rail,cards,advance,down};
}

test('touch tap opens description after centering, and subsequent scroll/leave events keep it open',async()=>{
  const {preview,rail,cards,advance,down,doc}=await page();
  const adjacent=cards[5];down(adjacent,'touch');adjacent.focus();
  const click=adjacent.emit('click');assert.equal(click.defaultPrevented,true);
  assert.equal(preview.hidden,true);
  rail.finishScroll();assert.equal(preview.hidden,false);assert.equal(preview.parts.h2.textContent,'Beta');
  rail.emit('scroll');preview.emit('pointerleave');advance(1000);
  assert.equal(preview.hidden,false);
  doc.emit('pointerdown',{pointerType:'touch',target:doc});assert.equal(preview.hidden,true);
});

test('touch tap on the centered card stays open despite a queued scroll event',async()=>{
  const {preview,rail,cards,down}=await page();down(cards[4],'touch');cards[4].focus();cards[4].emit('click');
  assert.equal(preview.hidden,false);rail.emit('scroll');assert.equal(preview.hidden,false);
  assert.equal(cards[4].emit('pointermove',{pointerType:'touch',clientX:500,clientY:200}).defaultPrevented,undefined);
});

test('mouse hover waits for intent and ignores stationary or small pointer movement after rotation',async()=>{
  const {rail,cards,advance}=await page();cards[5].hover=true;
  cards[5].emit('pointermove',{pointerType:'mouse',clientX:1000,clientY:200});advance(200);
  assert.equal(cards[4].classList.contains('is-active'),true);
  advance(30);assert.equal(cards[5].classList.contains('is-active'),true);rail.finishScroll();
  cards[6].hover=true;cards[6].emit('pointermove',{pointerType:'mouse',clientX:1001,clientY:201});advance(600);
  cards[6].emit('pointermove',{pointerType:'mouse',clientX:1004,clientY:203});advance(300);
  assert.equal(cards[5].classList.contains('is-active'),true);
});
