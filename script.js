(()=>{
const toggle=document.querySelector('.mobile-toggle');
const nav=document.querySelector('.nav-links');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});

const search=document.querySelector('#trainerSearch');
const buttons=[...document.querySelectorAll('.filter-btn')];
let cards=[...document.querySelectorAll('.trainer-card')];
const count=document.querySelector('#trainerCount');
let filter='';

const escapePublicText=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const publicReviewMediaUrl=value=>{
  const url=String(value||'').trim();
  if(!url) return '';
  if(/^(data:|blob:|https?:|\/)/i.test(url)) return url;
  const config=window.LDTT_SUPABASE||{};
  const base=String(config.projectUrl||'https://ptnzaeprvkgjgtupmcty.supabase.co').replace(/\/$/,'');
  return `${base}/storage/v1/object/public/trainer-submissions/${url.split('/').map(encodeURIComponent).join('/')}`;
};
const publicReviewMediaType=(row,notes)=>{
  const explicit=String(row?.file_type||'').toLowerCase();
  if(explicit) return explicit;
  const attachedType=String(notes||'').match(/Attached file noted:\s*[^\n(]+?\(([^)]+)\)/i)?.[1]?.trim().toLowerCase()||'';
  if(attachedType&&attachedType!=='unknown type') return attachedType;
  const sourceUrl=String(row?.file_url||'');
  if(/(?:youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|loom\.com|dropbox\.com)/i.test(sourceUrl)) return 'video/embed';
  const fileName=sourceUrl.split('?')[0].split('/').pop().toLowerCase();
  if(/\.(mp4|mov|m4v|webm)$/.test(fileName)) return 'video/'+fileName.split('.').pop().replace('mov','quicktime');
  if(/\.(jpg|jpeg|png|gif|webp|heic)$/.test(fileName)) return 'image/'+fileName.split('.').pop().replace('jpg','jpeg');
  return '';
};
const publicReviewVideoMarkup=(url,label)=>{
  const clean=String(url||'').trim();
  if(/youtube\.com\/embed|player\.vimeo\.com\/video|drive\.google\.com\/file\/d\/[^/]+\/preview|loom\.com\/embed/i.test(clean)){
    return `<iframe src="${escapePublicText(clean)}" title="${escapePublicText(label||'Client review video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }
  return `<video controls preload="metadata" playsinline src="${escapePublicText(clean)}"></video>`;
};
const paragraphizeTrainerBio=text=>{
  const clean=String(text||'').trim();
  if(!clean) return '<p>Full trainer bio is pending office approval for the new site.</p>';
  return clean.split(/\n{2,}|(?<=\.)\s+(?=[A-Z][a-z])/).map(part=>part.trim()).filter(Boolean).map(part=>`<p>${escapePublicText(part)}</p>`).join('');
};
const publicTrainerLocation=record=>{
  const market=String(record?.market||'').trim();
  const state=String(record?.state||'').trim();
  if(!market) return state;
  if(!state||market.includes(',')) return market;
  return `${market}, ${state}`;
};
const publicTrainerBioPhoto=(record,fallback='')=>{
  const publishedContent=record?.publishedPage?.published_content||{};
  return publishedContent.landing_bio_photo_url||publishedContent.bio_photo_url||fallback||record?.headshot_url||'assets/lorenzo-logo-transparent.png';
};
const publicSlugify=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const safeTrainerHeadshotUrl=value=>{
  const url=String(value||'').trim();
  const match=url.match(/^(\/?assets\/trainer-headshots\/)([^?#]+)(.*)$/i);
  if(!match) return url;
  const decoded=decodeURIComponent(match[2]);
  const extension=decoded.includes('.')?decoded.split('.').pop():'jpg';
  const stem=decoded.replace(/\.[^.]+$/,'');
  return `/assets/trainer-headshots/${publicSlugify(stem)}.${extension}${match[3]||''}`;
};
const publicTrainerDisplaySlug=record=>{
  const slug=publicSlugify(record?.slug);
  const nameSlug=publicSlugify(record?.full_name);
  const blocked=new Set(['','new-trainer','new-trainer-draft','newtrainerdraft','trainer','draft-trainer','office-draft']);
  if(nameSlug&&!['new-trainer','new-trainer-draft'].includes(nameSlug)&&(blocked.has(slug)||/^office-draft-\d+$/.test(slug))) return nameSlug;
  return slug||nameSlug;
};
const publicTrainerSlugIsReady=record=>Boolean(publicTrainerDisplaySlug(record));
const publicTrainerProfilesPromise=(async()=>{
  const config=window.LDTT_SUPABASE||{};
  if(!config.enabled||!config.projectUrl||!config.publishableKey) return new Map();
  try{
    const base=String(config.projectUrl).replace(/\/$/,'');
    const headers={apikey:config.publishableKey};
    const [trainerResponse,pageResponse]=await Promise.all([
      fetch(`${base}/rest/v1/trainers?select=id,slug,full_name,market,state,service_area,bio,headshot_url,status,access_status&status=eq.active&access_status=eq.active`,{headers}),
      fetch(`${base}/rest/v1/trainer_pages?select=trainer_id,slug,page_status,locked,published_content&page_status=eq.published&locked=eq.true`,{headers})
    ]);
    if(!trainerResponse.ok) throw new Error(`Trainer profile request failed (${trainerResponse.status})`);
    const rows=await trainerResponse.json();
    const publishedPages=pageResponse.ok?await pageResponse.json():[];
    const publishedByTrainer=new Map((publishedPages||[]).map(page=>[page.trainer_id,page]));
    return new Map((rows||[]).map(row=>[row.slug,{...row,publishedPage:publishedByTrainer.get(row.id)||null}]));
  }catch(error){
    console.warn('Live trainer profiles could not be loaded',error);
    return new Map();
  }
})();
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

publicTrainerProfilesPromise.then(profiles=>{
  const trainerGrid=document.querySelector('#trainerGrid');
  profiles.forEach(record=>{
    if(!publicTrainerSlugIsReady(record)) return;
    const displaySlug=publicTrainerDisplaySlug(record);
    if(!trainerGrid||!record.publishedPage||trainerGrid.querySelector(`[data-trainer-slug="${CSS.escape(displaySlug)}"]`)) return;
    const location=publicTrainerLocation(record);
    const publicSlug=displaySlug.replaceAll('-','');
    const article=document.createElement('article');
    article.className='trainer-card';
    article.dataset.trainerSlug=displaySlug;
    article.dataset.search=`${record.full_name||''} ${location} ${record.service_area||''}`.toLowerCase();
    article.innerHTML=`<div class="trainer-photo-frame"><img src="${escapePublicText(safeTrainerHeadshotUrl(record.headshot_url)||'assets/lorenzo-logo-transparent.png')}" alt="${escapePublicText(record.full_name||'Lorenzo trainer')}" loading="lazy"></div><div class="trainer-info"><span class="tag">${escapePublicText(record.state||'Trainer Network')}</span><h3>${escapePublicText(record.full_name||'Lorenzo Trainer')}</h3><p class="trainer-card-location">${escapePublicText(location)}</p><p class="trainer-bio">${escapePublicText(String(record.bio||'Office-approved trainer profile.').slice(0,220))}</p><div class="trainer-links"><a class="link" href="trainer-bio-${escapePublicText(displaySlug)}.html">View bio →</a><a class="link" href="/${escapePublicText(publicSlug)}#contact">Schedule this trainer →</a></div></div>`;
    trainerGrid.appendChild(article);
    cards.push(article);
  });
  document.querySelectorAll('[data-trainer-slug]').forEach(card=>{
    const record=profiles.get(card.dataset.trainerSlug);
    if(!record) return;
    const location=publicTrainerLocation(record);
    const name=card.querySelector('.trainer-info h3');
    if(name&&record.full_name) name.textContent=record.full_name;
    const stateTag=card.querySelector('.trainer-info .tag');
    if(stateTag&&record.state) stateTag.textContent=record.state;
    const locationNode=card.querySelector('.trainer-card-location');
    if(locationNode) locationNode.textContent=location;
    card.dataset.search=`${record.full_name||''} ${location} ${record.service_area||''}`.toLowerCase();
  });
  updateTrainers();
  const profile=document.querySelector('[data-trainer-profile-slug]');
  if(!profile) return;
  const record=profiles.get(profile.dataset.trainerProfileSlug);
  if(!record) return;
  const location=publicTrainerLocation(record);
  const image=profile.querySelector('.trainer-profile-photo img');
  const bioPhoto=publicTrainerBioPhoto(record,image?.getAttribute('src')||'');
  if(image&&bioPhoto){image.src=bioPhoto;image.alt=`${record.full_name} trainer bio photo`;}
  const tag=profile.querySelector('.tag');
  if(tag&&record.state) tag.textContent=record.state;
  const title=profile.querySelector('h1');
  if(title&&record.full_name) title.textContent=record.full_name;
  const locationNode=profile.querySelector('.trainer-profile-location');
  if(locationNode) locationNode.textContent=location;
  document.querySelectorAll('[data-trainer-profile-name]').forEach(node=>node.textContent=record.full_name||node.textContent);
  const fullBio=document.querySelector('[data-trainer-profile-bio]');
  if(fullBio&&record.bio) fullBio.innerHTML=paragraphizeTrainerBio(record.bio);
});

const trainerBioButtons=[...document.querySelectorAll('.trainer-bio-open')];
const trainerBioDataElement=document.querySelector('#trainerBioData');
if(trainerBioButtons.length&&trainerBioDataElement){
  let trainerBioData={};
  try{
    trainerBioData=JSON.parse(trainerBioDataElement.textContent||'{}');
  }catch(error){
    console.warn('Unable to parse trainer bio data',error);
  }
  const modal=document.createElement('div');
  modal.className='trainer-bio-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Trainer bio');
  modal.innerHTML=`<div class="trainer-bio-panel">
    <button class="trainer-bio-close" type="button" aria-label="Close trainer bio">×</button>
    <div class="trainer-bio-layout">
      <figure class="trainer-bio-image"><img alt=""></figure>
      <div class="trainer-bio-content">
        <span class="tag"></span>
        <h2></h2>
        <p class="trainer-bio-location"></p>
        <div class="trainer-bio-copy"></div>
        <div class="trainer-bio-actions">
          <a class="btn btn-red" href="contact.html">Book This Trainer</a>
          <button class="btn btn-outline trainer-bio-close-secondary" type="button">Back to Trainers</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const closeButtons=[...modal.querySelectorAll('.trainer-bio-close,.trainer-bio-close-secondary')];
  const image=modal.querySelector('.trainer-bio-image img');
  const tag=modal.querySelector('.tag');
  const title=modal.querySelector('h2');
  const location=modal.querySelector('.trainer-bio-location');
  const copy=modal.querySelector('.trainer-bio-copy');
  const scheduleLink=modal.querySelector('.trainer-bio-actions a');
  const closeModal=()=>{
    modal.classList.remove('open');
    document.body.classList.remove('bio-open');
  };
  trainerBioButtons.forEach(button=>button.addEventListener('click',async()=>{
    const liveProfiles=await publicTrainerProfilesPromise;
    const live=liveProfiles.get(button.dataset.trainerSlug);
    if(live&&trainerBioData[button.dataset.trainerSlug]){
      const current=trainerBioData[button.dataset.trainerSlug];
      trainerBioData[button.dataset.trainerSlug]={...current,name:live.full_name||current.name,location:publicTrainerLocation(live)||current.location,state:live.state||current.state,bio:live.bio||current.bio,bioPhoto:publicTrainerBioPhoto(live,current.bioPhoto)||current.bioPhoto,cardPhoto:live.headshot_url||current.cardPhoto};
    }
    const record=trainerBioData[button.dataset.trainerSlug];
    if(!record) return;
    image.src=record.bioPhoto||record.cardPhoto;
    image.alt=`${record.name} trainer bio photo`;
    tag.textContent=record.state||'Lorenzo Trainer';
    title.textContent=record.name;
    location.textContent=record.location||'';
    copy.innerHTML=paragraphizeTrainerBio(record.bio);
    scheduleLink.href=`${record.pageSlug||record.slug.replaceAll('-','')}.html#contact`;
    scheduleLink.textContent='Schedule This Trainer';
    modal.classList.add('open');
    document.body.classList.add('bio-open');
    modal.querySelector('.trainer-bio-close').focus();
  }));
  closeButtons.forEach(button=>button.addEventListener('click',closeModal));
  modal.addEventListener('click',event=>{if(event.target===modal) closeModal()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open')) closeModal()});
}

const requiredControls=[...document.querySelectorAll('input[required],select[required],textarea[required]')];
const addRequiredMark=(container,beforeNode=null)=>{
  if(!container||container.querySelector(':scope > .required-mark')) return;
  const ownText=[...container.childNodes]
    .filter(node=>node.nodeType===Node.TEXT_NODE)
    .map(node=>node.textContent||'')
    .join(' ');
  if(ownText.includes('*')) return;
  const mark=document.createElement('span');
  mark.className='required-mark';
  mark.textContent=' *';
  mark.setAttribute('aria-hidden','true');
  if(beforeNode) container.insertBefore(mark,beforeNode);
  else container.appendChild(mark);
};
requiredControls.forEach(control=>{
  if(control instanceof HTMLInputElement&&control.type==='radio'){
    const legend=control.closest('fieldset')?.querySelector(':scope > legend');
    addRequiredMark(legend);
    return;
  }
  const label=control.closest('label');
  if(!label) return;
  if(control instanceof HTMLInputElement&&control.type==='checkbox'&&label.classList.contains('consent-row')){
    addRequiredMark(label.querySelector(':scope > span'),label.querySelector(':scope > span')?.firstChild||null);
    return;
  }
  addRequiredMark(label,control);
});

document.addEventListener('invalid',event=>{
  const control=event.target;
  if(!(control instanceof HTMLElement)) return;
  control.classList.add('field-invalid');
  control.closest('label,fieldset,details')?.classList.add('field-invalid-wrap');
  window.setTimeout(()=>control.scrollIntoView({behavior:'smooth',block:'center'}),0);
},{capture:true});

document.addEventListener('input',event=>{
  const control=event.target;
  if(!(control instanceof HTMLInputElement||control instanceof HTMLSelectElement||control instanceof HTMLTextAreaElement)) return;
  if(control.checkValidity()){
    control.classList.remove('field-invalid');
    control.closest('label,fieldset,details')?.classList.remove('field-invalid-wrap');
  }
});

const formToObject=formData=>{
  const result={};
  formData.forEach((value,key)=>{
    if(key in result){
      result[key]=Array.isArray(result[key])?[...result[key],value]:[result[key],value];
      return;
    }
    result[key]=value;
  });
  return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,Array.isArray(value)?value.join(', '):value]));
};

