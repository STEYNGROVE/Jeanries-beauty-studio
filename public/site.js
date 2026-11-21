document.querySelector('#enquiry').addEventListener('submit',function(e){e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get('name')||'').trim();const message=String(data.get('message')||'').trim();if(!name||!message)return;const draft='Hello Jeanrie, my name is '+name+'. '+message;window.open('https://wa.me/27822265134?text='+encodeURIComponent(draft),'_blank','noopener');document.querySelector('#result').textContent='WhatsApp opened with your prepared enquiry. Please press Send in WhatsApp to deliver it.';});
document.querySelectorAll('.spotlight-media img').forEach(image => {
  function showPlaceholder() {
    image.hidden = true;
    image.nextElementSibling.hidden = false;
  }

  image.addEventListener('error', showPlaceholder, { once: true });
  if (image.complete && !image.naturalWidth) showPlaceholder();
});
