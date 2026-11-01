// SPDX-License-Identifier: Apache-2.0
(() => {
 const bar=document.querySelector('#chapter-directory'),nav=bar.querySelector('nav');
 const links=[...nav.querySelectorAll('a[href^="#"]')],chapters=links.map(link=>document.getElementById(link.hash.slice(1)));
 const status=document.querySelector('#chapter-current');let height=0,current=-1,pending=false;
 function activate(index){
  if(index===current)return;current=index;
  links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  status.textContent=links[index].textContent.replace(/^(\d+) /,'$1 / ');
  document.dispatchEvent(new CustomEvent('atlas:chapterchange',{detail:{id:chapters[index].id}}));
  const link=links[index],a=link.getBoundingClientRect(),b=nav.getBoundingClientRect();
  if(a.left<b.left||a.right>b.right)nav.scrollTo({left:nav.scrollLeft+a.left-b.left-(b.width-a.width)/2,behavior:'auto'});
 }
 function update(){pending=false;let index=0;for(let i=0;i<chapters.length;i++)if(chapters[i].getBoundingClientRect().top<=height+24)index=i;activate(index);}
 function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
 function measure(){height=Math.ceil(bar.getBoundingClientRect().height);document.documentElement.style.setProperty('--chapter-nav-height',`${height}px`);schedule();}
 links.forEach((link,index)=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();activate(index);measure();history.pushState(null,'',link.href);chapters[index].scrollIntoView({block:'start'});schedule();
 }));
 new ResizeObserver(measure).observe(bar);
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',measure,{passive:true});window.addEventListener('hashchange',schedule);window.addEventListener('popstate',schedule);
 window.addEventListener('load',()=>{
  const anchor=document.getElementById(location.hash.slice(1)),chapter=anchor?.closest('.chapter'),index=chapters.indexOf(chapter);
  if(index>=0)activate(index);measure();if(anchor)anchor.scrollIntoView({block:'start'});schedule();
 },{once:true});
 document.fonts?.ready.then(schedule);measure();
})();