const buildMailPayload=(entries,subject)=>{
  const payload=new FormData();
  Object.entries(entries).forEach(([key,value])=>payload.append(key,value));
  payload.append('_subject',subject);
  payload.append('_captcha','false');
  payload.append('_template','table');
  return payload;
};

const submitEmailRelay=async (endpoint,entries,subject)=>{
  if(!endpoint) throw new Error('Missing email endpoint');
  const response=await fetch(endpoint,{
    method:'POST',
    body:buildMailPayload(entries,subject),
    headers:{Accept:'application/json'},
  });
  const text=await response.text();
  let result={};
  try{
    result=text?JSON.parse(text):{};
  }catch(error){
    throw new Error(`Email relay returned an unreadable response: ${text.slice(0,160)}`);
  }
  if(!response.ok||String(result.success).toLowerCase()==='false'){
    throw new Error(result.message||`Email relay returned ${response.status}`);
  }
  return result;
};

const submitPublicFormToSupabase=async (functionName,entries)=>{
  const config=window.LDTT_SUPABASE;
  if(!config?.enabled||!config.functionsBaseUrl) return {skipped:true};
  const response=await fetch(`${config.functionsBaseUrl.replace(/\/$/,'')}/${functionName}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(entries)
  });
  if(!response.ok){
    const text=await response.text();
    throw new Error(`Supabase ${functionName} failed: ${response.status} ${text}`);
  }
  return response.json();
};

const TRAINER_ATTRIBUTION_KEY='ldttTrainerAttribution.v1';

const persistTrainerAttributionFromUrl=()=>{
  const params=new URLSearchParams(window.location.search);
  const trainerSource=params.get('trainer_source');
  if(!trainerSource) return;
  const attribution={
    trainer_slug:trainerSource,
    trainer_name:params.get('trainer_name')||'',
    source_page:params.get('source_page')||document.title,
    captured_at:new Date().toISOString(),
    landing_referrer:document.referrer||''
  };
  sessionStorage.setItem(TRAINER_ATTRIBUTION_KEY,JSON.stringify(attribution));
};

const applyStoredTrainerAttribution=data=>{
  let attribution=null;
  try{
    attribution=JSON.parse(sessionStorage.getItem(TRAINER_ATTRIBUTION_KEY)||'null');
  }catch(error){
    attribution=null;
  }
  if(!attribution) return;
  if(!data.get('trainer_name')&&attribution.trainer_name) data.set('trainer_name',attribution.trainer_name);
  if(!data.get('assigned_trainer')&&attribution.trainer_name) data.set('assigned_trainer',attribution.trainer_name);
  if(!data.get('trainer_slug')&&attribution.trainer_slug) data.set('trainer_slug',attribution.trainer_slug);
  if(!data.get('trainer_referral_source')) data.set('trainer_referral_source',attribution.source_page||'trainer_landing_footer');
};

persistTrainerAttributionFromUrl();

const showFormSuccessModal=(message)=>{
  let modal=document.querySelector('.form-success-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.className='form-success-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Form submitted');
    modal.innerHTML=`<div class="form-success-card">
      <button class="form-success-close" type="button" aria-label="Close confirmation">×</button>
      <span class="form-success-kicker">Request received</span>
      <h2>Thank you.</h2>
      <p></p>
      <button class="btn btn-red form-success-ok" type="button">Close</button>
    </div>`;
    document.body.appendChild(modal);
    const close=()=>{
      modal.classList.remove('open');
      document.body.classList.remove('form-modal-open');
    };
    modal.querySelector('.form-success-close').addEventListener('click',close);
    modal.querySelector('.form-success-ok').addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal) close()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open')) close()});
  }
  modal.querySelector('p').textContent=message;
  modal.classList.add('open');
  document.body.classList.add('form-modal-open');
  modal.querySelector('.form-success-ok').focus();
};

const trackLdttConversion=(eventName,details={})=>{
  const payload={event:eventName,...details};
  window.dataLayer=window.dataLayer||[];
  window.dataLayer.push(payload);
  if(typeof window.gtag==='function'){
    window.gtag('event',eventName,details);
  }
};

const ldttVisitorId=()=>{
  let value=localStorage.getItem('ldttAnonymousVisitorId');
  if(!value){value=globalThis.crypto?.randomUUID?.()||`visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem('ldttAnonymousVisitorId',value)}
  return value;
};
const ldttSessionId=()=>{
  let value=sessionStorage.getItem('ldttPublicSession');
  if(!value){value=globalThis.crypto?.randomUUID?.()||`session-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem('ldttPublicSession',value)}
  return value;
};
const isReleaseQaHost=/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)||/\.vercel\.app$/i.test(window.location.hostname);
const firstPartySiteEvent=(eventType,details={})=>{
  const params=new URLSearchParams(window.location.search);
  const payload={
    event_id:`${isReleaseQaHost?'qa-release-':''}${globalThis.crypto?.randomUUID?.()||`event-${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
    event_type:eventType,
    qa:isReleaseQaHost,
    visitor_id:ldttVisitorId(),
    session_id:ldttSessionId(),
    page_path:window.location.pathname,
    page_url:window.location.href,
    referrer:document.referrer,
    user_agent:navigator.userAgent,
    market:document.querySelector('[name="market"],[name="trainer_market"],[name="opportunity_market"]')?.value||'',
    utm_source:params.get('utm_source')||'',
    utm_medium:params.get('utm_medium')||'',
    utm_campaign:params.get('utm_campaign')||'',
    timestamp:new Date().toISOString(),
    ...details
  };
  return submitPublicFormToSupabase('track-site-event',payload).catch(error=>console.warn('LDTT first-party tracking failed',error));
};

const pageViewKey=`ldtt-page-viewed:${window.location.pathname}${window.location.search}`;
if(!sessionStorage.getItem(pageViewKey)){
  sessionStorage.setItem(pageViewKey,'1');
  firstPartySiteEvent(/trainer-opportunity-|dog-training-/.test(window.location.pathname)?'market_page_view':'page_view');
}
document.addEventListener('click',event=>{
  const target=event.target.closest('a,button');
  if(!target||target.closest('.mobile-toggle,.form-success-modal')) return;
  const href=target.getAttribute('href')||'';
  if(!target.matches('.btn,[type="submit"]')&&!/contact|trainer-application|tel:|#form|#application/.test(href)) return;
  firstPartySiteEvent('cta_click',{cta_text:String(target.textContent||'').trim().slice(0,160),cta_href:href.slice(0,500)});
});

const wireAsyncForm=(form,{storageKey,successMessage,onSubmit})=>{
  const status=form.querySelector('.form-status');
  const setStatus=(message,type='success')=>{
    if(!status) return;
    status.className=`form-status ${type}`;
    status.innerHTML=message;
  };
  const serialize=()=>{
    const data=new FormData(form);
    const params=new URLSearchParams(window.location.search);
    data.set('timestamp',new Date().toISOString());
    data.set('visitor_id',ldttVisitorId());
    data.set('session_id',ldttSessionId());
    data.set('page_url',window.location.href);
    data.set('sms_consent',data.get('sms_consent')==='yes'?'yes':'no');
    if(form.classList.contains('trainer-application-form')){
      const smsText=String(form.querySelector('input[name="sms_consent"]')?.closest('label')?.textContent||'').replace(/\s+/g,' ').trim();
      const certificationText=String(form.querySelector('input[name="application_certification"]')?.closest('label')?.textContent||'').replace(/\s+/g,' ').trim();
      if(smsText) data.set('sms_consent_text',smsText);
      if(certificationText) data.set('application_certification_text',certificationText);
    }
    if(isReleaseQaHost) data.set('qa','true');
    if(!data.get('source_page')) data.set('source_page',document.title);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid'].forEach(key=>{
      const value=params.get(key);
      if(value) data.set(key,value);
    });
    applyStoredTrainerAttribution(data);
    return data;
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(form.dataset.submitting==='true') return;
    if(!form.reportValidity()) return;
    const submitButton=form.querySelector('button[type="submit"]');
    const data=serialize();
    const entries=formToObject(data);
    entries.submission_id=`${isReleaseQaHost?'qa-release-':'web-'}${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    form.dataset.submitting='true';
    submitButton?.setAttribute('disabled','disabled');
    setStatus('Submitting securely...','pending');
    try{
      await onSubmit(data,entries,form);
      setStatus(successMessage,'success');
      showFormSuccessModal(successMessage);
      trackLdttConversion(form.dataset.conversionEvent||'ldtt_form_submit',{
        form_type:form.dataset.formType||'contact',
        source_page:entries.source_page,
        page_url:entries.page_url,
        trainer_name:entries.trainer_name||entries.assigned_trainer||'',
        submission_id:entries.submission_id
      });
      form.reset();
    }catch(error){
      console.warn('LDTT form submission failed',error);
      setStatus(error.message||'We could not submit the form. Your information is still on this screen; please try again.','error');
    }finally{
      delete form.dataset.submitting;
      submitButton?.removeAttribute('disabled');
    }
  });
};

const relayFormDeliveries=async(formType,entries,canonical,form)=>{
  const response=await fetch('/api/form-delivery',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({form_type:formType,entries,canonical})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false) throw new Error(result.message||'The office backup delivery could not be logged.');
  const emailFailed=result.deliveries?.some(delivery=>delivery.destination==='formsubmit_email'&&delivery.status==='failed');
  if(emailFailed){
    const isApplication=formType==='trainer_application'||Boolean(canonical?.application_id);
    const endpoint=isApplication
      ? 'https://formsubmit.co/ajax/recruiting@lorenzosdogtrainingteam.com'
      : form?.dataset.emailEndpoint||'https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com';
    const subject=isApplication
      ? "New Lorenzo's Dog Training Team Trainer Application"
      : "New Lorenzo's Dog Training Team Contact Form Submission";
    try{
      await submitEmailRelay(endpoint,entries,subject);
      await fetch('/api/form-delivery',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({form_type:formType,entries,canonical,client_delivery:{destination:'formsubmit_email',status:'accepted'}})
      });
      result.deliveries=result.deliveries.map(delivery=>delivery.destination==='formsubmit_email'?{...delivery,status:'accepted',via:'browser_fallback'}:delivery);
      result.delivery_complete=result.deliveries.every(delivery=>delivery.status==='accepted');
    }catch(error){
      await fetch('/api/form-delivery',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({form_type:formType,entries,canonical,client_delivery:{destination:'formsubmit_email',status:'failed',error:error.message||String(error)}})
      }).catch(()=>{});
    }
  }
  return result;
};

