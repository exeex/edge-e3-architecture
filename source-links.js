// SPDX-License-Identifier: Apache-2.0
// Fixed public revisions make source links work standalone and on GitHub Pages.
(() => {
  const manifest={"site":"https://exeex.github.io/edge-e3-architecture/","sources":{"src/edge-e3/":{"repository":"exeex/edge-e3","revision":"60be69f0bd06b9953d96ced7057e8ec08cb3a2ac"},"src/edge-32/":{"repository":"exeex/edge-32","revision":"55a089b372e2a18f8fa99185db7db264ad72602d"},"src/edge-asic/":{"repository":"exeex/edge-asic","revision":"3390ec73ac28041c4039572674ce42ee11ddbaed"},"src/edge-nnc/":{"repository":"exeex/edge-nnc","revision":"645cc3793c1b7a309314a5e5adb3bdce9cf7556a"},"":{"repository":"exeex/edge-cores","revision":"03f7c980cfbcff4ef101f756281c3d1baa8f4840"}}};
  function url(path,line){
    const clean=path.replace(/^\.\.\/\.\.\//,'');
    if(clean.startsWith('src/test-e3/'))return 'https://github.com/exeex/edge-e3-architecture/blob/main/sram-scheduling.md#maintained-implementation';
    const prefix=Object.keys(manifest.sources).find(key=>clean.startsWith(key));
    const entry=manifest.sources[prefix];
    const [file,fragment]=clean.slice(prefix.length).split('#');
    return `https://github.com/${entry.repository}/blob/${entry.revision}/${file}`+(line?`#L${line}`:fragment?`#${fragment}`:'');
  }
  function rewrite(){
    document.querySelectorAll('a[href^="../../"]').forEach(link=>link.setAttribute('href',url(link.getAttribute('href'))));
  }
  window.E3Sources={url,manifest};
  rewrite();
  new MutationObserver(rewrite).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
})();
