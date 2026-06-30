'use strict';

const STORAGE_KEY = 'listaOrdiniConsorzioState.v1';
const EMPTY_STATE = { brands: [], products: [], currentOrder: [], orderHistory: [] };
let state = loadState();
let activeSection = 'order';
let filters = { brandSearch: '', productSearch: '', productBrand: '', orderSearch: '', orderBrand: '' };
let editingBrandId = null;
let editingProductId = null;
let productDraftImages = { productImage: '', barcodeImage: '' };
let quickDraftImages = { productImage: '', barcodeImage: '' };
let confirmResolver = null;

function uid(){ return crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function now(){ return new Date().toISOString(); }
function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalize(v=''){ return v.trim().toLowerCase(); }
function formatDate(d){ return new Date(d).toLocaleString('it-IT', { dateStyle:'short', timeStyle:'short' }); }

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...structuredClone(EMPTY_STATE), ...saved,
      brands: Array.isArray(saved.brands) ? saved.brands : [],
      products: Array.isArray(saved.products) ? saved.products : [],
      currentOrder: Array.isArray(saved.currentOrder) ? saved.currentOrder : [],
      orderHistory: Array.isArray(saved.orderHistory) ? saved.orderHistory : [] };
  } catch { return structuredClone(EMPTY_STATE); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); document.getElementById('statusPill').textContent = 'Salvato in locale'; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function brandName(id){ return state.brands.find(b=>b.id===id)?.name || 'Senza brand'; }
function productById(id){ return state.products.find(p=>p.id===id); }
function placeholder(label='Nessuna foto'){ return `<div class="media-box">${label}</div>`; }
function imageBox(src,label){ return src ? `<div class="media-box"><img src="${src}" alt="${escapeHtml(label)}"></div>` : placeholder(); }
function selectBrands(selected='', includeAll=false){
  return `${includeAll?'<option value="">Tutti i brand</option>':''}<option value="__none__" ${selected==='__none__'?'selected':''}>Senza brand</option>${state.brands.map(b=>`<option value="${b.id}" ${selected===b.id?'selected':''}>${escapeHtml(b.name)}</option>`).join('')}`;
}

function renderApp(){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.section===activeSection));
  const app = document.getElementById('app');
  app.innerHTML = activeSection==='order' ? renderCurrentOrder() : activeSection==='products' ? renderProducts() : activeSection==='brands' ? renderBrands() : renderOrderHistory();
  bindSectionEvents();
}

function renderBrands(){
  const list = state.brands.filter(b=>normalize(b.name).includes(normalize(filters.brandSearch)));
  return `<section><div class="section-head"><h2>Brand</h2></div>
  <div class="card"><form id="brandForm" class="form-grid"><div class="field"><label>Nome brand *</label><input name="name" value="${editingBrandId?escapeHtml(state.brands.find(b=>b.id===editingBrandId)?.name):''}" required placeholder="Es. Consorzio"></div><div class="actions"><button class="btn">${editingBrandId?'Aggiorna':'Crea'} brand</button>${editingBrandId?'<button type="button" class="btn secondary" id="cancelBrandEdit">Annulla</button>':''}</div></form></div>
  <div class="toolbar"><div class="field"><label>Cerca brand</label><input id="brandSearch" value="${escapeHtml(filters.brandSearch)}" placeholder="Cerca..."></div></div>
  <div class="grid cards">${list.length?list.map(b=>`<article class="card brand-card"><div><h3>${escapeHtml(b.name)}</h3><p class="muted">Creato: ${formatDate(b.createdAt)}</p></div><div class="actions row-actions"><button class="btn secondary" data-edit-brand="${b.id}">Modifica</button><button class="btn danger" data-delete-brand="${b.id}">Elimina</button></div></article>`).join(''):'<div class="empty">Nessun brand presente.</div>'}</div></section>`;
}