window.LDTT_FORM_DELIVERY={
  submitCanonical:submitPublicFormToSupabase,
  relay:relayFormDeliveries
};

const updateStoredDelivery=(storageKey,submissionId,updates)=>{
  const rows=JSON.parse(localStorage.getItem(storageKey)||'[]');
  const row=rows.find(item=>item.submission_id===submissionId);
  if(!row) return;
  Object.assign(row,updates,{delivery_updated_at:new Date().toISOString()});
  localStorage.setItem(storageKey,JSON.stringify(rows));
};

const appendGoogleField=(payload,entryName,value)=>{
  if(value===undefined||value===null||value==='') return;
  payload.append(entryName,value);
  const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(match){
    payload.append(`${entryName}_year`,match[1]);
    payload.append(`${entryName}_month`,String(Number(match[2])));
    payload.append(`${entryName}_day`,String(Number(match[3])));
  }
};

const contactForm=document.querySelector('.contact-intake');
if(contactForm){
  const interest=new URLSearchParams(window.location.search).get('interest');
  if(interest==='trainer'){
    const intent=contactForm.querySelector('[name="i_want_to"]');
    if(intent) intent.value='Learn more about becoming a dog trainer';
  }
  wireAsyncForm(contactForm,{
    storageKey:'ldttContactSubmissions.v2',
    successMessage:contactForm.dataset.successMessage||"Thank you, your request was submitted. Lorenzo's office has your details and will follow up with the next step.",
    onSubmit:async (data,entries,form)=>{
      if(entries.additional_interest){
        entries.comments=[entries.comments,`Additional interest: ${entries.additional_interest}.`].filter(Boolean).join('\n\n');
      }
      const canonical=await submitPublicFormToSupabase('submit-contact',entries);
      if(canonical?.skipped||(!canonical?.lead_id&&!canonical?.application_id)) throw new Error('The live office record could not be confirmed. Please try again.');
      await relayFormDeliveries('contact',entries,canonical,form);
    }
  });
}

