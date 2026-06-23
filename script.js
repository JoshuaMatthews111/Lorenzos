const toggle=document.querySelector('.mobile-toggle');
const nav=document.querySelector('.nav-links');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});

const search=document.querySelector('#trainerSearch');
const buttons=[...document.querySelectorAll('.filter-btn')];
const cards=[...document.querySelectorAll('.trainer-card')];
const count=document.querySelector('#trainerCount');
let filter='';
function updateTrainers(){
  const term=((search?.value||'')+' '+filter).trim().toLowerCase();
  cards.forEach(card=>card.hidden=term&&!term.split(/\s+/).every(word=>card.dataset.search.includes(word)));
  const visible=cards.filter(card=>!card.hidden).length;
  if(count) count.textContent=`${visible} trainer${visible===1?'':'s'} shown`;
}
search?.addEventListener('input',updateTrainers);
buttons.forEach(button=>button.addEventListener('click',()=>{
  buttons.forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  filter=button.dataset.filter;
  updateTrainers();
}));

const reviewButtons=[...document.querySelectorAll('.review-expand')];
if(reviewButtons.length){
  const lightbox=document.createElement('div');
  lightbox.className='review-lightbox';
  lightbox.setAttribute('role','dialog');
  lightbox.setAttribute('aria-modal','true');
  lightbox.setAttribute('aria-label','Expanded Google review screenshot');
  lightbox.innerHTML='<div class="review-lightbox-inner"><button class="review-lightbox-close" type="button" aria-label="Close expanded review">×</button><img alt=""></div>';
  document.body.appendChild(lightbox);

  const image=lightbox.querySelector('img');
  const close=lightbox.querySelector('.review-lightbox-close');
  const closeLightbox=()=>{
    lightbox.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    image.removeAttribute('src');
  };

  reviewButtons.forEach(button=>button.addEventListener('click',()=>{
    image.src=button.dataset.reviewSrc;
    image.alt=button.dataset.reviewAlt||'Expanded Google review screenshot';
    lightbox.classList.add('open');
    document.body.classList.add('lightbox-open');
    close.focus();
  }));

  close.addEventListener('click',closeLightbox);
  lightbox.addEventListener('click',event=>{if(event.target===lightbox) closeLightbox()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&lightbox.classList.contains('open')) closeLightbox()});
}