function renderProducts(){
  const list = filteredProducts(filters.productSearch, filters.productBrand);
  const p = editingProductId ? state.products.find(x=>x.id===editingProductId) : {};
  return `<section><div class="section-head"><h2>Prodotti</h2></div>${productForm(p,'productForm', editingProductId?'Aggiorna prodotto':'Crea prodotto', productDraftImages)}
  <div class="toolbar"><div class="field"><label>Cerca prodotto</label><input id="productSearch" value="${escapeHtml(filters.productSearch)}"></div><div class="field"><label>Filtra brand</label><select id="productBrandFilter">${selectBrands(filters.productBrand,true)}</select></div></div>
  <div class="grid cards">${list.length?list.map(productCard).join(''):'<div class="empty">Nessun prodotto trovato.</div>'}</div></section>`;
}
function productForm(p={}, id, btnText, imgs){ return `<div class="card"><form id="${id}" class="form-grid two"><div class="field"><label>Nome prodotto *</label><input name="name" value="${escapeHtml(p.name||'')}" required></div><div class="field"><label>Brand</label><select name="brandId">${selectBrands(p.brandId||'__none__')}</select></div><div class="field"><label>Foto prodotto</label><input type="file" name="productImage" accept="image/*" capture="environment"><span class="file-note">Salvata in locale come base64.</span></div><div class="field"><label>Foto codice a barre</label><input type="file" name="barcodeImage" accept="image/*" capture="environment"></div><div class="field"><label>Codice a barre</label><input name="barcodeValue" value="${escapeHtml(p.barcodeValue||'')}"></div><div class="field"><label>Categoria</label><input name="category" value="${escapeHtml(p.category||'')}"></div><div class="field"><label>Note</label><textarea name="notes">${escapeHtml(p.notes||'')}</textarea></div><div class="preview-row"><div>${imageBox(imgs.productImage||p.productImage,'Anteprima prodotto')}</div><div>${imageBox(imgs.barcodeImage||p.barcodeImage,'Anteprima barcode')}</div></div><div class="actions"><button class="btn">${btnText}</button>${editingProductId?'<button type="button" class="btn secondary" id="cancelProductEdit">Annulla</button>':''}</div></form></div>`; }
function productCard(p){ return `<article class="card product-card">${imageBox(p.productImage,p.name)}<div><h3>${escapeHtml(p.name)}</h3><div class="meta"><span class="tag">${escapeHtml(brandName(p.brandId))}</span>${p.category?`<span class="tag">${escapeHtml(p.category)}</span>`:''}</div>${p.barcodeValue?`<p><b>Barcode:</b> ${escapeHtml(p.barcodeValue)}</p>`:''}${p.barcodeImage?`<img class="barcode-thumb" src="${p.barcodeImage}" alt="Barcode">`:''}${p.notes?`<p class="muted">${escapeHtml(p.notes)}</p>`:''}<div class="actions row-actions"><button class="btn" data-add-order="${p.id}">Aggiungi</button><button class="btn secondary" data-edit-product="${p.id}">Modifica</button><button class="btn danger" data-delete-product="${p.id}">Elimina</button></div></div></article>`; }
function filteredProducts(search, brand){ return state.products.filter(p=>normalize(p.name).includes(normalize(search)) && (!brand || (brand==='__none__' ? !p.brandId : p.brandId===brand))); }