document.querySelectorAll('a[href="contact.html#form"]').forEach(link=>{
  if(/discovery call/i.test(link.textContent||'')) link.href='contact?interest=trainer#form';
});

const trainerApplicationForm=document.querySelector('.trainer-application-form');
if(trainerApplicationForm){
  wireAsyncForm(trainerApplicationForm,{
    storageKey:'ldttTrainerApplications.v1',
    successMessage:trainerApplicationForm.dataset.successMessage||"Thank you, your application was submitted. Lorenzo's team has your details and will review the next step.",
    onSubmit:async (_data,entries,form)=>{
      const canonical=await submitPublicFormToSupabase('submit-trainer-application',entries);
      if(canonical?.skipped||!canonical?.application_id) throw new Error('The live recruiting record could not be confirmed. Please try again.');
      await relayFormDeliveries('trainer_application',entries,canonical,form);
      /* Google field IDs are retained here as documentation for the existing response Sheet.
        const mapping={
          referral_source:'entry.1014703398',
          first_name:'entry.2122990920',
          last_name:'entry.1929607028',
          address_line_1:'entry.1645633690',
          address_line_2:'entry.135249690',
          city:'entry.1748202742',
          state:'entry.2020991517',
          zip:'entry.571508260',
          email:'entry.1253830522',
          phone:'entry.800594511',
          birthdate:'entry.873028304',
          legally_eligible:'entry.97737336',
          drug_test:'entry.1275212285',
          felony:'entry.1958281416',
          felony_explanation:'entry.815056594',
          conviction_date:'entry.1143329636',
          release_date:'entry.1439310749',
          comfortable_dogs:'entry.670957847',
          dog_bite_history:'entry.1707158396',
          dog_bite_explanation:'entry.2145345523',
          owns_dogs:'entry.1988135929',
          owned_dogs_description:'entry.1094860147',
          physical_condition:'entry.227429315',
          workout:'entry.102480538',
          lift_100:'entry.601987128',
          run_2_miles:'entry.1532917240',
          smoke:'entry.713607391',
          team_player:'entry.66684546',
          reliable_vehicle:'entry.1724490144',
          drivers_license:'entry.1218423081',
          cleveland_training:'entry.888408530',
          education_level:'entry.793600705',
          high_school:'entry.1953995847',
          trade_school:'entry.1490513837',
          military:'entry.2056174117',
          college:'entry.1815093587',
          additional_training:'entry.793731999',
          employment_1_company:'entry.1488216150',
          employment_1_country:'entry.714246596',
          employment_1_address:'entry.395257221',
          employment_1_city:'entry.964388364',
          employment_1_state:'entry.2100450771',
          employment_1_zip:'entry.274112135',
          employment_1_status:'entry.1554856963',
          employment_1_start_date:'entry.820232514',
          employment_1_end_date:'entry.1071602769',
          employment_1_job_title:'entry.756139358',
          employment_1_salary:'entry.2042956180',
          employment_1_reason:'entry.1045830789',
          employment_2_company:'entry.1443831840',
          employment_2_country:'entry.1175062898',
          employment_2_address:'entry.642818623',
          employment_2_city:'entry.1080427807',
          employment_2_state:'entry.1790378360',
          employment_2_zip:'entry.1826574956',
          employment_2_status:'entry.1922536714',
          employment_2_start_date:'entry.575992373',
          employment_2_end_date:'entry.288413258',
          employment_2_job_title:'entry.1708812599',
          employment_2_salary:'entry.1872315917',
          employment_2_reason:'entry.667445931',
          employment_3_company:'entry.800567808',
          employment_3_country:'entry.938860105',
          employment_3_address:'entry.331449172',
          employment_3_city:'entry.1787546636',
          employment_3_state:'entry.330991090',
          employment_3_zip:'entry.149620483',
          employment_3_status:'entry.751506828',
          employment_3_start_date:'entry.531104459',
          employment_3_end_date:'entry.1541940157',
          employment_3_job_title:'entry.66305101',
          employment_3_salary:'entry.1444857719',
          employment_3_reason:'entry.1881584314',
          signature:'entry.1320607832',
        }; */
    }
  });
}

