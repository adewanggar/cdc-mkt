document.querySelectorAll('form[data-confirm]').forEach(form=>form.addEventListener('submit',event=>{
 if(!window.confirm(form.dataset.confirm)) event.preventDefault();
}));
const toast=document.getElementById('toast');
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
 try { await navigator.clipboard.writeText(button.dataset.copy); if(toast) { toast.textContent='Link berhasil disalin';toast.hidden=false;setTimeout(()=>toast.hidden=true,2500); } }
 catch { window.prompt('Salin link halaman:',button.dataset.copy); }
}));
document.getElementById('back-button')?.addEventListener('click',()=>history.back());
document.querySelectorAll('[data-branch-mode]').forEach(select=>{
 const form=select.closest('form'),url=form.querySelector('[name="url"]'),icon=form.querySelector('[name="icon"]');
 const update=()=>{
  const picker=select.value==='1';
  url.disabled=picker;url.required=!picker;
  if(picker) icon.value='maps';
 };
 select.addEventListener('change',update);update();
});
document.querySelectorAll('.wa-message-editor').forEach(editor=>{
 const select=editor.querySelector('.wa-template-select'),textarea=editor.querySelector('textarea'),form=editor.closest('form');
 const nameInput=form.querySelector('[name="name"]'),labInput=form.querySelector('[name="lab_name"]');
 const message=option=>{
  const name=nameInput?.value.trim() || (labInput?.value.trim() ? 'Customer Care '+labInput.value.trim() : 'Customer Care');
  return (option.dataset.message || '').replaceAll('{nama}',name);
 };
 const savedTemplate=[...select.options].find(option=>option.dataset.message && message(option)===textarea.value);
 if(savedTemplate)select.value=savedTemplate.value;
 const apply=()=>{const option=select.selectedOptions[0];if(option?.dataset.message)textarea.value=message(option);};
 select.addEventListener('change',apply);
 textarea.addEventListener('input',()=>select.value='');
 (nameInput || labInput)?.addEventListener('input',apply);
});