function renderCurrentOrder(){
  const candidates = filteredProducts(filters.orderSearch, filters.orderBrand);
  return `<section><div class="section-head"><h2>Cose da ordinare</h2><div class="actions row-actions"><button class="btn ghost" id="copyOrder">Copia lista</button><button class="btn ghost" id="exportOrder">Esporta TXT</button></div></div>
  <div class="card"><h3>Aggiungi prodotto salvato</h3><div class="toolbar"><div class="field"><label>Cerca</label><input id="orderSearch" value="${escapeHtml(filters.orderSearch)}"></div><div class="field"><label>Brand</label><select id="orderBrandFilter">${selectBrands(filters.orderBrand,true)}</select></div></div><div class="compact-list">${candidates.slice(0,8).map(p=>`<div class="mini-item"><b>${escapeHtml(p.name)}</b><br><span class="muted">${escapeHtml(brandName(p.brandId))}</span><div class="actions row-actions"><input class="qty-input" data-qty-for="${p.id}" type="number" min="1" value="1"><button class="btn" data-add-order="${p.id}">Aggiungi</button></div></div>`).join('') || '<p class="muted">Cerca o crea un prodotto rapido sotto.</p>'}</div></div>
  <div class="card"><h3>Creazione rapida prodotto</h3><form id="quickProductForm" class="form-grid two"><div class="field"><label>Nome prodotto *</label><input name="name" required></div><div class="field"><label>Brand</label><select name="brandId">${selectBrands('__none__')}</select></div><div class="field"><label>Foto prodotto</label><input type="file" name="productImage" accept="image/*" capture="environment"></div><div class="field"><label>Foto codice a barre</label><input type="file" name="barcodeImage" accept="image/*" capture="environment"></div><div class="field"><label>Codice a barre</label><input name="barcodeValue"></div><div class="field"><label>Quantità</label><input name="quantity" type="number" min="1" value="1"></div><div class="field"><label>Note ordine</label><textarea name="orderNotes"></textarea></div><div class="preview-row"><div>${imageBox(quickDraftImages.productImage,'Anteprima prodotto')}</div><div>${imageBox(quickDraftImages.barcodeImage,'Anteprima barcode')}</div></div><div class="actions"><button class="btn">Crea e aggiungi</button></div></form></div>
  <div class="section-head"><h2>Ordine corrente (${state.currentOrder.length})</h2><div class="actions row-actions"><button class="btn" id="completeOrder" ${state.currentOrder.length?'':'disabled'}>Completa ordine</button><button class="btn danger" id="clearOrder" ${state.currentOrder.length?'':'disabled'}>Svuota</button></div></div><div class="grid">${state.currentOrder.length?state.currentOrder.map(orderCard).join(''):'<div class="empty">La lista ordine è vuota.</div>'}</div></section>`;
}
function orderCard(item){ const p=productById(item.productId)||{name:'Prodotto eliminato'}; return `<article class="card order-card">${imageBox(p.productImage,p.name)}<div><h3>${escapeHtml(p.name)}</h3><div class="meta"><span class="tag">${escapeHtml(brandName(p.brandId))}</span></div>${p.barcodeValue?`<p><b>Barcode:</b> ${escapeHtml(p.barcodeValue)}</p>`:''}${p.barcodeImage?`<img class="barcode-thumb" src="${p.barcodeImage}" alt="Barcode">`:''}<div class="form-grid"><div class="field"><label>Quantità</label><input data-order-qty="${item.id}" type="number" min="1" value="${escapeHtml(item.quantity)}"></div><div class="field"><label>Note</label><textarea data-order-notes="${item.id}">${escapeHtml(item.notes||'')}</textarea></div></div><div class="actions row-actions"><button class="btn secondary" data-save-order-item="${item.id}">Salva modifiche</button><button class="btn danger" data-remove-order="${item.id}">Rimuovi</button></div></div></article>`; }

function renderOrderHistory(){ return `<section><div class="section-head"><h2>Storico ordini</h2></div><div class="grid">${state.orderHistory.length?state.orderHistory.map(o=>`<article class="card history-card"><h3>Ordine del ${formatDate(o.completedAt)}</h3><p class="muted">${o.items.length} prodotti</p><details><summary>Vedi dettaglio</summary><div class="compact-list">${o.items.map(i=>{const p=productById(i.productId)||i.productSnapshot||{};return `<div class="mini-item"><b>${escapeHtml(p.name||'Prodotto')}</b><br>Quantità: ${escapeHtml(i.quantity)}${i.notes?`<br>Note: ${escapeHtml(i.notes)}`:''}</div>`}).join('')}</div></details><div class="actions row-actions"><button class="btn" data-duplicate-order="${o.id}">Duplica</button><button class="btn danger" data-delete-history="${o.id}">Elimina</button></div></article>`).join(''):'<div class="empty">Nessun ordine completato.</div>'}</div></section>`; }