const readReviewFile=file=>new Promise((resolve,reject)=>{
  if(!file){resolve('');return}
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(reader.error||new Error('The file could not be read.'));
  reader.readAsDataURL(file);
});

const submitReviewToOfficeQueue=async payload=>{
  try{
    const response=await fetch('/api/submit-content-review',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const text=await response.text();
    let result={};
    try{result=text?JSON.parse(text):{}}catch{result={message:text}}
    if(!response.ok||result.ok===false) throw new Error(result.message||`Review submission failed (${response.status})`);
    return result;
  }catch(apiError){
    const config=window.LDTT_SUPABASE||{};
    if(!config.enabled||!config.functionsBaseUrl) throw apiError;
    const response=await fetch(`${config.functionsBaseUrl.replace(/\/$/,'')}/submit-content-review`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const text=await response.text();
    let result={};
    try{result=text?JSON.parse(text):{}}catch{result={message:text}}
    if(!response.ok||result.ok===false) throw new Error(result.message||result.error||`Review submission failed (${response.status})`);
    return result;
  }
};

const homepageReviewForm=document.querySelector('.home-public-review-form');
const homeReviewModal=document.querySelector('.home-review-modal');
const openHomeReviewButtons=[...document.querySelectorAll('[data-open-home-review], a[href="#home-review-form"]')];
const closeHomeReview=()=>{
  if(!homeReviewModal) return;
  homeReviewModal.classList.remove('open');
  homeReviewModal.setAttribute('aria-hidden','true');
  document.body.classList.remove('review-modal-open');
};
const openHomeReview=()=>{
  if(!homeReviewModal) return;
  homeReviewModal.classList.add('open');
  homeReviewModal.setAttribute('aria-hidden','false');
  document.body.classList.add('review-modal-open');
  homeReviewModal.querySelector('input,select,textarea,button')?.focus();
};
openHomeReviewButtons.forEach(button=>button.addEventListener('click',event=>{
  event.preventDefault();
  openHomeReview();
}));
homeReviewModal?.querySelector('.home-review-modal-close')?.addEventListener('click',closeHomeReview);
homeReviewModal?.addEventListener('click',event=>{if(event.target===homeReviewModal) closeHomeReview()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&homeReviewModal?.classList.contains('open')) closeHomeReview()});
if(window.location.hash==='#home-review-form') window.setTimeout(openHomeReview,250);

if(homepageReviewForm&&!homepageReviewForm.querySelector('[name="review_video_url"]')){
  const uploadLabel=homepageReviewForm.querySelector('[name="review_file"]')?.closest('label');
  uploadLabel?.insertAdjacentHTML('afterend','<label class="wide">Or paste a review video link <input type="url" name="review_video_url" placeholder="YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM"></label>');
}

if(homepageReviewForm){
  homepageReviewForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    if(form.dataset.submitting==='true') return;
    if(!form.reportValidity()) return;
    const status=form.querySelector('.public-review-status');
    const button=form.querySelector('button[type="submit"]');
    const setStatus=(message,type='success')=>{
      if(!status) return;
      status.className=`public-review-status ${type}`;
      status.textContent=message;
    };
    const entries=Object.fromEntries(new FormData(form).entries());
    const file=form.querySelector('input[name="review_file"]')?.files?.[0]||null;
    if(file&&file.size>25*1024*1024){
      setStatus('Please upload a file under 25 MB for this review form.', 'error');
      return;
    }
    form.dataset.submitting='true';
    button?.setAttribute('disabled','disabled');
    setStatus('Submitting your review to Lorenzo’s office...');
    try{
      const fileDataUrl=await readReviewFile(file);
      const payload={
        ...entries,
        submission_id:`${isReleaseQaHost?'qa-release-':'homepage-review-'}${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        qa:isReleaseQaHost,
        page_url:window.location.href,
        timestamp:new Date().toISOString(),
        file:file?{name:file.name,type:file.type,size:file.size,data_url:fileDataUrl}:null
      };
      await submitReviewToOfficeQueue(payload);
      form.reset();
      setStatus('Thank you. Your review is now pending office approval.');
      showFormSuccessModal('Thank you. Your review was submitted for Lorenzo’s office to review before it is posted.');
      window.setTimeout(closeHomeReview,900);
    }catch(error){
      console.warn('LDTT homepage review submission failed',error);
      setStatus('We could not send your review to the office queue. Your entries remain on this screen; please try again.', 'error');
    }finally{
      window.setTimeout(()=>{
        delete form.dataset.submitting;
        button?.removeAttribute('disabled');
      },4000);
    }
  });
}

const reviewCarousel=document.querySelector('[data-review-carousel]');
const reviewRail=reviewCarousel?.querySelector('.review-shot-grid');
const approvedHomeReviewRail=reviewRail;
const approvedHomepageReviewCards=rows=>(Array.isArray(rows)?rows:[]).map(row=>{
  const notes=String(row.notes||'');
  const reviewer=(row.reviewer||String(row.title||'').replace(/^Website review from\s+/i,'').trim())||'Verified Client';
  const reviewMarker='\nReview: ';
  const reviewText=row.review_text||(notes.includes(reviewMarker)?notes.slice(notes.indexOf(reviewMarker)+reviewMarker.length).trim():notes);
  const location=row.location||notes.match(/Client location:\s*([^\n.]+)\.?/i)?.[1]?.trim()||'';
  const fileUrl=row.media_url||publicReviewMediaUrl(row.file_url);
  const fileType=String(row.media_type||publicReviewMediaType(row,notes)).toLowerCase();
  const ratingMatch=String(row.rating||'').match(/[1-5]/)||notes.match(/Star rating:\s*([1-5])/i);
  const rating=Math.max(1,Math.min(5,Number(ratingMatch?.[1]||ratingMatch?.[0]||5)));
  const media=fileUrl
    ? fileType.startsWith('video/')
      ? publicReviewVideoMarkup(fileUrl,`${reviewer} review video`)
      : `<img src="${escapePublicText(fileUrl)}" alt="Review media from ${escapePublicText(reviewer)}" loading="lazy">`
    : '';
  return `<article class="review-shot-card homepage-approved-review-card" data-approved-home-review>${media?`<div class="homepage-approved-review-media">${media}</div>`:''}<div><span class="approved-review-pill">Office-approved review</span><div class="big-stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div><blockquote>${escapePublicText(reviewText||'Office-approved client review.')}</blockquote><strong>${escapePublicText(reviewer)}</strong>${location?`<span>${escapePublicText(location)}</span>`:''}</div></article>`;
}).join('');
async function loadApprovedHomepageReviews(){
  if(!approvedHomeReviewRail) return;
  try{
    const apiResponse=await fetch('/api/approved-homepage-reviews');
    const apiData=await apiResponse.json().catch(()=>({}));
    if(!apiResponse.ok) throw new Error(apiData.message||`Approved homepage reviews request failed (${apiResponse.status})`);
    const cards=approvedHomepageReviewCards(apiData?.reviews||[]);
    if(cards) approvedHomeReviewRail.insertAdjacentHTML('afterbegin',cards);
  }catch(error){
    console.warn('Approved homepage reviews could not be loaded',error);
  }
}
loadApprovedHomepageReviews();

const approvedMarketReviewSection=document.querySelector('[data-approved-market-reviews]');
async function loadApprovedMarketReviews(){
  if(!approvedMarketReviewSection) return;
  const destination=approvedMarketReviewSection.dataset.reviewDestination||'';
  const grid=approvedMarketReviewSection.querySelector('[data-approved-market-review-grid]');
  if(!destination||!grid) return;
  try{
    const response=await fetch(`/api/approved-homepage-reviews?destination_type=city_page&destination_id=${encodeURIComponent(destination)}`);
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||`Approved market reviews request failed (${response.status})`);
    const cards=approvedHomepageReviewCards(data.reviews||[]);
    if(!cards) return;
    grid.innerHTML=cards;
    approvedMarketReviewSection.hidden=false;
  }catch(error){
    console.warn('Approved market reviews could not be loaded',error);
  }
}
loadApprovedMarketReviews();

if(reviewCarousel&&reviewRail){
  const scrollReview=direction=>{
    const card=reviewRail.querySelector('.review-shot-card');
    const amount=card?card.getBoundingClientRect().width+22:reviewCarousel.clientWidth;
    reviewCarousel.scrollBy({left:direction*amount,behavior:'smooth'});
  };
  document.querySelector('[data-review-carousel-prev]')?.addEventListener('click',()=>scrollReview(-1));
  document.querySelector('[data-review-carousel-next]')?.addEventListener('click',()=>scrollReview(1));
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

const initAdFunnelCaptureModal=()=>{
  const funnelPage=document.querySelector('.ad-funnel-redesign,.market-funnel-redesign');
  const consultation=document.querySelector('#consultation');
  if(!funnelPage||!consultation||sessionStorage.getItem('ldttAdFunnelCtaDismissed')) return;

  const modal=document.createElement('div');
  modal.className='ad-capture-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-hidden','true');
  modal.setAttribute('aria-label','Get the free dog training guide');
  modal.innerHTML=`
    <div class="ad-capture-modal-card">
      <button class="ad-capture-close" type="button" data-ad-capture-close aria-label="Close offer">×</button>
      <span>Free 5-step guide</span>
      <h2>Want a calmer dog starting today?</h2>
      <p>Get the calm dog blueprint and ask Lorenzo's office to route your training request.</p>
      <button class="btn btn-red" type="button" data-ad-capture-action>Download the Free Guide + Book My Consultation</button>
      <button class="ad-capture-secondary" type="button" data-ad-capture-close>Keep watching</button>
    </div>
  `;
  document.body.appendChild(modal);

  const openModal=()=>{
    if(sessionStorage.getItem('ldttAdFunnelCtaDismissed')) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    modal.querySelector('[data-ad-capture-action]')?.focus();
  };
  const closeModal=()=>{
    sessionStorage.setItem('ldttAdFunnelCtaDismissed','1');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  };
  const goToForm=()=>{
    closeModal();
    consultation.scrollIntoView({behavior:'smooth',block:'start'});
    window.setTimeout(()=>consultation.querySelector('input,select,textarea')?.focus(),550);
  };

  modal.querySelector('[data-ad-capture-action]')?.addEventListener('click',goToForm);
  modal.querySelectorAll('[data-ad-capture-close]').forEach(button=>button.addEventListener('click',closeModal));
  modal.addEventListener('click',event=>{if(event.target===modal) closeModal()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open')) closeModal()});

  window.setTimeout(openModal,12000);
  document.querySelector('.ad-hero-video-card video')?.addEventListener('ended',openModal,{once:true});
};
initAdFunnelCaptureModal();

document.querySelectorAll('input[name="phone"]').forEach(input=>{
  const formatPhone=()=>{
    const digits=input.value.replace(/\D/g,'').slice(0,10);
    if(digits.length<4) input.value=digits;
    else if(digits.length<7) input.value=`(${digits.slice(0,3)}) ${digits.slice(3)}`;
    else input.value=`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  };
  input.addEventListener('input',formatPhone);
  if(input.value) formatPhone();
});
document.querySelectorAll('form').forEach(form=>{
  if(form.querySelector('[name="company_website"]')) return;
  const field=document.createElement('input');
  field.type='text';
  field.name='company_website';
  field.tabIndex=-1;
  field.autocomplete='off';
  field.setAttribute('aria-hidden','true');
  field.style.cssText='position:absolute;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none';
  form.appendChild(field);
});
})();
