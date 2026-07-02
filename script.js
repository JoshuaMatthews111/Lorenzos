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

const contactForm=document.querySelector('.contact-intake');
if(contactForm){
  const status=contactForm.querySelector('.form-status');
  const setStatus=(message,type='success')=>{
    if(!status) return;
    status.className=`form-status ${type}`;
    status.innerHTML=message;
  };
  const serialize=()=>{
    const data=new FormData(contactForm);
    data.set('timestamp',new Date().toISOString());
    data.set('page_url',window.location.href);
    data.set('source_page',document.title);
    return data;
  };
  contactForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!contactForm.reportValidity()) return;
    const data=serialize();
    const entries=Object.fromEntries(data.entries());
    const submissions=JSON.parse(localStorage.getItem('ldttContactSubmissions.v1')||'[]');
    submissions.push(entries);
    localStorage.setItem('ldttContactSubmissions.v1',JSON.stringify(submissions));

    const endpoint=contactForm.dataset.googleFormEndpoint;
    if(endpoint){
      try{
        await fetch(endpoint,{method:'POST',mode:'no-cors',body:data});
      }catch(error){
        console.warn('LDTT form endpoint failed',error);
      }
    }

    const forwardEmail=contactForm.dataset.forwardEmail||'production@lorenzosdogtrainingteam.com';
    const subject=encodeURIComponent(`LDTT website inquiry: ${entries.first_name||''} ${entries.last_name||''}`.trim());
    const body=encodeURIComponent(Object.entries(entries).map(([key,value])=>`${key}: ${value}`).join('\n'));
    const mailto=`mailto:${forwardEmail}?subject=${subject}&body=${body}`;
    setStatus(`Thank you for contacting Lorenzo's Dog Training Team. Your inquiry has been received. Someone from our team will reach out within 24-48 hours on business days. <a href="${mailto}">Send office email backup</a>`);
    contactForm.reset();
  });
}

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
