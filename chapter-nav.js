// SPDX-License-Identifier: Apache-2.0
(() => {
  const bar=document.querySelector('#chapter-directory');
  const nav=bar.querySelector('nav');
  const links=[...nav.querySelectorAll('a[href^="#"]')];
  const chapters=links.map(link=>document.getElementById(link.hash.slice(1)));
  const status=document.querySelector('#chapter-current');
  let height=0,current=-1,pending=false;
  function update(){
    pending=false;
    let index=0;
    for(let i=0;i<chapters.length;i++)if(chapters[i].getBoundingClientRect().top<=height+24)index=i;
    if(index===current)return;
    current=index;
    links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    status.textContent=links[index].textContent.replace(/^(\d+) /,'$1 / ');
    // Keep the selected chapter visible in the narrow-screen horizontal menu.
    const link=links[index],a=link.getBoundingClientRect(),b=nav.getBoundingClientRect();
    if(a.left<b.left||a.right>b.right)nav.scrollTo({left:nav.scrollLeft+a.left-b.left-(b.width-a.width)/2,behavior:'auto'});
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
  function measure(){height=Math.ceil(bar.getBoundingClientRect().height);document.documentElement.style.setProperty('--chapter-nav-height',`${height}px`);schedule();}
  new ResizeObserver(measure).observe(bar);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  window.addEventListener('hashchange',schedule);
  // Images/fonts can move chapter boundaries even when the menu height stays fixed.
  window.addEventListener('load',()=>{measure();const anchor=document.getElementById(location.hash.slice(1));if(anchor)anchor.scrollIntoView({block:'start'});schedule();},{once:true});
  document.fonts?.ready.then(schedule);
  measure();
})();
