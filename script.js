const toggle=document.querySelector('.mobile-toggle');
const nav=document.querySelector('.nav-links');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});

const search=document.querySelector('#trainerSearch');
const buttons=[...document.querySelectorAll('.filter-btn')];
const cards=[...document.querySelectorAll('.trainer-card')];
const count=document.querySelector('#trainerCount');
let filter='';

const escapePublicText=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
const publicTrainerProfilesPromise=(async()=>{
  const config=window.LDTT_SUPABASE||{};
  if(!config.enabled||!config.projectUrl||!config.publishableKey) return new Map();
  try{
    const response=await fetch(`${String(config.projectUrl).replace(/\/$/,'')}/rest/v1/trainers?select=slug,full_name,market,state,service_area,bio,headshot_url,status,access_status&status=eq.active&access_status=eq.active`,{headers:{apikey:config.publishableKey}});
    if(!response.ok) throw new Error(`Trainer profile request failed (${response.status})`);
    const rows=await response.json();
    return new Map((rows||[]).map(row=>[row.slug,row]));
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
  if(image&&record.headshot_url){image.src=record.headshot_url;image.alt=`${record.full_name} trainer bio photo`;}
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
      trainerBioData[button.dataset.trainerSlug]={...current,name:live.full_name||current.name,location:publicTrainerLocation(live)||current.location,state:live.state||current.state,bio:live.bio||current.bio,bioPhoto:live.headshot_url||current.bioPhoto,cardPhoto:live.headshot_url||current.cardPhoto};
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

const submitToSupabase=async (functionName,entries)=>{
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

const wireAsyncForm=(form,{storageKey,successMessage,onSubmit})=>{
  const status=form.querySelector('.form-status');
  const setStatus=(message,type='success')=>{
    if(!status) return;
    status.className=`form-status ${type}`;
    status.innerHTML=message;
  };
  const serialize=()=>{
    const data=new FormData(form);
    data.set('timestamp',new Date().toISOString());
    data.set('page_url',window.location.href);
    data.set('source_page',document.title);
    applyStoredTrainerAttribution(data);
    return data;
  };
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(form.dataset.submitting==='true') return;
    if(!form.reportValidity()) return;
    const submitButton=form.querySelector('button[type="submit"]');
    const data=serialize();
    const entries=formToObject(data);
    entries.submission_id=`web-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    entries.delivery_local='saved';
    entries.delivery_google='pending';
    entries.delivery_email='pending';
    entries.delivery_supabase=window.LDTT_SUPABASE?.enabled?'pending':'not_connected';
    const submissions=JSON.parse(localStorage.getItem(storageKey)||'[]');
    submissions.push(entries);
    localStorage.setItem(storageKey,JSON.stringify(submissions));
    form.dataset.submitting='true';
    submitButton?.setAttribute('disabled','disabled');
    setStatus(successMessage,'success');
    showFormSuccessModal(successMessage);
    form.reset();

    Promise.resolve(onSubmit(data,entries,form)).catch(error=>{
      console.warn('LDTT async form submit failed',error);
    }).finally(()=>{
      window.setTimeout(()=>{
        delete form.dataset.submitting;
        submitButton?.removeAttribute('disabled');
      },4000);
    });

    window.setTimeout(()=>{
      if(form.dataset.submitting==='true'){
        delete form.dataset.submitting;
        submitButton?.removeAttribute('disabled');
      }
    },10000);
  });
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
  wireAsyncForm(contactForm,{
    storageKey:'ldttContactSubmissions.v2',
    successMessage:"Thank you, your form has been submitted. Our team will contact you within 1-3 business days.",
    onSubmit:async (data,entries,form)=>{
      try{
        const result=await submitToSupabase('submit-contact',entries);
        updateStoredDelivery('ldttContactSubmissions.v2',entries.submission_id,{delivery_supabase:result?.skipped?'not_connected':'saved'});
      }catch(error){
        updateStoredDelivery('ldttContactSubmissions.v2',entries.submission_id,{delivery_supabase:'failed'});
        console.warn('LDTT Supabase contact save failed',error);
      }
      const googleEndpoint=form.dataset.googleFormEndpoint;
      let googleSubmitted=false;
      if(googleEndpoint){
        const googlePayload=new FormData();
        const mapping={
          trainer_name:'entry.732274329',
          first_name:'entry.2076204969',
          last_name:'entry.1657690671',
          address_line_1:'entry.1231537394',
          address_line_2:'entry.1987365575',
          city:'entry.375426998',
          state:'entry.114802361',
          zip:'entry.416673611',
          email:'entry.1949246301',
          phone:'entry.503719735',
          i_want_to:'entry.270700046',
          heard_about_us:'entry.1942005538',
          vet_or_previous_client:'entry.1616503040',
          comments:'entry.1517896175',
        };
        entries.trainer_name=entries.trainer_name||entries.assigned_trainer||'Office / Not sure';
        Object.entries(mapping).forEach(([fieldName,entryName])=>{
          const value=entries[fieldName];
          if(value) googlePayload.append(entryName,value);
        });
        googlePayload.append('fvv','1');
        googlePayload.append('pageHistory','0');
        await fetch(googleEndpoint,{method:'POST',mode:'no-cors',body:googlePayload});
        googleSubmitted=true;
        updateStoredDelivery('ldttContactSubmissions.v2',entries.submission_id,{delivery_google:'attempted'});
      }

      const emailEndpoint=form.dataset.emailEndpoint;
      if(emailEndpoint){
        try{
          await submitEmailRelay(emailEndpoint,entries,"New Lorenzo's Dog Training Team Contact Form Submission");
          updateStoredDelivery('ldttContactSubmissions.v2',entries.submission_id,{delivery_email:'confirmed'});
        }catch(error){
          updateStoredDelivery('ldttContactSubmissions.v2',entries.submission_id,{delivery_email:'failed'});
          console.warn('LDTT contact email relay delayed or failed',error);
          if(!googleSubmitted) throw error;
        }
      }
    }
  });
}

const trainerApplicationForm=document.querySelector('.trainer-application-form');
if(trainerApplicationForm){
  wireAsyncForm(trainerApplicationForm,{
    storageKey:'ldttTrainerApplications.v1',
    successMessage:trainerApplicationForm.dataset.successMessage||"Thank you, your form has been submitted. Our team will contact you within 1-3 business days.",
    onSubmit:async (_data,entries,form)=>{
      try{
        const result=await submitToSupabase('submit-trainer-application',entries);
        updateStoredDelivery('ldttTrainerApplications.v1',entries.submission_id,{delivery_supabase:result?.skipped?'not_connected':'saved'});
      }catch(error){
        updateStoredDelivery('ldttTrainerApplications.v1',entries.submission_id,{delivery_supabase:'failed'});
        console.warn('LDTT Supabase trainer application save failed',error);
      }
      const googleEndpoint=form.dataset.googleFormEndpoint;
      let googleSubmitted=false;
      if(googleEndpoint){
        const googlePayload=new FormData();
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
        };
        entries.employment_1_country=entries.employment_1_country||'United States';
        if(entries.employment_2_company) entries.employment_2_country=entries.employment_2_country||'United States';
        if(entries.employment_3_company) entries.employment_3_country=entries.employment_3_country||'United States';
        Object.entries(mapping).forEach(([fieldName,entryName])=>appendGoogleField(googlePayload,entryName,entries[fieldName]));
        googlePayload.append('fvv','1');
        googlePayload.append('pageHistory','0');
        await fetch(googleEndpoint,{method:'POST',mode:'no-cors',body:googlePayload});
        googleSubmitted=true;
        updateStoredDelivery('ldttTrainerApplications.v1',entries.submission_id,{delivery_google:'attempted'});
      }
      const emailEndpoint=form.dataset.emailEndpoint||'https://formsubmit.co/ajax/recruiting@lorenzosdogtrainingteam.com';
      try{
        await submitEmailRelay(emailEndpoint,entries,"New Lorenzo's Dog Training Team Trainer Application");
        updateStoredDelivery('ldttTrainerApplications.v1',entries.submission_id,{delivery_email:'confirmed'});
      }catch(error){
        updateStoredDelivery('ldttTrainerApplications.v1',entries.submission_id,{delivery_email:'failed'});
        if(!googleSubmitted) throw error;
        console.warn('LDTT trainer application email relay delayed or failed',error);
      }
    }
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