function createBrand(name){ const clean=name.trim(); if(!clean) return toast('Nome brand obbligatorio'); if(state.brands.some(b=>normalize(b.name)===normalize(clean))) return toast('Brand già presente'); state.brands.push({id:uid(),name:clean,createdAt:now(),updatedAt:now()}); saveState(); toast('Brand creato'); renderApp(); }
function updateBrand(id,name){ const b=state.brands.find(x=>x.id===id); if(!b) return; const clean=name.trim(); if(state.brands.some(x=>x.id!==id&&normalize(x.name)===normalize(clean))) return toast('Duplicato non consentito'); b.name=clean; b.updatedAt=now(); editingBrandId=null; saveState(); toast('Brand aggiornato'); renderApp(); }
async function deleteBrand(id){ if(!(await confirmAction('Eliminare il brand? I prodotti resteranno senza brand.'))) return; state.brands=state.brands.filter(b=>b.id!==id); state.products.forEach(p=>{if(p.brandId===id){p.brandId='';p.updatedAt=now();}}); saveState(); toast('Brand eliminato'); renderApp(); }
function productFromForm(form, images, old={}){ const fd=new FormData(form); return { ...old, id:old.id||uid(), name:fd.get('name').trim(), brandId:fd.get('brandId')==='__none__'?'':fd.get('brandId'), productImage:images.productImage||old.productImage||'', barcodeImage:images.barcodeImage||old.barcodeImage||'', barcodeValue:fd.get('barcodeValue')?.trim()||'', category:fd.get('category')?.trim()||'', notes:fd.get('notes')?.trim()||'', createdAt:old.createdAt||now(), updatedAt:now() }; }
function createProduct(product){ if(!product.name) return toast('Nome prodotto obbligatorio'); state.products.push(product); saveState(); toast('Prodotto creato'); renderApp(); return product; }
function updateProduct(id, product){ const i=state.products.findIndex(p=>p.id===id); if(i<0) return; state.products[i]=product; editingProductId=null; productDraftImages={productImage:'',barcodeImage:''}; saveState(); toast('Prodotto aggiornato'); renderApp(); }
async function deleteProduct(id){ if(!(await confirmAction('Eliminare il prodotto? Verrà rimosso anche dall’ordine corrente.'))) return; state.products=state.products.filter(p=>p.id!==id); state.currentOrder=state.currentOrder.filter(i=>i.productId!==id); saveState(); toast('Prodotto eliminato'); renderApp(); }
function addProductToOrder(productId, quantity=1, notes=''){ const existing=state.currentOrder.find(i=>i.productId===productId); if(existing){ existing.quantity=Number(existing.quantity)+Number(quantity||1); existing.notes=notes||existing.notes; } else state.currentOrder.push({id:uid(),productId,quantity:Number(quantity||1),notes,createdAt:now()}); saveState(); toast('Aggiunto all’ordine'); renderApp(); }
function updateOrderItem(id, quantity, notes){ const it=state.currentOrder.find(i=>i.id===id); if(it){it.quantity=Math.max(1,Number(quantity)||1);it.notes=notes||'';saveState();toast('Riga aggiornata');renderApp();} }
async function removeOrderItem(id){ if(await confirmAction('Rimuovere questo prodotto dall’ordine?')){ state.currentOrder=state.currentOrder.filter(i=>i.id!==id); saveState(); toast('Rimosso'); renderApp(); } }
async function completeOrder(){ if(!state.currentOrder.length) return; state.orderHistory.unshift({id:uid(),items:state.currentOrder.map(i=>({...i,productSnapshot:productById(i.productId)})),createdAt:state.currentOrder[0]?.createdAt||now(),completedAt:now()}); state.currentOrder=[]; saveState(); toast('Ordine completato'); renderApp(); }
function duplicateOrder(id){ const o=state.orderHistory.find(x=>x.id===id); if(!o) return; o.items.forEach(i=>addProductToOrder(i.productId,i.quantity,i.notes)); toast('Ordine duplicato'); }
function exportOrderText(){ const text=orderText(); const blob=new Blob([text],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`lista-ordine-${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(a.href); }
async function copyOrderText(){ await navigator.clipboard.writeText(orderText()); toast('Lista copiata'); }
function orderText(){ return `LISTA ORDINE - ${new Date().toLocaleDateString('it-IT')}\n\n`+state.currentOrder.map((i,n)=>{const p=productById(i.productId)||{};return `${n+1}. ${p.name||'Prodotto'}\nBrand: ${brandName(p.brandId)}\nQuantità: ${i.quantity}${p.barcodeValue?`\nCodice barcode: ${p.barcodeValue}`:''}${i.notes?`\nNote: ${i.notes}`:''}`;}).join('\n\n'); }

function bindSectionEvents(){ document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{activeSection=b.dataset.section;renderApp();});
  const brandForm=document.getElementById('brandForm'); if(brandForm) brandForm.onsubmit=e=>{e.preventDefault(); editingBrandId?updateBrand(editingBrandId,brandForm.name.value):createBrand(brandForm.name.value);};
  on('brandSearch','input',e=>{filters.brandSearch=e.target.value;renderApp();}); on('cancelBrandEdit','click',()=>{editingBrandId=null;renderApp();});
  document.querySelectorAll('[data-edit-brand]').forEach(b=>b.onclick=()=>{editingBrandId=b.dataset.editBrand;renderApp();}); document.querySelectorAll('[data-delete-brand]').forEach(b=>b.onclick=()=>deleteBrand(b.dataset.deleteBrand));
  bindProductForms();
  on('productSearch','input',e=>{filters.productSearch=e.target.value;renderApp();}); on('productBrandFilter','change',e=>{filters.productBrand=e.target.value;renderApp();});
  on('orderSearch','input',e=>{filters.orderSearch=e.target.value;renderApp();}); on('orderBrandFilter','change',e=>{filters.orderBrand=e.target.value;renderApp();});
  document.querySelectorAll('[data-add-order]').forEach(b=>b.onclick=()=>addProductToOrder(b.dataset.addOrder, document.querySelector(`[data-qty-for="${b.dataset.addOrder}"]`)?.value||1));
  document.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>{editingProductId=b.dataset.editProduct; productDraftImages={productImage:'',barcodeImage:''}; window.scrollTo(0,0); renderApp();}); document.querySelectorAll('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteProduct));
  document.querySelectorAll('[data-save-order-item]').forEach(b=>b.onclick=()=>updateOrderItem(b.dataset.saveOrderItem, document.querySelector(`[data-order-qty="${b.dataset.saveOrderItem}"]`).value, document.querySelector(`[data-order-notes="${b.dataset.saveOrderItem}"]`).value)); document.querySelectorAll('[data-remove-order]').forEach(b=>b.onclick=()=>removeOrderItem(b.dataset.removeOrder));
  on('completeOrder','click',completeOrder); on('clearOrder','click',async()=>{if(await confirmAction('Svuotare tutto l’ordine corrente?')){state.currentOrder=[];saveState();renderApp();}}); on('exportOrder','click',exportOrderText); on('copyOrder','click',copyOrderText);
  document.querySelectorAll('[data-duplicate-order]').forEach(b=>b.onclick=()=>duplicateOrder(b.dataset.duplicateOrder)); document.querySelectorAll('[data-delete-history]').forEach(b=>b.onclick=async()=>{if(await confirmAction('Eliminare questo ordine storico?')){state.orderHistory=state.orderHistory.filter(o=>o.id!==b.dataset.deleteHistory);saveState();renderApp();}});
}
function bindProductForms(){ const pf=document.getElementById('productForm'); if(pf){ pf.onsubmit=e=>{e.preventDefault(); const old=editingProductId?state.products.find(p=>p.id===editingProductId):{}; const p=productFromForm(pf,productDraftImages,old); editingProductId?updateProduct(editingProductId,p):createProduct(p); productDraftImages={productImage:'',barcodeImage:''};}; bindImageInput(pf,'productImage',productDraftImages); bindImageInput(pf,'barcodeImage',productDraftImages); } on('cancelProductEdit','click',()=>{editingProductId=null;productDraftImages={productImage:'',barcodeImage:''};renderApp();}); const qf=document.getElementById('quickProductForm'); if(qf){ qf.onsubmit=e=>{e.preventDefault(); const product=productFromForm(qf,quickDraftImages,{}); product.category=''; product.notes=''; const made=createProduct(product); if(made){ addProductToOrder(made.id, new FormData(qf).get('quantity'), new FormData(qf).get('orderNotes')?.trim()||''); quickDraftImages={productImage:'',barcodeImage:''}; }}; bindImageInput(qf,'productImage',quickDraftImages); bindImageInput(qf,'barcodeImage',quickDraftImages); }}
function bindImageInput(form,name,store){ const input=form.elements[name]; if(!input) return; input.onchange=async()=>{ const file=input.files[0]; if(file){ store[name]=await fileToDataUrl(file); renderApp(); } }; }
function fileToDataUrl(file){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
function on(id,event,handler){ const el=document.getElementById(id); if(el) el.addEventListener(event,handler); }
function confirmAction(message){ document.getElementById('confirmMessage').textContent=message; document.getElementById('confirmModal').classList.remove('hidden'); return new Promise(res=>confirmResolver=res); }
document.getElementById('confirmCancel').onclick=()=>{document.getElementById('confirmModal').classList.add('hidden'); confirmResolver?.(false);};
document.getElementById('confirmOk').onclick=()=>{document.getElementById('confirmModal').classList.add('hidden'); confirmResolver?.(true);};
renderApp();
