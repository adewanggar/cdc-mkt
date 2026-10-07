const locationDialog=document.getElementById('location-dialog');
if(locationDialog && typeof locationDialog.showModal==='function') {
 document.querySelectorAll('[data-location-picker]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  locationDialog.showModal();
 }));
 locationDialog.addEventListener('click',event=>{
  if(event.target!==locationDialog) return;
  const bounds=locationDialog.getBoundingClientRect();
  if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) locationDialog.close();
 });
}
